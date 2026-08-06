const { Fp2, Fp6, Fp12 } = require('alg-field')
const { BLS12Fp2 } = require('./BLS12381')
const {
    p,
    n,
    X_ABS,
    X_IS_NEGATIVE,
    _2_INV,
    fp2Params,
    fp6Params,
    fp12Params,
} = require('./bls12381Params')

class EllCoeffs {
    constructor(ell0, ellVW, ellVV) {
        this.ell0 = ell0
        this.ellVW = ellVW
        this.ellVV = ellVV
    }
}

/**
 * Generic (non-optimized) final exponentiation: f^((p^12 - 1) / n).
 *
 * The tower-based Fp12 implementation only exposes cyclotomicExp (valid on
 * elements already reduced into the cyclotomic subgroup) rather than a
 * general-purpose exp, and BLS12-381's optimized "easy part + hard part"
 * final exponentiation formula is a curve-specific formula this codebase has
 * no way to verify. This full exponentiation is mathematically correct
 * regardless, just slower.
 */
function finalExponentiation(f) {
    // p^12 computed iteratively: Babel transpiles ** into Math.pow(), which
    // does not support BigInt operands (same issue as the fixed share() bug)
    let p12 = 1n
    for (let i = 0; i < 12; i++) {
        p12 *= p
    }
    const exponent = (p12 - 1n) / n
    let result = Fp12.one(fp12Params)
    let base = f
    let e = exponent
    while (e > 0n) {
        if (e & 1n) {
            result = result.multiply(base)
        }
        base = base.multiply(base)
        e >>= 1n
    }
    return result
}

/**
 * Multiplies the Miller accumulator by an evaluated line function.
 *
 * BLS12-381 uses an M-type sextic twist (b' = b * xi), unlike BN254's D-type
 * (b' = b / xi), so the line's embedding into Fp12 differs from the BN254
 * code's mulBy024 path. Untwisting P via psi^-1(P) = (xP * w^2, yP * w^3)
 * gives the line
 *
 *   l = (lambda*xR - yR) - lambda*xP * w^2 + yP * w^3
 *
 * i.e. Fp2 coefficients at w-power positions (0, 2, 3), with no twist factor
 * on the constant term (the xi on ell0 in the BN254 code is purely a D-type
 * embedding artifact). mulBy024 multiplies at positions (0, 3, 4), so it
 * cannot be reused here; a generic sparse multiply is used instead.
 */
function mulByLine(f, c, g1) {
    const zero = Fp2.zero(fp2Params)
    const line = new Fp12(
        new Fp6(c.ell0, g1.x.multiply(c.ellVV), zero, fp6Params),
        new Fp6(zero, g1.y.multiply(c.ellVW), zero, fp6Params),
        fp12Params
    )
    return f.multiply(line)
}

/**
 * Optimal ate pairing for BLS12-381. Unlike BN curves, BLS12 curves need no
 * Frobenius-endomorphism correction terms after the Miller loop - the loop
 * over the (much shorter) BLS x-parameter is already the optimal pairing.
 * Since x is negative, the Miller loop runs over |x| and the result is
 * inverted (a standard Miller-function identity: f_{-x,Q} = f_{x,Q}^{-1}).
 */
class BLS12381PairingCheck {
    static create() {
        const pc = new BLS12381PairingCheck()
        pc.pairs = []
        pc.product = Fp12.one(fp12Params)
        return pc
    }

    addPair(g1, g2) {
        this.pairs.push([g1, g2])
    }

    run() {
        for (let pair of this.pairs) {
            const miller = this.millerLoop(pair[0], pair[1])

            if (!miller.eq(Fp12.one(fp12Params))) {
                this.product = this.product.multiply(miller)
            }
        }
        this.product = finalExponentiation(this.product)
    }

    result() {
        return this.product
    }

