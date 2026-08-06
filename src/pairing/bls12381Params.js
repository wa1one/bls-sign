const { Field, Fp2 } = require('alg-field')
const { Bls12381Parameters } = require('alg-bn')

const p = Bls12381Parameters.p
const n = Bls12381Parameters.n

// BLS x parameter (x = -0xd201000000010000), independently verified against
// the published curve order/prime via their defining polynomials:
//   r(x) = x^4 - x^2 + 1
//   p(x) = (x-1)^2 * (x^4-x^2+1) / 3 + x
const X_ABS = 0xd201000000010000n
const X_IS_NEGATIVE = true

// --- Extension-tower parameters, hardcoded ---
//
// These are exactly what alg-field's deriveFp2Params / deriveFp6Params /
// deriveFp12Params produce for this p, precomputed because the generic
// derivation brute-forces the sextic non-residue and exponentiates for every
// Frobenius coefficient (~0.9 s at first use). A unit test re-runs the
// generic derivation and asserts it still matches these constants.

const fp2Params = {
    p,
    // quadratic non-residue: -1 (p = 3 mod 4)
    nonResidue: new Field(p - 1n, p),
    frobeniusCoeffsB: [new Field(1n, p), new Field(p - 1n, p)],
}

const fp2 = (a, b) => new Fp2(a, b, fp2Params)

// recurring Frobenius-coefficient values (xi^((p^k-1)/3) components)
const K1 =
    0x1a0111ea397fe699ec02408663d4de85aa0d857d89759ad4897d29650fb85f9b409427eb4f49fffd8bfd00000000aaacn
const K2 =
    0x5f19672fdf76ce51ba69c6076a0f77eaddb3a93be6f89688de17d813620a00022e01fffffffefffen

const fp6Params = {
    p,
    // sextic non-residue: xi = 1 + u
    nonResidue: fp2(1n, 1n),
    frobeniusCoeffsB: [
        fp2(1n, 0n),
        fp2(0n, K1),
        fp2(K2, 0n),
        fp2(0n, 1n),
        fp2(K1, 0n),
        fp2(0n, K2),
    ],
    frobeniusCoeffsC: [
        fp2(1n, 0n),
        fp2(K1 + 1n, 0n),
        fp2(K1, 0n),
        fp2(p - 1n, 0n),
        fp2(K2, 0n),
        fp2(K2 + 1n, 0n),
    ],
}

// Fp12 Frobenius coefficients (xi^((p^k-1)/6)); entries 7, 9, 11 are the
// component swaps of entries 1, 3, 5
const F1a =
    0x1904d3bf02bb0667c231beb4202c0d1f0fd603fd3cbd5f4f7b2443d784bab9c4f67ea53d63e7813d8d0775ed92235fb8n
const F1b =
    0xfc3e2b36c4e03288e9e902231f9fb854a14787b6c7b36fec0c8ec971f63c5f282d5ac14d6c7ec22cf78a126ddc4af3n
const F3a =
    0x135203e60180a68ee2e9c448d77a2cd91c3dedd930b1cf60ef396489f61eb45e304466cf3e67fa0af1ee7b04121bdea2n
const F3b =
    0x6af0e0437ff400b6831e36d6bd17ffe48395dabc2d3435e77f76e17009241c5ee67992f72ec05f4c81084fbede3cc09n
const F5a =
    0x144e4211384586c16bd3ad4afa99cc9170df3560e77982d0db45f3536814f0bd5871c1908bd478cd1ee605167ff82995n
const F5b =
    0x5b2cfd9013a5fd8df47fa6b48b1e045f39816240c0b8fee8beadf4d8e9c0566c63a3e6e257f87329b18fae980078116n

const fp12Params = {
    p,
    frobeniusCoeffsB: [
        fp2(1n, 0n),
        fp2(F1a, F1b),
        fp2(K2 + 1n, 0n),
        fp2(F3a, F3b),
        fp2(K2, 0n),
        fp2(F5a, F5b),
        fp2(p - 1n, 0n),
        fp2(F1b, F1a),
        fp2(K1, 0n),
        fp2(F3b, F3a),
        fp2(K1 + 1n, 0n),
        fp2(F5b, F5a),
    ],
    fp6Params,
}

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
