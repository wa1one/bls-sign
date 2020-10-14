const bigInt = require('big-integer')

const { Field, Fp2, Fp6, Fp12, Parameters } = require('./src/pairing/Fields')
const { BN128Fp, BN128Fp2 } = require('./src/pairing/BN128')
const { PairingCheck } = require('./src/pairing/PairingCheck')

const Pairing = require('./src/pairing/Pairing')

describe('Fields', () => {
    test('Field without extensions test', () => {
        const _2 = new Field(bigInt('2'))
        const _4 = new Field(bigInt('4'))
        const _7 = new Field(bigInt('7'))
        const _9 = new Field(bigInt('9'))
        const _11 = new Field(bigInt('11'))

        expect(_2.multiply(_2).eq(_4)).toBeTruthy()
        expect(_2.divide(_7).add(_9.divide(_7)).eq(_11.divide(_7))).toBeTruthy()
        expect(
            _2.multiply(_7).add(_9.multiply(_7)).eq(_11.multiply(_7))
        ).toBeTruthy()
        expect(_9.exp(Parameters.p).eq(_9)).toBeTruthy()
        expect(JSON.stringify(_9.bytes()) == JSON.stringify([9])).toBeTruthy()
    })

    test('Field extension 2 test', () => {
        const _0 = bigInt('0')
        const _1 = bigInt('1')
        const _2 = bigInt('2')

        const x = new Fp2(_1, _0)
        const f = new Fp2(_1, _2)
        const fpx = new Fp2(_2, _2)
        const one = new Fp2(_1, bigInt.zero)
        expect(x.add(f).eq(fpx)).toBeTruthy()
        expect(f.divide(f).eq(one)).toBeTruthy()
        expect(
            one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
        ).toBeTruthy()
        expect(
            one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
        ).toBeTruthy()
        expect(x.exp(Parameters.p.pow(_2).subtract(_1)).eq(one)).toBeTruthy()
    })

    test('Field extension 6 test', () => {
        const _1 = bigInt('1')
        const _2 = bigInt('2')
        const _3 = bigInt('3')
        const _4 = bigInt('4')
        const _5 = bigInt('5')
        const _6 = bigInt('6')
        const x = Fp6._1

        const f = new Fp6(new Fp2(_1, _2), new Fp2(_3, _4), new Fp2(_5, _6))
        const fpx = new Fp6(new Fp2(_2, _2), new Fp2(_3, _4), new Fp2(_5, _6))
        const one = Fp6._1

        expect(x.add(f).eq(fpx)).toBeTruthy()
        expect(f.divide(f).eq(one)).toBeTruthy()
        expect(
            one.divide(f).add(x.divide(f)).eq(one.add(x).divide(f))
        ).toBeTruthy()
        expect(
            one.multiply(f).add(x.multiply(f)).eq(one.add(x).multiply(f))
        ).toBeTruthy()
        expect(x.exp(Parameters.p.pow(_2).subtract(_1)).eq(one)).toBeTruthy()
    })

    test('Field extension 12 test', () => {
        const _1 = bigInt('1')
        const _2 = bigInt('2')
        const _3 = bigInt('3')
        const _4 = bigInt('4')
        const _5 = bigInt('5')
        const _6 = bigInt('6')
        const _7 = bigInt('7')
        const _8 = bigInt('8')
        const _9 = bigInt('9')
        const _10 = bigInt('10')
        const _11 = bigInt('11')
        const _12 = bigInt('12')

        const x = Fp12._1

        const f = new Fp12(
            new Fp6(new Fp2(_1, _2), new Fp2(_3, _4), new Fp2(_5, _6)),
            new Fp6(new Fp2(_7, _8), new Fp2(_9, _10), new Fp2(_11, _12))
        )

        const fpx = new Fp12(
            new Fp6(new Fp2(_2, _2), new Fp2(_3, _4), new Fp2(_5, _6)),
            new Fp6(new Fp2(_7, _8), new Fp2(_9, _10), new Fp2(_11, _12))
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

describe('Curves', () => {
    test('Curve point test', () => {
        const G = BN128Fp.create(bigInt('1'), bigInt('2'))

        expect(G.double().eq(G.add(G))).toBeTruthy()

        expect(G.double().eq(G)).toBeFalsy()

        expect(G.isOnCurve()).toBeTruthy()
        const G2 = BN128Fp2.create(
            bigInt(
                '10857046999023057135944570762232829481370756359578518086990519993285655852781'
            ),
            bigInt(
                '11559732032986387107991004021392285783925812861821192530917403151452391805634'
            ),
            bigInt(
                '8495653923123431417604973247489272438418190587263600148770280649306958101930'
            ),
            bigInt(
                '4082367875863433681332203403145435568316851327593401208105741076214120093531'
            )
        )

        expect(G2.double().eq(G2.add(G2))).toBeTruthy()

        let pc = PairingCheck.create()

        pc.addPair(G, G2)
        pc.addPair(G, G2)

        pc.run()
        let pair = pc.result()

        pc = PairingCheck.create()

        pc.addPair(G.multiply(bigInt('2')), G2)

        pc.run()

        let pair2 = pc.result()
        console.log(pair.eq(pair2))
    })
})
