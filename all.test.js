const { Field, Fp2, Fp6, Fp12 } = require('alg-field')
const { BN128Fp, BN128Fp2 } = require('./src/pairing/BN128')
const { PairingCheck } = require('./src/pairing/PairingCheck')

const {
    BLSSigner,
    BLSSecretKey,
    BLSSignature,
    BLSPublicKey,
    BLSPolynomial,
    Parameters,
} = require('./src')

describe('Fields', function () {
    test('Field without extensions test', function () {
        const _2 = new Field(2n)
        const _4 = new Field(4n)
        const _7 = new Field(7n)
        const _9 = new Field(9n)
        const _11 = new Field(11n)

        expect(_2.multiply(_2).eq(_4)).toBeTruthy()
        expect(_2.divide(_7).add(_9.divide(_7)).eq(_11.divide(_7))).toBeTruthy()
        expect(
            _2.multiply(_7).add(_9.multiply(_7)).eq(_11.multiply(_7))
        ).toBeTruthy()

        expect(_9.exp(Parameters.p).eq(_9)).toBeTruthy()

        expect(JSON.stringify(_9.bytes())).toEqual(JSON.stringify([9]))
    })

    test('Field extension 2 test', function () {
        const x = new Fp2(1n, 0n)
        const f = new Fp2(1n, 2n)
        const fpx = new Fp2(2n, 2n)
        const one = new Fp2(1n, 0n)
        expect(x.add(f).eq(fpx)).toBeTruthy()
        expect(f.divide(f).eq(one)).toBeTruthy()
        expect(
            one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
        ).toBeTruthy()
        expect(
            one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
        ).toBeTruthy()
        expect(x.exp(Parameters.p * Parameters.p - 1n).eq(one)).toBeTruthy()
    })

    test('Field extension 6 test', function () {
        const x = Fp6._1

        const f = new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n))
        const fpx = new Fp6(new Fp2(2n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n))
        const one = Fp6._1

        expect(x.add(f).eq(fpx)).toBeTruthy()
        expect(f.divide(f).eq(one)).toBeTruthy()
        expect(
            one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
        ).toBeTruthy()
        expect(
            one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
        ).toBeTruthy()
        expect(x.exp(Parameters.p * Parameters.p - 1n).eq(one)).toBeTruthy()
    })

    test('Field extension 12 test', function () {
        const x = Fp12._1

        const f = new Fp12(
            new Fp6(new Fp2(1n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n)),
            new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
        )

        const fpx = new Fp12(
            new Fp6(new Fp2(2n, 2n), new Fp2(3n, 4n), new Fp2(5n, 6n)),
            new Fp6(new Fp2(7n, 8n), new Fp2(9n, 10n), new Fp2(11n, 12n))
        )

        const one = Fp12._1

        expect(x.add(f).eq(fpx)).toBeTruthy()
        expect(f.divide(f).eq(one)).toBeTruthy()
        expect(
            one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
        ).toBeTruthy()
        expect(
            one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
        ).toBeTruthy()
    })
})

