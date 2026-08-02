const { Field, Fp2 } = require('@wa1one/alg-field')

class BN128Fp {
    constructor(x, y, z) {
        if (x instanceof Field && y instanceof Field && z instanceof Field) {
            this.x = x
            this.y = y
            this.z = z
        }
    }

    static n =
        21888242871839275222246405745257275088548364400416034343698204186575808495617n

    static ZERO = new BN128Fp(Field._0, Field._0, Field._0)
    static B = new Field(3n)

    neg = () => new BN128Fp(this.x, this.y.negate(), this.z)

    /**
     * Transforms given Jacobian to affine coordinates and then creates a point
     */
    toAffine() {
        if (this.isZero()) {
            let zero = BN128Fp.ZERO
            return new BN128Fp(zero.x, Field._1, zero.z) // (0; 1; 0)
        }

        const zInv = this.z.inverse()
        const zInv2 = zInv.square()
        const zInv3 = zInv2.multiply(zInv)

        const ax = this.x.multiply(zInv2)
        const ay = this.y.multiply(zInv3)

        return new BN128Fp(ax, ay, Field._1)
    }

    /**
     * Runs affine transformation and encodes point at infinity as (0; 0; 0)
     */
    toEthNotation() {
        const affine = this.toAffine()

        // affine zero is (0; 1; 0), convert to Ethereum zero: (0; 0; 0)
        if (affine.isZero()) {
            return BN128Fp.ZERO
        }
        return affine
    }

    isOnCurve() {
        if (this.isZero()) return true

        const z6 = this.z.square().multiply(this.z).square()
        const left = this.y.square() // y^2
        const right = this.x
            .square()
            .multiply(this.x)
            .add(BN128Fp.B.multiply(z6)) // x^3 + b * z^6
        return left.eq(right)
    }

    add(o) {
        if (this.isZero()) return o // 0 + P = P
        if (o.isZero()) return this // P + 0 = P

        const x1 = this.x,
            y1 = this.y,
            z1 = this.z
        const x2 = o.x,
            y2 = o.y,
            z2 = o.z

        // ported code is started from here
        // next calculations are done in Jacobian coordinates

        const z1z1 = z1.square()
        const z2z2 = z2.square()

        const u1 = x1.multiply(z2z2)
        const u2 = x2.multiply(z1z1)

        const z1Cubed = z1.multiply(z1z1)
        const z2Cubed = z2.multiply(z2z2)

        const s1 = y1.multiply(z2Cubed) // s1 = y1 * Z2^3
        const s2 = y2.multiply(z1Cubed) // s2 = y2 * Z1^3

        if (u1.eq(u2) && s1.eq(s2)) {
            return this.double() // P + P = 2P
        }

        const h = u2.subtract(u1) // h = u2 - u1
        const i = h.double().square() // i = (2 * h)^2
        const j = h.multiply(i) // j = h * i
        const r = s2.subtract(s1).double() // r = 2 * (s2 - s1)
        const v = u1.multiply(i) // v = u1 * i
        const zz = z1
            .add(z2)
            .square()
            .subtract(z1.square())
            .subtract(z2.square())

        const x3 = r.square().subtract(j).subtract(v.double()) // x3 = r^2 - j - 2 * v
        const y3 = v.subtract(x3).multiply(r).subtract(s1.multiply(j).double()) // y3 = r * (v - x3) - 2 * (s1 * j)
        const z3 = zz.multiply(h) // z3 = ((z1+z2)^2 - z1^2 - z2^2) * h = zz * h

        return new BN128Fp(x3, y3, z3)
    }

    multiply(s) {
        if (s == 0n)
            // P * 0 = 0
            return BN128Fp.ZERO

        if (this.isZero()) return this // 0 * s = 0

        let res = BN128Fp.ZERO

        for (let i = s.bitLength() - 1; i >= 0; i--) {
            res = res.double()

            if (s.testBit(i)) {
                res = res.add(this)
            }
        }

        return res
    }

    double() {
        if (this.isZero()) return this

        // next calculations are done in Jacobian coordinates with z = 1

        const a = this.x.square() // a = x^2
        const b = this.y.square() // b = y^2
        const c = b.square() // c = b^2
        let d = this.x.add(b).square().subtract(a).subtract(c)
        d = d.add(d) // d = 2 * ((x + b)^2 - a - c)
        const e = a.add(a).add(a) // e = 3 * a
        const f = e.square() // f = e^2

        const x3 = f.subtract(d.add(d)) // rx = f - 2 * d
        const y3 = e
            .multiply(d.subtract(x3))
            .subtract(c.double().double().double()) // ry = e * (d - rx) - 8 * c
        const z3 = this.y.multiply(this.z).double() // z3 = 2 * y * z

        return new BN128Fp(x3, y3, z3)
    }

