const crypto = require('./random')
const { Parameters, Fp12 } = require('alg-field')

const { BN128Fp, BN128Fp2 } = require('./pairing/BN128')
const { PairingCheck } = require('./pairing/PairingCheck')

/**
 * Order that randomly generated scalars are drawn against.
 *
 * A secret key is a scalar in the curve's prime-order subgroup, so it has to
 * be uniform over [1, order-1] to carry the group's full security. BN254's
 * order is the smaller of the two curves supported here, so a scalar drawn
 * against it is a valid, uniformly distributed key on either curve while
 * still providing ~254 bits of entropy.
 */
const DEFAULT_SCALAR_ORDER = BN128Fp.n

/** Secret Key */
class BLSSecretKey {
    /**
     * With no argument, generates a uniformly random secret in
     * [1, order-1]. Previously this drew a single random byte, giving only
     * 256 possible keys - trivially brute-forced, since an attacker could
     * simply derive the public key for every candidate and compare.
     */
    constructor(s, order = DEFAULT_SCALAR_ORDER) {
        if (s === undefined) {
            this.s = crypto.randBetween(order - 1n)
        } else {
            this.s = BigInt(s)
        }
    }

    toString = () => this.s.toString()

    getPublicKey(Q) {
        return new BLSPublicKey(this, Q)
    }

    sign(H) {
        const sig = new BLSSignature()

        sig.sH = H.multiply(this.s)
        if (this.id) {
            sig.id = this.id
        }
        return sig
    }

    getMasterSecretKey(k) {
        if (k <= 1) {
            throw Error('bad k ' + k)
        }
        const msk = new Array(k)
        msk[0] = this
        for (let i = 1; i < k; i++) {
            msk[i] = new BLSSecretKey()
        }
        // The leading coefficient must not be zero: a zero there drops the
        // polynomial's degree below k-1, so k-1 shares would be enough to
        // reconstruct the secret and the scheme would not hold its threshold.
        while (msk[k - 1].s === 0n) {
            msk[k - 1] = new BLSSecretKey()
        }
        return msk
    }

    share(n, k) {
        if (k > n) {
            throw Error('bad k ' + k + ': k must be <= n (' + n + ')')
        }
        const msk = this.getMasterSecretKey(k)
        const secVec = new Array(n)
        const ids = new Array(n)
        for (let i = 0; i < n; i++) {
            const id = i + 1
            ids[i] = id
            secVec[i] = new BLSSecretKey()
            secVec[i].s = BLSPolynomial.eval(msk, BigInt(id))
            secVec[i].id = id
        }
        return secVec
    }

    recover(vec) {
        this.s = BLSPolynomial.lagrange(vec)
        this.id = 0
    }
}

/** Class representing authentic signature */
class BLSSignature {
    recover(signVec) {
        this.sH = BLSPolynomial.lagrange(signVec)
        return this
    }

    toString() {
        return this.sH.toString()
    }
}
/** Class representing public key */
class BLSPublicKey {
    constructor(s, Q) {
        this.sQ = Q.multiply(s.s)
    }

    toString() {
        return this.sQ.toString()
    }
}

/** Greatest common divisor, used to keep exact-fraction arithmetic reduced */
function gcd(a, b) {
    a = a < 0n ? -a : a
    b = b < 0n ? -b : b
    while (b) {
        const t = a % b
        a = b
        b = t
    }
    return a
}

/** Class representing math polynomial */
class BLSPolynomial {
    static init(s, k) {
        if (k < 2) {
            throw Error('bad k ' + k)
        }
        this.c = new Array(k)
        this.c[0] = s
        for (let i = 1; i < this.c.length; i++) {
            // Full-width coefficients: sharing a strong secret through a
            // polynomial whose other coefficients are guessable would let an
            // attacker brute-force them and solve for the secret from a
            // single share.
            this.c[i] = crypto.randBetween(DEFAULT_SCALAR_ORDER - 1n)
        }
    }
    static eval(msk, x) {
        let s = 0n
        let xPow = 1n // x^0
        for (let i = 0; i < msk.length; i++) {
            s += msk[i].s * xPow
            xPow *= x
        }
        return s
    }
    /**
     * Numerator and denominator of the Lagrange basis coefficient at x = 0
     * for the i-th id: prod_{j != i} S[j] / prod_{j != i} (S[j] - S[i]).
     *
     * These are genuine fractions in general (for ids 1,2,4 the first one is
     * 8/3), so they are only representable as integers for specific id sets -
     * hence the separate exact-rational and modular paths below.
     */
    static basisFraction(S, i) {
        let num = 1n
        let den = 1n
        for (let j = 0; j < S.length; j++) {
            if (j === i) continue
            const v = BigInt(S[j]) - BigInt(S[i])
            if (v === 0n) throw Error('S has same id' + i + ' ' + j)
            num *= BigInt(S[j])
            den *= v
        }
        return { num, den }
    }