describe('Curves', function () {
    test('Curve point test', function () {
        const G = BN128Fp.create(1n, 2n)

        expect(G.double().eq(G.add(G))).toBeTruthy()

        expect(G.double().eq(G)).toBeFalsy()

        expect(G.isOnCurve()).toBeTruthy()

        const G2 = BN128Fp2.create(
            10857046999023057135944570762232829481370756359578518086990519993285655852781n,
            11559732032986387107991004021392285783925812861821192530917403151452391805634n,
            8495653923123431417604973247489272438418190587263600148770280649306958101930n,
            4082367875863433681332203403145435568316851327593401208105741076214120093531n
        )

        expect(G2.double().eq(G2.add(G2))).toBeTruthy()

        let pc = PairingCheck.create()

        pc.addPair(G, G2)
        pc.addPair(G, G2)

        pc.run()
        const pair = pc.result()

        pc = PairingCheck.create()

        pc.addPair(G.multiply(2n), G2)

        pc.run()

        expect(pair.eq(pc.result())).toBeTruthy()
    })

    const G2_GENERATOR = [
        10857046999023057135944570762232829481370756359578518086990519993285655852781n,
        11559732032986387107991004021392285783925812861821192530917403151452391805634n,
        8495653923123431417604973247489272438418190587263600148770280649306958101930n,
        4082367875863433681332203403145435568316851327593401208105741076214120093531n,
    ]

    test('create() rejects a point not on the curve', function () {
        expect(BN128Fp.create(1n, 3n)).toBeNull()
    })

    test('the zero point handles affine conversion without throwing', function () {
        expect(() => BN128Fp.ZERO.toAffine()).not.toThrow()
        expect(BN128Fp.ZERO.toAffine().isZero()).toBeTruthy()
        expect(BN128Fp.ZERO.toEthNotation().isZero()).toBeTruthy()

        // BN128Fp2.toAffine() used to call the undeclared local `zero` as a
        // function and crash with a TDZ ReferenceError
        expect(() => BN128Fp2.ZERO.toAffine()).not.toThrow()
        expect(BN128Fp2.ZERO.toAffine().isZero()).toBeTruthy()
        expect(BN128Fp2.ZERO.toEthNotation().isZero()).toBeTruthy()
    })

    test('isOnCurve/isValid accept valid points', function () {
        const G = BN128Fp.create(1n, 2n)
        expect(G.isOnCurve()).toBeTruthy()
        expect(G.isValid()).toBeTruthy()

        const G2 = BN128Fp2.create(...G2_GENERATOR)
        expect(G2.isOnCurve()).toBeTruthy()
        expect(G2.isValid()).toBeTruthy()
    })

    test('neg() produces the additive inverse', function () {
        const G = BN128Fp.create(1n, 2n)
        expect(G.add(G.neg()).isZero()).toBeTruthy()

        const G2 = BN128Fp2.create(...G2_GENERATOR)
        expect(G2.add(G2.neg()).isZero()).toBeTruthy()
    })

    test('multiply by 0 yields the identity point', function () {
        const G = BN128Fp.create(1n, 2n)
        expect(G.multiply(0n).isZero()).toBeTruthy()

        const G2 = BN128Fp2.create(...G2_GENERATOR)
        expect(G2.multiply(0n).isZero()).toBeTruthy()
    })

    test('point equality is invariant to Jacobian z-scaling', function () {
        const G = BN128Fp.create(1n, 2n)

        // these two compute the same affine point via different arithmetic
        // paths, so they end up with different z-coordinates
        const direct = G.multiply(5n)
        const viaAddition = G.multiply(2n).add(G.multiply(3n))

        expect(direct.z.eq(viaAddition.z)).toBeFalsy()
        expect(direct.eq(viaAddition)).toBeTruthy()
    })
})