    millerLoop(g1, g2) {
        g1 = g1.toAffine()
        g2 = g2.toAffine()

        const coeffs = this.calcEllCoeffs(g2)

        let f = Fp12.one(fp12Params)
        let idx = 0

        const bl = X_ABS.bitLength() - 2

        for (let i = bl; i >= 0; i--) {
            let c = coeffs[idx++]
            f = f.square()

            f = mulByLine(f, c, g1)

            if (X_ABS.testBit(i)) {
                c = coeffs[idx++]
                f = mulByLine(f, c, g1)
            }
        }

        if (X_IS_NEGATIVE) {
            f = f.inverse()
        }

        return f
    }

    calcEllCoeffs(base) {
        const coeffs = []

        let addend = base

        const bl = X_ABS.bitLength() - 2

        for (let i = bl; i >= 0; i--) {
            const doubling = this.flippedMillerLoopDoubling(addend)

            addend = doubling.g2
            coeffs.push(doubling.coeffs)

            if (X_ABS.testBit(i)) {
                const addition = this.flippedMillerLoopMixedAddition(
                    base,
                    addend
                )
                addend = addition.g2
                coeffs.push(addition.coeffs)
            }
        }

        return coeffs
    }

    flippedMillerLoopMixedAddition(base, addend) {
        const x1 = addend.x,
            y1 = addend.y,
            z1 = addend.z
        const x2 = base.x,
            y2 = base.y

        const d = x1.subtract(x2.multiply(z1)) // d = x1 - x2 * z1
        const e = y1.subtract(y2.multiply(z1)) // e = y1 - y2 * z1
        const f = d.square() // f = d^2
        const g = e.square() // g = e^2
        const h = d.multiply(f) // h = d * f
        const i = x1.multiply(f) // i = x1 * f
        const j = h.add(z1.multiply(g)).subtract(i.double()) // j = h + z1 * g - 2 * i

        const x3 = d.multiply(j) // x3 = d * j
        const y3 = e.multiply(i.subtract(j)).subtract(h.multiply(y1)) // y3 = e * (i - j) - h * y1)
        const z3 = z1.multiply(h) // z3 = Z1*H

        const ell0 = e.multiply(x2).subtract(d.multiply(y2)) // ell_0 = e * x2 - d * y2 (no twist factor for M-type)
        const ellVV = e.negate() // ell_VV = -e
        const ellVW = d // ell_VW = d

        return {
            g2: new BLS12Fp2(x3, y3, z3),
            coeffs: new EllCoeffs(ell0, ellVW, ellVV),
        }
    }

    flippedMillerLoopDoubling(g2) {
        const x = g2.x,
            y = g2.y,
            z = g2.z

        const xy = x.multiply(y)
        const a = new Fp2(
            xy.a.multiply(_2_INV),
            xy.b.multiply(_2_INV),
            xy.params
        ) // a = x * y / 2
        const b = y.square() // b = y^2
        const c = z.square() // c = z^2
        const d = c.add(c).add(c) // d = 3 * c

        const e = BLS12Fp2.B_FP2.multiply(d) // e = twist_b * d
        const f = e.add(e).add(e) // f = 3 * e
        const bf = b.add(f)
        const g = new Fp2(
            bf.a.multiply(_2_INV),
            bf.b.multiply(_2_INV),
            bf.params
        )
        const h = y.add(z).square().subtract(b.add(c)) // h = (y + z)^2 - (b + c)
        const i = e.subtract(b) // i = e - b
        const j = x.square() // j = x^2
        const e2 = e.square() // e2 = e^2
        const rx = a.multiply(b.subtract(f)) // rx = a * (b - f)
        const ry = g.square().subtract(e2.add(e2).add(e2)) // ry = g^2 - 3 * e^2
        const rz = b.multiply(h) // rz = b * h

        const ell0 = i // ell_0 = e - b (no twist factor for M-type)
        const ellVW = h.negate() // ell_VW = -h
        const ellVV = j.add(j).add(j) // ell_VV = 3 * j

        return {
            g2: new BLS12Fp2(rx, ry, rz),
            coeffs: new EllCoeffs(ell0, ellVW, ellVV),
        }
    }
}

module.exports = { BLS12381PairingCheck }
