const { Field, Fp2, Fp12 } = require('alg-field')

const { BN128Fp2 } = require('./BN128')

class EllCoeffs {
    constructor(ell0, ellVW, ellVV) {
        this.ell0 = ell0
        this.ellVW = ellVW
        this.ellVV = ellVV
    }
}
class PairingCheck {
    static TWIST = new Fp2(9n, 1n)
    static PAIRING_FINAL_EXPONENT_Z = 4965661367192848881n
    static LOOP_COUNT = 29793968203157093288n

    static create() {
        const pc = new PairingCheck()
        pc.pairs = []
        pc.product = Fp12._1
        return pc
    }

    addPair(g1, g2) {
        this.pairs.push([g1, g2])
    }

    run() {
        this.product = this.finalExponentiation(this.millerProduct())
    }

    result() {
        return this.product
    }

    /**
     * Merged multi-Miller loop: all pairs share a single accumulator, so the
     * per-iteration squaring is done once instead of once per pair. The
     * result is exactly the product of the individual millerLoop values,
     * since squaring distributes over the product and every pair's line
     * evaluations enter at the same loop positions.
     */
    millerProduct() {
        const prepared = []
        for (const pair of this.pairs) {
            prepared.push({
                g1: pair[0].toAffine(),
                coeffs: this.calcEllCoeffs(pair[1].toAffine()),
            })
        }

        let f = Fp12._1
        let idx = 0

        const bl = PairingCheck.LOOP_COUNT.bitLength() - 2

        // for each bit except most significant one
        for (let i = bl; i >= 0; i--) {
            f = f.square()
            for (const pr of prepared) {
                const c = pr.coeffs[idx]
                f = f.mulBy024(
                    c.ell0,
                    pr.g1.y.multiply(c.ellVW),
                    pr.g1.x.multiply(c.ellVV)
                )
            }
            idx++

            if (PairingCheck.LOOP_COUNT.testBit(i)) {
                for (const pr of prepared) {
                    const c = pr.coeffs[idx]
                    f = f.mulBy024(
                        c.ell0,
                        pr.g1.y.multiply(c.ellVW),
                        pr.g1.x.multiply(c.ellVV)
                    )
                }
                idx++
            }
        }

        // the two BN-curve Frobenius correction steps
        for (let step = 0; step < 2; step++) {
            for (const pr of prepared) {
                const c = pr.coeffs[idx]
                f = f.mulBy024(
                    c.ell0,
                    pr.g1.y.multiply(c.ellVW),
                    pr.g1.x.multiply(c.ellVV)
                )
            }
            idx++
        }

        return f
    }

    millerLoop(g1, g2) {
        // convert to affine coordinates
        g1 = g1.toAffine()
        g2 = g2.toAffine()

        // calculate Ell coefficients
        const coeffs = this.calcEllCoeffs(g2)

        let f = Fp12._1
        let idx = 0

        const bl = PairingCheck.LOOP_COUNT.bitLength() - 2

        // for each bit except most significant one
        for (let i = bl; i >= 0; i--) {
            let c = coeffs[idx++]
            f = f.square()

            f = f.mulBy024(
                c.ell0,
                g1.y.multiply(c.ellVW),
                g1.x.multiply(c.ellVV)
            )

            if (PairingCheck.LOOP_COUNT.testBit(i)) {
                c = coeffs[idx++]
                f = f.mulBy024(
                    c.ell0,
                    g1.y.multiply(c.ellVW),
                    g1.x.multiply(c.ellVV)
                )
            }
        }

        let c = coeffs[idx++]
        f = f.mulBy024(c.ell0, g1.y.multiply(c.ellVW), g1.x.multiply(c.ellVV))

        c = coeffs[idx]
        f = f.mulBy024(c.ell0, g1.y.multiply(c.ellVW), g1.x.multiply(c.ellVV))

        return f
    }