describe('Signatures', function () {
    test('Signatures test', function () {
        const signer = new BLSSigner(256)

        const G = signer.G
        const G2 = signer.G2

        const Q = G.multiply(4n)
        const H = G2.multiply(5n)
        // next tests with desctiption as follow

        // -+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-

        console.log(`
        BLS Signature over EC pairings
        Q - fixed global 
        s - secret key 
        sQ - public key 
        H - message hash on G1 
        sH - signature 
        e: G1 x G2 -> Fp12
        sign(H, s) -> sH
        verify(H, sQ, sH) -> e(sQ, H(m)) = e(Q, s H(m))

        -+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-+*+-`)

        const s = new BLSSecretKey(2)
        const sQ = new BLSPublicKey(s, Q)
        const sH = s.sign(H)
        const sH2 = new BLSSecretKey(3).sign(H)

        console.log(`
        s ${s.toString()}
        sQ ${sQ.toString()}
        sH ${sH.toString()}
        sH2 ${sH2.toString()}
        Q ${Q.toString()}
        sQ ${sQ.toString()}
        H  ${H.toString()}
        sH ${sH.sH.toString()}
        sH2 ${sH2.sH.toString()}
`)
        expect(signer.verify(Q, H, sQ, sH)).toBeTruthy()
        expect(signer.verify(Q, H, sQ, sH2)).toBeFalsy()
    })

    test('getPublicKey derives the same key as the BLSPublicKey constructor', function () {
        const signer = new BLSSigner(256)
        const Q = signer.G.multiply(4n)

        const secretKey = new BLSSecretKey(2)
        const viaMethod = secretKey.getPublicKey(Q)
        const viaConstructor = new BLSPublicKey(secretKey, Q)

        expect(viaMethod.sQ.eq(viaConstructor.sQ)).toBeTruthy()
    })

    test('Threshold signatures test', function () {
        /*
         * Start testing threshold signature (k, n) - (3, 5)
         */
        const n = 5
        const k = 3

        const signer = new BLSSigner(256)

        const G = signer.G
        const G2 = signer.G2

        const Q = G.multiply(4n)
        const H = G2.multiply(5n)

        const prv0 = new BLSSecretKey()

        const sig0 = prv0.sign(H)
        const pub0 = new BLSPublicKey(prv0, Q)
        expect(signer.verify(Q, H, pub0, sig0)).toBeTruthy()

        const vec = prv0.share(n, k)

        const signVec = new Array(n)

        for (let i = 0; i < n; i++) {
            const H = signer.getRandomPointOnEt()
            signVec[i] = vec[i].sign(H)

            const pub = new BLSPublicKey(vec[i], Q)
            if (pub.sQ.eq(pub0.sQ)) {
                throw new Error('error pub key')
            }
            expect(signer.verify(Q, H, pub, signVec[i])).toBeTruthy()
        }

        // 3-n
        let prvVec = vec.slice(0, 3)

        let prv = new BLSSecretKey()
        prv.recover(prvVec)
        expect(prv.s).toEqual(prv0.s)

        // n-n
        prv = new BLSSecretKey()
        prv.recover(vec)
        expect(prv.s).toEqual(prv0.s)

        // 2-n (n = 5)
        prvVec = vec.slice(0, 2)
        prv = new BLSSecretKey()
        prv.recover(prvVec)
        expect(prv.s).not.toEqual(prv0.s)
    })
})

describe('BLSPolynomial', function () {
    test('eval evaluates the sharing polynomial at a given point', function () {
        // f(x) = 7 + 3x + 2x^2
        const msk = [{ s: 7n }, { s: 3n }, { s: 2n }]

        expect(BLSPolynomial.eval(msk, 0n)).toEqual(7n)
        expect(BLSPolynomial.eval(msk, 1n)).toEqual(12n)
        expect(BLSPolynomial.eval(msk, 2n)).toEqual(21n)
    })

    test('calcDelta rejects fewer than 2 ids and duplicate ids', function () {
        expect(() => BLSPolynomial.calcDelta([1])).toThrow()
        expect(() => BLSPolynomial.calcDelta([1, 1])).toThrow()
    })

    test('getMasterSecretKey validates k and keeps the original key as the constant term', function () {
        expect(() => new BLSSecretKey(5).getMasterSecretKey(1)).toThrow()
        expect(() => new BLSSecretKey(5).getMasterSecretKey(0)).toThrow()

        const sk = new BLSSecretKey(5)
        const msk = sk.getMasterSecretKey(3)
        expect(msk).toHaveLength(3)
        expect(msk[0]).toBe(sk)
    })
})