    isZero = () => this.z.isZero()

    isValid() {
        // check whether coordinates belongs to the Field
        if (
            !(this.x instanceof Field) ||
            !(this.y instanceof Field) ||
            !(this.z instanceof Field)
        ) {
            return false
        }

        // check whether point is on the curve
        if (!this.isOnCurve()) {
            return false
        }

        return true
    }

    eq(o) {
        if (this === o) return true
        if (!(o instanceof BN128Fp)) return false
        if (this.isZero() || o.isZero()) return this.isZero() === o.isZero()

        // points may use different z-scaling (Jacobian coordinates), so
        // compare in affine form rather than raw x/y/z components
        const a = this.toAffine()
        const b = o.toAffine()
        return a.x.eq(b.x) && a.y.eq(b.y)
    }

    static create(xx, yy) {
        const x = new Field(xx)
        const y = new Field(yy)

        // check for point at infinity
        if (x.isZero() && y.isZero()) {
            return BN128Fp.ZERO
        }

        const p = new BN128Fp(x, y, Field._1)

        // check whether point is a valid one
        if (p.isValid()) {
            return p
        }
        return null
    }

    toString() {
        return (
            this.x.toString() +
            ' ' +
            this.y.toString() +
            ' ' +
            this.z.toString()
        )
    }
}

class BN128Fp2 {
    constructor(x, y, z) {
        if (x instanceof Fp2 && y instanceof Fp2 && z instanceof Fp2) {
            this.x = x
            this.y = y
            this.z = z
        }
    }

    static n =
        21888242871839275222246405745257275088548364400416034343698204186575808495617n

    static TWIST_MUL_BY_P_X = new Fp2(
        21575463638280843010398324269430826099269044274347216827212613867836435027261n,
        10307601595873709700152284273816112264069230130616436755625194854815875713954n
    )

    static TWIST_MUL_BY_P_Y = new Fp2(
        2821565182194536844548159561693502659359617185244120367078079554186484126554n,
        3505843767911556378687030309984248845540243509899259641013678093033130930403n
    )

    static ZERO = new BN128Fp2(Fp2._0, Fp2._0, Fp2._0)
    static TWIST = new Fp2(9n, 1n)
    static twinv = BN128Fp2.TWIST.inverse()
    static B_Fp2 = new Fp2(
        BN128Fp2.twinv.a.multiply(new Field(3n)),
        BN128Fp2.twinv.b.multiply(new Field(3n))
    )

    neg = () => new BN128Fp2(this.x, this.y.negate(), this.z)

    /**
     * Transforms given Jacobian to affine coordinates and then creates a point
     */
    toAffine() {
        if (this.isZero()) {
            let zero = BN128Fp2.ZERO
            return new BN128Fp2(zero.x, Fp2._1, zero.z) // (0; 1; 0)
        }

        const zInv = this.z.inverse()
        const zInv2 = zInv.square()
        const zInv3 = zInv2.multiply(zInv)

        const ax = this.x.multiply(zInv2)
        const ay = this.y.multiply(zInv3)

        return new BN128Fp2(ax, ay, Fp2._1)
    }

    /**
     * Runs affine transformation and encodes point at infinity as (0; 0; 0)
     */
    toEthNotation() {
        const affine = this.toAffine()

        // affine zero is (0; 1; 0), convert to Ethereum zero: (0; 0; 0)
        if (affine.isZero()) {
            return BN128Fp2.ZERO
        }
        return affine
    }

    isOnCurve() {
        if (this.isZero()) return true

        const z6 = this.z.square().multiply(this.z).square()
        const left = this.y.square() // y^2

        const right = this.x
            .square()
            .multiply(this.x)
            .add(BN128Fp2.B_Fp2.multiply(z6)) // x^3 + b * z^6
        return left.eq(right)
    }

