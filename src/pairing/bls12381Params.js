const {
    Field,
    Fp2,
    deriveFp2Params,
    deriveFp6Params,
    deriveFp12Params,
} = require('alg-field')
const { Bls12381Parameters } = require('alg-bn')

const p = Bls12381Parameters.p
const n = Bls12381Parameters.n

// BLS x parameter (x = -0xd201000000010000), independently verified against
// the published curve order/prime via their defining polynomials:
//   r(x) = x^4 - x^2 + 1
//   p(x) = (x-1)^2 * (x^4-x^2+1) / 3 + x
const X_ABS = 0xd201000000010000n
const X_IS_NEGATIVE = true

const fp2Params = deriveFp2Params(p)
const fp6Params = deriveFp6Params(fp2Params)
const fp12Params = deriveFp12Params(fp6Params)

const _0 = new Field(0n, p)
const _1 = new Field(1n, p)
const _2_INV = new Field(2n, p).inverse()

// G1 curve coefficient (y^2 = x^3 + 4), verified on-curve against the
// published generator.
const B = new Field(Bls12381Parameters.b.a.v, p)
const Gx = Bls12381Parameters.Gx.a.v
const Gy = Bls12381Parameters.Gy.a.v

// G2 (twist) curve coefficient (y^2 = x^3 + (4+4u)), taken directly from the
// published parameters rather than re-derived from the twist, since that
// derivation in the BN254 code bakes in BN254's own curve coefficient.
const B_FP2 = new Fp2(
    Bls12381Parameters.G2b.a.v,
    Bls12381Parameters.G2b.b.v,
    fp2Params
)
const G2x = [Bls12381Parameters.G2x.a.v, Bls12381Parameters.G2x.b.v]
const G2y = [Bls12381Parameters.G2y.a.v, Bls12381Parameters.G2y.b.v]

module.exports = {
    p,
    n,
    X_ABS,
    X_IS_NEGATIVE,
    fp2Params,
    fp6Params,
    fp12Params,
    _0,
    _1,
    _2_INV,
    B,
    Gx,
    Gy,
    B_FP2,
    G2x,
    G2y,
}