describe('Threshold signature aggregation', function () {
    test('3-of-5 and 5-of-5 recovered signatures equal the original signature and verify', function () {
        const signer = new BLSSigner(256)
        const Q = signer.G.multiply(4n)
        const H = signer.getRandomPointOnEt()

        const prv0 = new BLSSecretKey()
        const pub0 = new BLSPublicKey(prv0, Q)
        const directSig = prv0.sign(H)

        const vec = prv0.share(5, 3)

        const signVec3 = vec.slice(0, 3).map((share) => share.sign(H))
        const recovered3 = new BLSSignature().recover(signVec3)
        expect(recovered3.sH.eq(directSig.sH)).toBeTruthy()
        expect(signer.verify(Q, H, pub0, recovered3)).toBeTruthy()

        const signVec5 = vec.map((share) => share.sign(H))
        const recovered5 = new BLSSignature().recover(signVec5)
        expect(recovered5.sH.eq(directSig.sH)).toBeTruthy()
    })

    test('2-of-5 (below threshold) does not recover the original signature', function () {
        const signer = new BLSSigner(256)
        const H = signer.getRandomPointOnEt()

        const prv0 = new BLSSecretKey()
        const directSig = prv0.sign(H)

        const vec = prv0.share(5, 3)
        const signVec2 = vec.slice(0, 2).map((share) => share.sign(H))
        const recovered2 = new BLSSignature().recover(signVec2)

        expect(recovered2.sH.eq(directSig.sH)).toBeFalsy()
    })
})

describe('Signature security properties', function () {
    test('verify rejects a signature checked against the wrong message', function () {
        const signer = new BLSSigner(256)
        const Q = signer.G.multiply(4n)

        const sk = new BLSSecretKey()
        const pk = new BLSPublicKey(sk, Q)

        const H1 = signer.getRandomPointOnEt()
        const H2 = signer.getRandomPointOnEt()

        const sig = sk.sign(H1)

        expect(signer.verify(Q, H1, pk, sig)).toBeTruthy()
        expect(signer.verify(Q, H2, pk, sig)).toBeFalsy()
    })

    test('verify rejects a signature checked against the wrong public key', function () {
        const signer = new BLSSigner(256)
        const Q = signer.G.multiply(4n)
        const H = signer.getRandomPointOnEt()

        const skA = new BLSSecretKey()
        const skB = new BLSSecretKey()
        const pkB = new BLSPublicKey(skB, Q)

        const sigA = skA.sign(H)

        expect(signer.verify(Q, H, pkB, sigA)).toBeFalsy()
    })

    test('verify rejects a signature produced under a different global generator Q', function () {
        const signer = new BLSSigner(256)
        const Q1 = signer.G.multiply(4n)
        const Q2 = signer.G.multiply(7n)
        const H = signer.getRandomPointOnEt()

        const sk = new BLSSecretKey()
        const pkUnderQ1 = new BLSPublicKey(sk, Q1)
        const sig = sk.sign(H)

        expect(signer.verify(Q1, H, pkUnderQ1, sig)).toBeTruthy()
        expect(signer.verify(Q2, H, pkUnderQ1, sig)).toBeFalsy()
    })

    test('signing is deterministic for a given key and message', function () {
        const signer = new BLSSigner(256)
        const H = signer.getRandomPointOnEt()
        const sk = new BLSSecretKey(42)

        const sig1 = sk.sign(H)
        const sig2 = sk.sign(H)

        expect(sig1.sH.eq(sig2.sH)).toBeTruthy()
    })

    test('signing different messages with the same key produces different signatures', function () {
        const signer = new BLSSigner(256)
        const sk = new BLSSecretKey()

        const H1 = signer.getRandomPointOnEt()
        const H2 = signer.getRandomPointOnEt()

        const sig1 = sk.sign(H1)
        const sig2 = sk.sign(H2)

        expect(sig1.sH.eq(sig2.sH)).toBeFalsy()
    })

    test('different secret keys produce different public keys and signatures', function () {
        const signer = new BLSSigner(256)
        const Q = signer.G.multiply(4n)
        const H = signer.getRandomPointOnEt()

        const skA = new BLSSecretKey()
        const skB = new BLSSecretKey()

        expect(skA.s).not.toEqual(skB.s)

        const pkA = new BLSPublicKey(skA, Q)
        const pkB = new BLSPublicKey(skB, Q)
        expect(pkA.sQ.eq(pkB.sQ)).toBeFalsy()

        const sigA = skA.sign(H)
        const sigB = skB.sign(H)
        expect(sigA.sH.eq(sigB.sH)).toBeFalsy()
    })
})

