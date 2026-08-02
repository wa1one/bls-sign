const { Field, Fp2, Fp6, Fp12 } = require('alg-field')
const { BN128Fp, BN128Fp2 } = require('./src/pairing/BN128')
const { PairingCheck } = require('./src/pairing/PairingCheck')

const Pairing = require('./src/pairing/Pairing')

const {
    BLSSigner,
    BLSSecretKey,
    BLSSignature,
    BLSPublicKey,
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

        const vec = prv0.share(n, k)

        const signVec = new Array(n)

        for (let i = 0; i < n; i++) {
            const H = signer.getRandomPointOnEt()
            signVec[i] = vec[i].sign(H)

            const pub = new BLSPublicKey(vec[i], Q)
            if (pub == pub0) {
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
