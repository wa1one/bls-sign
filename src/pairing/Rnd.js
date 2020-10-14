const crypto = require('crypto')

class CryptoRandom {
    nextBytes(ba) {
        if (!ba.length) return
        for (let i = 0; i < ba.length; ++i)
            ba[i] = crypto.randomBytes(1).readUInt8(0)
    }
}

module.exports = CryptoRandom