describe('Threshold scheme parameter variations', function () {
    test('7-of-10: any 7 shares reconstruct the secret, 6 do not', function () {
        const prv0 = new BLSSecretKey()
        const vec = prv0.share(10, 7)

        const recovered7 = new BLSSecretKey()
        recovered7.recover(vec.slice(0, 7))
        expect(recovered7.s).toEqual(prv0.s)

        const recovered6 = new BLSSecretKey()
        recovered6.recover(vec.slice(0, 6))
        expect(recovered6.s).not.toEqual(prv0.s)
    })

    test('non-contiguous share subsets reconstruct the secret correctly', function () {
        const prv0 = new BLSSecretKey()
        const vec = prv0.share(6, 3)

        // ids 2, 4, 6 instead of the first 3
        const subset = [vec[1], vec[3], vec[5]]

        const recovered = new BLSSecretKey()
        recovered.recover(subset)
        expect(recovered.s).toEqual(prv0.s)
    })

    test('k equal to n requires every share to reconstruct the secret', function () {
        const prv0 = new BLSSecretKey()
        const vec = prv0.share(4, 4)

        const recoveredAll = new BLSSecretKey()
        recoveredAll.recover(vec)
        expect(recoveredAll.s).toEqual(prv0.s)

        const recoveredMissingOne = new BLSSecretKey()
        recoveredMissingOne.recover(vec.slice(0, 3))
        expect(recoveredMissingOne.s).not.toEqual(prv0.s)
    })

    test('minimum threshold k=2 works', function () {
        const prv0 = new BLSSecretKey()
        const vec = prv0.share(3, 2)

        const recovered = new BLSSecretKey()
        recovered.recover(vec.slice(0, 2))
        expect(recovered.s).toEqual(prv0.s)
    })
})

describe('Input validation', function () {
    test('BLSSecretKey(0) creates an explicit zero secret rather than a random one', function () {
        const sk = new BLSSecretKey(0)
        expect(sk.s).toEqual(0n)
    })

    test('BLSSecretKey() with no argument still generates a random secret', function () {
        const sk = new BLSSecretKey()
        expect(typeof sk.s).toBe('bigint')
    })

    test('share(n, k) rejects k > n', function () {
        const prv0 = new BLSSecretKey()
        expect(() => prv0.share(3, 5)).toThrow()
    })
})

