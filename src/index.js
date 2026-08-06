const crypto = require('./random')
const { Parameters, Fp12 } = require('alg-field')

const { BN128Fp, BN128Fp2 } = require('./pairing/BN128')
const { PairingCheck } = require('./pairing/PairingCheck')

/** Secret Key */
class BLSSecretKey {
    constructor(s) {
        if (s === undefined) {
            const randomByte = crypto.randBytesSync(1)
            this.s = BigInt(randomByte[0])
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

/** Class representing math polynomial */
class BLSPolynomial {
    static init(s, k) {
        if (k < 2) {
            throw Error('bad k ' + k)
        }
        this.c = new Array(k)
        this.c[0] = s
        for (let i = 1; i < this.c.length; i++) {
            const s = crypto.randBytesSync(1)
            this.c[i] = BigInt(s[0])
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
    static calcDelta(S) {
        const k = S.length
        if (k < 2) throw Error('bad size' + k)
        const delta = new Array(k)
        let a = BigInt(S[0])
        for (let i = 1; i < k; i++) {
            a *= BigInt(S[i])
        }
        for (let i = 0; i < k; i++) {
            let b = BigInt(S[i])
            for (let j = 0; j < k; j++) {
                if (j !== i) {
                    const v = BigInt(S[j]) - BigInt(S[i])
                    if (v === 0n) throw Error('S has same id' + i + ' ' + j)
                    b *= v
                }
            }
            delta[i] = a / b
        }
        return delta
    }

    static lagrange(vec) {
        let S = new Array(vec.length)
        for (let i = 0; i < vec.length; i++) {
            S[i] = vec[i].id
        }
        const delta = BLSPolynomial.calcDelta(S)

        if (vec[0].s !== undefined) {
            let r = 0n
            for (let i = 0; i < delta.length; i++) {
                r += vec[i].s * delta[i]
            }
            return r
        }

        let r = vec[0].sH.constructor.ZERO
        for (let i = 0; i < delta.length; i++) {
            const d = delta[i]
            const term =
                d < 0n ? vec[i].sH.multiply(-d).neg() : vec[i].sH.multiply(d)
            r = r.add(term)
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
