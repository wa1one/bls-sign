const { Field2, Field12 } = require('@wa1one/alg-field')
const { Point12 } = require('@wa1one/alg-bn')

class Pairing {
    constructor(Et) {
        this.E2 = Et
        this.E = Et.E
        this.bn = this.E.bn
        this.Fp12_0 = this.bn.Fp12_0
        this.Fp12_1 = this.bn.Fp12_1
    }

    tate(P, Q) {
        let f = this.Fp12_1

        if (!P.zero() && !Q.zero()) {
            const bn = this.E.bn
            let V = P
            for (let i = bn.n.bitLength() - 2; i >= 0; i--) {
                f = f.square().multiply(this.slope(V, V, Q))
                V = V.twice(1)
                if (bn.n.testBit(i)) {
                    f = f.multiply(this.slope(V, P, Q))
                    V = V.add(P)
                }
            }
            f = f.finExp()
        }
        return f
    }

    doubletate(P, Q, P2, Q2) {
        let f = this.Fp12_1
        if (!P.zero() && !Q.zero()) {
            const bn = this.E.bn
            let V = P
            let V2 = P2
            for (let i = bn.n.bitLength() - 2; i >= 0; i--) {
                f = f
                    .square()
                    .multiply(this.slope(V, V, Q))
                    .multiply(this.slope(V2, V2, Q2))
                V = V.twice(1)
                V2 = V2.twice(1)
                if (bn.n.testBit(i)) {
                    f = f
                        .multiply(this.slope(V, P, Q))
                        .multiply(this.slope(V2, P2, Q2))
                    V = V.add(P)
                    V2 = V2.add(P2)
                }
            }
        }
        return f
    }

    slope(P1, P2, T) {
        const x1 = P1.x
        const y1 = P1.y
        const x2 = P2.x
        const y2 = P2.y
        const xt = T.x
        const yt = T.y
        let m
        const _3 = new Field12(this.E.bn, 3n)
        const _2 = new Field12(this.E.bn, 2n)

        if (!x1.eq(x2)) {
            m = y2.subtract(y1).divide(x2.subtract(x1))

            return m.multiply(xt.subtract(x1)).subtract(yt.subtract(y1))
        }
        if (y1.eq(y2)) {
            m = _3.multiply(x1.multiply(x1)).divide(_2.multiply(y1))

            return m.multiply(xt.subtract(x1)).subtract(yt.subtract(y1))
        }

        return xt.subtract(x1)
    }

    ate(P, Q) {
        const ateCount = 29793968203157093288n
        const logAteCount = 63n

        let R = Q
        let f = this.E.bn.Fp12_1

        if (Q.eq(this.E2.infinity) || P.eq(this.E.infinity)) {
            return this.E.bn.Fp12_1
        }

        for (let i = logAteCount; i > -1; i--) {
            f = f.multiply(f).multiply(this.slope(R, R, P))
            R = R.double()
            if (!!ateCount & (2n ** i)) {
                f = f.multiply(this.slope(R, Q, P))
                R = R.add(Q)
            }
        }

        const Q1 = new Point12(
            this.E.bn,
            Q.x.exp(this.E.bn.p),
            Q.y.exp(this.E.bn.p)
        )
        const nQ2 = new Point12(
            this.E.bn,
            Q1.x.exp(this.E.bn.p),
            Q1.y.exp(this.E.bn.p).neg()
        )

        f = f.multiply(this.slope(R, Q1, P))
        R = R.add(Q1)
        f = f.multiply(this.slope(R, nQ2, P))
        return f.finExp()
    }
}

module.exports = Pairing
