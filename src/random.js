const crypto = require('crypto')

function bitLength(n) {
    if (typeof n === 'number') n = BigInt(n)
    if (n === 1n) return 1
    let bits = 1
    do {
        bits++
    } while ((n >>= 1n) > 1n)
    return bits
}

function randBytesSync(byteLength, forceLength = false) {
    if (byteLength < 1) throw new RangeError('byteLength MUST be > 0')
    const buf = crypto.randomBytes(byteLength)
    if (forceLength) buf[0] = 128 | buf[0]
    return buf
}

function randBitsSync(bitLen, forceLength = false) {
    if (bitLen < 1) throw new RangeError('bitLength MUST be > 0')
    const buf = randBytesSync(Math.ceil(bitLen / 8), false)
    const remainder = bitLen % 8
    if (remainder !== 0) buf[0] = buf[0] & (2 ** remainder - 1)
    if (forceLength) {
        const mask = remainder !== 0 ? 2 ** (remainder - 1) : 128
        buf[0] = buf[0] | mask
    }
    return buf
}

function fromBuffer(buf) {
    let ret = 0n
    for (const byte of buf.values()) {
        ret = (ret << 8n) + BigInt(byte)
    }
    return ret
}

function randBetween(max, min = 1n) {
    if (max <= min) throw new RangeError('Arguments MUST be: max > min')
    const interval = max - min
    const bitLen = bitLength(interval)
    let rnd
    do {
        rnd = fromBuffer(randBitsSync(bitLen))
    } while (rnd > interval)
    return rnd + min
}

module.exports = { randBytesSync, randBetween }