    add(o) {
        if (this.isZero()) return o // 0 + P = P
        if (o.isZero()) return this // P + 0 = P

        const x1 = this.x,
            y1 = this.y,
            z1 = this.z
        const x2 = o.x,
            y2 = o.y,
            z2 = o.z

        const z1z1 = z1.square()
        const z2z2 = z2.square()

        const u1 = x1.multiply(z2z2)
        const u2 = x2.multiply(z1z1)

        const z1Cubed = z1.multiply(z1z1)
        const z2Cubed = z2.multiply(z2z2)

        const s1 = y1.multiply(z2Cubed) // s1 = y1 * Z2^3
        const s2 = y2.multiply(z1Cubed) // s2 = y2 * Z1^3

        if (u1.eq(u2) && s1.eq(s2)) {
            return this.double() // P + P = 2P
        }

        const h = u2.subtract(u1) // h = u2 - u1
        const i = h.double().square() // i = (2 * h)^2
        const j = h.multiply(i) // j = h * i
        const r = s2.subtract(s1).double() // r = 2 * (s2 - s1)
        const v = u1.multiply(i) // v = u1 * i
        const zz = z1
            .add(z2)
            .square()
            .subtract(z1.square())
            .subtract(z2.square())

        const x3 = r.square().subtract(j).subtract(v.double()) // x3 = r^2 - j - 2 * v
        const y3 = v.subtract(x3).multiply(r).subtract(s1.multiply(j).double()) // y3 = r * (v - x3) - 2 * (s1 * j)
        const z3 = zz.multiply(h) // z3 = ((z1+z2)^2 - z1^2 - z2^2) * h = zz * h

        return new BN128Fp2(x3, y3, z3)
    }

    multiply(s) {
        if (typeof s !== 'bigint') {
            s = BigInt(s)
        }

        if (s == 0n)
            // P * 0 = 0
            return BN128Fp2.ZERO

        if (this.isZero()) return this // 0 * s = 0

        let res = BN128Fp2.ZERO

        for (let i = s.bitLength() - 1; i >= 0; i--) {
            res = res.double()

            if (s.testBit(i)) {
                res = res.add(this)
            }
        }

        return res
    }

    double() {
        if (this.isZero()) return this

        const a = this.x.square() // a = x^2
        const b = this.y.square() // b = y^2
        const c = b.square() // c = b^2
        let d = this.x.add(b).square().subtract(a).subtract(c)
        d = d.add(d) // d = 2 * ((x + b)^2 - a - c)
        const e = a.add(a).add(a) // e = 3 * a
        const f = e.square() // f = e^2

        const x3 = f.subtract(d.add(d)) // rx = f - 2 * d
        const y3 = e
            .multiply(d.subtract(x3))
            .subtract(c.double().double().double()) // ry = e * (d - rx) - 8 * c
        const z3 = this.y.multiply(this.z).double() // z3 = 2 * y * z

        return new BN128Fp2(x3, y3, z3)
    }

    isZero = () => this.z.isZero()

    isValid() {
        // check whether coordinates belongs to the Field
        if (
            !(this.x instanceof Fp2) ||
            !(this.y instanceof Fp2) ||
            !(this.z instanceof Fp2)
        ) {
            return false
        }

        // check whether point is on the curve
        return this.isOnCurve()
    }

    toString() {
        return (
            '[' +
            this.x.toString() +
            ', ' +
            this.y.toString() +
            ', ' +
            this.z.toString() +
            ']'
        )
    }

    eq(o) {
        if (this === o) return true
        if (!(o instanceof BN128Fp2)) return false
        if (this.isZero() || o.isZero()) return this.isZero() === o.isZero()

        // points may use different z-scaling (Jacobian coordinates), so
        // compare in affine form rather than raw x/y/z components
        const a = this.toAffine()
        const b = o.toAffine()
        return a.x.eq(b.x) && a.y.eq(b.y)
    }

    static create(aa, bb, cc, dd) {
        const x = new Fp2(new Field(aa), new Field(bb))
        const y = new Fp2(new Field(cc), new Field(dd))

        // check for point at infinity
        if (x.isZero() && y.isZero()) {
            return BN128Fp2.ZERO
        }

        const p = new BN128Fp2(x, y, Fp2._1)

        // check whether point is a valid one
        if (p.isValid()) {
            return p
        }
        return null
    }

    mulByP() {
        const rx = BN128Fp2.TWIST_MUL_BY_P_X.multiply(this.x.frobeniusMap(1n))
        const ry = BN128Fp2.TWIST_MUL_BY_P_Y.multiply(this.y.frobeniusMap(1n))
        const rz = this.z.frobeniusMap(1n)

        return new BN128Fp2(rx, ry, rz)
    }
}

module.exports = { BN128Fp, BN128Fp2 }