describe('BLS12-381 curve', function () {
    const { BLS12Fp, BLS12Fp2 } = require('./src/pairing/BLS12381')
    const {
        BLS12381PairingCheck,
    } = require('./src/pairing/BLS12381PairingCheck')
    const bls12381Params = require('./src/pairing/bls12381Params')

    const G = BLS12Fp.create(bls12381Params.Gx, bls12381Params.Gy)
    const G2 = BLS12Fp2.create(...bls12381Params.G2x, ...bls12381Params.G2y)

    function pairing(p1, p2) {
        const pc = BLS12381PairingCheck.create()
        pc.addPair(p1, p2)
        pc.run()
        return pc.result()
    }

    test('G1/G2 generators are valid points of the expected group order', function () {
        expect(G).not.toBeNull()
        expect(G.isOnCurve()).toBeTruthy()
        expect(G.isValid()).toBeTruthy()
        expect(G.multiply(bls12381Params.n).isZero()).toBeTruthy()

        expect(G2).not.toBeNull()
        expect(G2.isOnCurve()).toBeTruthy()
        expect(G2.isValid()).toBeTruthy()
        expect(G2.multiply(bls12381Params.n).isZero()).toBeTruthy()
    })

    test('point arithmetic identities hold on both groups', function () {
        expect(G.double().eq(G.add(G))).toBeTruthy()
        expect(G.add(G.neg()).isZero()).toBeTruthy()
        expect(G.multiply(0n).isZero()).toBeTruthy()

        expect(G2.double().eq(G2.add(G2))).toBeTruthy()
        expect(G2.add(G2.neg()).isZero()).toBeTruthy()
        expect(G2.multiply(0n).isZero()).toBeTruthy()

        // eq() invariant to Jacobian z-scaling
        const direct = G.multiply(5n)
        const viaAddition = G.multiply(2n).add(G.multiply(3n))
        expect(direct.z.eq(viaAddition.z)).toBeFalsy()
        expect(direct.eq(viaAddition)).toBeTruthy()
    })

    test(
        'hardcoded tower constants match the generic derivation',
        function () {
            const {
                deriveFp2Params,
                deriveFp6Params,
                deriveFp12Params,
            } = require('alg-field')
            const d2 = deriveFp2Params(bls12381Params.p)
            const d6 = deriveFp6Params(d2)
            const d12 = deriveFp12Params(d6)

            expect(
                bls12381Params.fp2Params.nonResidue.eq(d2.nonResidue)
            ).toBeTruthy()
            d2.frobeniusCoeffsB.forEach((c, i) =>
                expect(
                    bls12381Params.fp2Params.frobeniusCoeffsB[i].eq(c)
                ).toBeTruthy()
            )

            expect(
                bls12381Params.fp6Params.nonResidue.eq(d6.nonResidue)
            ).toBeTruthy()
            d6.frobeniusCoeffsB.forEach((c, i) =>
                expect(
                    bls12381Params.fp6Params.frobeniusCoeffsB[i].eq(c)
                ).toBeTruthy()
            )
            d6.frobeniusCoeffsC.forEach((c, i) =>
                expect(
                    bls12381Params.fp6Params.frobeniusCoeffsC[i].eq(c)
                ).toBeTruthy()
            )

            d12.frobeniusCoeffsB.forEach((c, i) =>
                expect(
                    bls12381Params.fp12Params.frobeniusCoeffsB[i].eq(c)
                ).toBeTruthy()
            )
        },
        60000
    )

    test(
        'pairing is non-degenerate and bilinear',
        function () {
            const e1 = pairing(G, G2)
            const one = require('alg-field').Fp12.one(bls12381Params.fp12Params)
            expect(e1.eq(one)).toBeFalsy()

            const eSq = e1.multiply(e1)
            expect(pairing(G.multiply(2n), G2).eq(eSq)).toBeTruthy()
            expect(pairing(G, G2.multiply(2n)).eq(eSq)).toBeTruthy()
        },
        120000
    )

    test(
        'BLS signatures sign/verify on BLS12-381 via BLSSigner.bls12381()',
        function () {
            const signer = BLSSigner.bls12381(256)
            const Q = signer.G.multiply(4n)
            const H = signer.getRandomPointOnEt()

            const sk = new BLSSecretKey()
            const pk = new BLSPublicKey(sk, Q)
            const sig = sk.sign(H)

            expect(signer.verify(Q, H, pk, sig)).toBeTruthy()

            const wrongSig = new BLSSecretKey(sk.s + 1n).sign(H)
            expect(signer.verify(Q, H, pk, wrongSig)).toBeFalsy()
        },
        120000
    )

    test(
        'threshold signature aggregation works on BLS12-381',
        function () {
            const signer = BLSSigner.bls12381(256)
            const Q = signer.G.multiply(4n)
            const H = signer.getRandomPointOnEt()

            const sk = new BLSSecretKey()
            const pk = new BLSPublicKey(sk, Q)
            const directSig = sk.sign(H)

            const shares = sk.share(5, 3)
            const sigShares = shares.slice(0, 3).map((share) => share.sign(H))
            const recovered = new BLSSignature().recover(sigShares)

            expect(recovered.sH.eq(directSig.sH)).toBeTruthy()
            expect(signer.verify(Q, H, pk, recovered)).toBeTruthy()
        },
        120000
    )
})