    calcEllCoeffs(base) {
        const coeffs = []

        let addend = base

        const bl = PairingCheck.LOOP_COUNT.bitLength() - 2

        // for each bit except most significant one
        for (let i = bl; i >= 0; i--) {
            const doubling = this.flippedMillerLoopDoubling(addend)

            addend = doubling.g2
            coeffs.push(doubling.coeffs)

            if (PairingCheck.LOOP_COUNT.testBit(i)) {
                const addition = this.flippedMillerLoopMixedAddition(
                    base,
                    addend
                )
                addend = addition.g2
                coeffs.push(addition.coeffs)
            }
        }

        let q1 = base.mulByP()
        let q2 = q1.mulByP()

        q2 = new BN128Fp2(q2.x, q2.y.negate(), q2.z) // q2.y = -q2.y

        let addition = this.flippedMillerLoopMixedAddition(q1, addend)
        addend = addition.g2
        coeffs.push(addition.coeffs)

        addition = this.flippedMillerLoopMixedAddition(q2, addend)
        coeffs.push(addition.coeffs)

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

        const ell0 = PairingCheck.TWIST.multiply(
            e.multiply(x2).subtract(d.multiply(y2))
        ) // ell_0 = TWIST * (e * x2 - d * y2)
        const ellVV = e.negate() // ell_VV = -e
        const ellVW = d // ell_VW = d

        return {
            g2: new BN128Fp2(x3, y3, z3),
            coeffs: new EllCoeffs(ell0, ellVW, ellVV),
        }
    }

    flippedMillerLoopDoubling(g2) {
        const x = g2.x,
            y = g2.y,
            z = g2.z

        const xy = x.multiply(y)
        const a = new Fp2(
            xy.a.multiply(Field._2_INV),
            xy.b.multiply(Field._2_INV)
        ) // a = x * y / 2
        const b = y.square() // b = y^2
        const c = z.square() // c = z^2
        const d = c.add(c).add(c) // d = 3 * c

        const twinv = PairingCheck.TWIST.inverse()
        const B_Fp2 = new Fp2(
            twinv.a.multiply(new Field(3n)),
            twinv.b.multiply(new Field(3n))
        )

        const e = B_Fp2.multiply(d) // e = twist_b * d
        const f = e.add(e).add(e) // f = 3 * e
        const bf = b.add(f)
        const g = new Fp2(
            bf.a.multiply(Field._2_INV),
            bf.b.multiply(Field._2_INV)
        )
        const h = y.add(z).square().subtract(b.add(c)) // h = (y + z)^2 - (b + c)
        const i = e.subtract(b) // i = e - b
        const j = x.square() // j = x^2
        const e2 = e.square() // e2 = e^2
        const rx = a.multiply(b.subtract(f)) // rx = a * (b - f)
        const ry = g.square().subtract(e2.add(e2).add(e2)) // ry = g^2 - 3 * e^2
        const rz = b.multiply(h) // rz = b * h

        const ell0 = PairingCheck.TWIST.multiply(i) // ell_0 = twist * i
        const ellVW = h.negate() // ell_VW = -h
        const ellVV = j.add(j).add(j) // ell_VV = 3 * j

        return {
            g2: new BN128Fp2(rx, ry, rz),
            coeffs: new EllCoeffs(ell0, ellVW, ellVV),
        }
    }

    finalExponentiation(el) {
        // first chunk
        const w = new Fp12(el.a, el.b.negate()) // el.b = -el.b
        const x = el.inverse()
        const y = w.multiply(x)
        const z = y.frobeniusMap(2n)
        const pre = z.multiply(y)

        // last chunk
        const a = pre.negExp(PairingCheck.PAIRING_FINAL_EXPONENT_Z)
        const b = a.cyclotomicSquared()
        const c = b.cyclotomicSquared()
        const d = c.multiply(b)
        const e = d.negExp(PairingCheck.PAIRING_FINAL_EXPONENT_Z)
        const f = e.cyclotomicSquared()
        const g = f.negExp(PairingCheck.PAIRING_FINAL_EXPONENT_Z)
        const h = d.unitaryInverse()
        const i = g.unitaryInverse()
        const j = i.multiply(e)
        const k = j.multiply(h)
        const l = k.multiply(b)
        const m = k.multiply(e)
        const n = m.multiply(pre)
        const o = l.frobeniusMap(1n)
        const p = o.multiply(n)
        const q = k.frobeniusMap(2n)
        const r = q.multiply(p)
        const s = pre.unitaryInverse()
        const t = s.multiply(l)
        const u = t.frobeniusMap(3n)
        return u.multiply(r)
    }
}

module.exports = { PairingCheck }