    /**
     * Lagrange basis coefficients at x = 0.
     *
     * With a modulus (the group order for the curve in use) the coefficients
     * are computed with modular inverses and are always exact. Without one
     * they can only be returned when every fraction happens to divide evenly,
     * so an inexact set throws rather than silently truncating - truncation
     * produced wrong secrets and signatures for most id subsets.
     */
    static calcDelta(S, modulus) {
        const k = S.length
        if (k < 2) throw Error('bad size' + k)
        const delta = new Array(k)
        for (let i = 0; i < k; i++) {
            const { num, den } = BLSPolynomial.basisFraction(S, i)
            if (modulus === undefined) {
                if (num % den !== 0n) {
                    throw Error(
                        'Lagrange coefficient for id ' +
                            S[i] +
                            ' is not an integer (' +
                            num +
                            '/' +
                            den +
                            '); pass the group order as a modulus'
                    )
                }
                delta[i] = num / den
            } else {
                delta[i] = (num * den.mod(modulus).modInv(modulus)).mod(
                    modulus
                )
            }
        }
        return delta
    }

    static lagrange(vec) {
        if (vec.length < 2) throw Error('bad size' + vec.length)
        const S = vec.map((v) => v.id)

        if (vec[0].s !== undefined) {
            // Exact rational interpolation at x = 0. The shares are integer
            // evaluations of an integer-coefficient polynomial, so the sum of
            // s_i * (num_i / den_i) is exactly f(0) - but the individual
            // terms are not integers, so they are accumulated as a fraction
            // and divided once at the end. This keeps secret recovery
            // independent of any curve's group order.
            let num = 0n
            let den = 1n
            for (let i = 0; i < S.length; i++) {
                const b = BLSPolynomial.basisFraction(S, i)
                num = num * b.den + vec[i].s * b.num * den
                den = den * b.den
                const g = gcd(num, den)
                if (g > 1n) {
                    num /= g
                    den /= g
                }
            }
            if (num % den !== 0n) {
                throw Error('recovered secret is not an integer')
            }
            return num / den
        }

        // Signature shares are curve points, so the coefficients are reduced
        // modulo the group order; scalar multiplication is defined mod that
        // order, which makes the result identical to the rational one.
        const order = vec[0].sH.constructor.n
        const delta = BLSPolynomial.calcDelta(S, order)

        let r = vec[0].sH.constructor.ZERO
        for (let i = 0; i < delta.length; i++) {
            r = r.add(vec[i].sH.multiply(delta[i]))
        }
        return r
    }
}
/** BLS signature signer */
class BLSSigner {
    constructor(
        bitLength,
        G = BN128Fp.create(1n, 2n),
        G2 = BN128Fp2.create(
            10857046999023057135944570762232829481370756359578518086990519993285655852781n,
            11559732032986387107991004021392285783925812861821192530917403151452391805634n,
            8495653923123431417604973247489272438418190587263600148770280649306958101930n,
            4082367875863433681332203403145435568316851327593401208105741076214120093531n
        ),
        PairingCheckImpl = PairingCheck,
        fieldPrime = Parameters.p
    ) {
        this.G = G
        this.G2 = G2
        this.PairingCheck = PairingCheckImpl
        this.fieldPrime = fieldPrime
    }

    /** Creates a signer over the BLS12-381 curve instead of the default BN254 */
    static bls12381(bitLength) {
        const { BLS12Fp, BLS12Fp2 } = require('./pairing/BLS12381')
        const {
            BLS12381PairingCheck,
        } = require('./pairing/BLS12381PairingCheck')
        const params = require('./pairing/bls12381Params')

        return new BLSSigner(
            bitLength,
            BLS12Fp.create(params.Gx, params.Gy),
            BLS12Fp2.create(...params.G2x, ...params.G2y),
            BLS12381PairingCheck,
            params.p
        )
    }

    getRandomPointOnE = () =>
        this.G.multiply(
            crypto.randBetween(4n * BigInt(this.fieldPrime.bitLength()))
        )

    getRandomPointOnEt = () =>
        this.G2.multiply(
            crypto.randBetween(4n * BigInt(this.fieldPrime.bitLength()))
        )

    getPairing = () => this.pair

    getParameters = () => this.bn

    sign = (H, s) => H.multiply(s)

    verify(Q, H, sQ, sH) {
        // single product check e(-sQ, H) * e(Q, sH) == 1, equivalent to
        // e(sQ, H) == e(Q, sH) by bilinearity: one merged Miller loop and
        // one final exponentiation instead of two of each.
        const pc = this.PairingCheck.create()
        pc.addPair(sQ.sQ.neg(), H)
        pc.addPair(Q, sH.sH)
        pc.run()

        // Fp12 equality is value-based, so the BN254-tower _1 constant is a
        // valid identity element for both curves' results
        return pc.result().eq(Fp12._1)
    }
}

module.exports = {
    BLSSigner,
    BLSSecretKey,
    BLSSignature,
    BLSPublicKey,
    BLSPolynomial,
    Parameters,
}
