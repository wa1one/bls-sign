module.exports = {
    randomBytes(byteLength) {
        const buf = new Uint8Array(byteLength)
        const cryptoObj = typeof self !== 'undefined' ? self.crypto : window.crypto
        cryptoObj.getRandomValues(buf)
        return buf
    },
}
