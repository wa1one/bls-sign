# bls-sign

npm: [bls-sign](https://www.npmjs.com/package/bls-sign) (legacy, unscoped) · [@wa1one/bls-sign](https://www.npmjs.com/package/@wa1one/bls-sign) (current)

### This package is still being downloaded ~10 times a week after 6 years! I decided to publish some small updates using new AI features.

### Boneh–Lynn–Shacham signature scheme

The Boneh–Lynn–Shacham (BLS) signature scheme allows a user to verify that a signer is authentic. The scheme uses a bilinear pairing for verification, and signatures are elements of an elliptic curve group. Working in an elliptic curve group provides some defense against index calculus attacks, allowing shorter signatures than FDH signatures for a similar level of security. Signatures produced by the BLS signature scheme are often referred to as short signatures, BLS short signatures, or simply BLS signatures. The signature scheme is provably secure (it is existentially unforgeable under adaptive chosen-message attacks), assuming both the existence of random oracles and the intractability of the computational Diffie–Hellman problem in a gap Diffie–Hellman group.

### Usage

```
npm install @wa1one/bls-sign
```

```js
const { BLSSigner, BLSSecretKey, BLSPublicKey } = require('@wa1one/bls-sign')

const signer = new BLSSigner(256)

// Q is a fixed global generator on G2; H is the message hashed onto the curve
const Q = signer.G.multiply(4n)
const H = signer.getRandomPointOnEt()

const secretKey = new BLSSecretKey()
const publicKey = new BLSPublicKey(secretKey, Q)
const signature = secretKey.sign(H)

signer.verify(Q, H, publicKey, signature) // true
```

#### Threshold signatures

A secret key can be split into `n` shares, any `k` of which are enough to reconstruct it (Shamir's Secret Sharing):

```js
// split secretKey into 5 shares, any 3 of which reconstruct it
const shares = secretKey.share(5, 3)

const recovered = new BLSSecretKey()
recovered.recover(shares.slice(0, 3))

recovered.s === secretKey.s // true
```

### The Scheme

```
 e : G2 x G1 -> Fp12 ; ate pairing over BN curve
 Q in G2 ; fixed global parameter
 H : {str} -> G1
 s in Fr: secret key
 sQ in G2; public key
 s H(m) in G1; signature of m
 verify ; e(sQ, H(m)) = e(Q, s H(m))
```

#### Shamir Secret Sharing and Lagrange Interpolation

Shamir's Secret Sharing is an algorithm in cryptography created by Adi Shamir. It is a form of secret sharing where a secret is divided into parts, giving each participant its own unique part. Some or all of the parts are needed in order to reconstruct the secret.

Counting on all participants to combine the secret might be impractical, so the threshold scheme is sometimes used instead, where any k of the parts is sufficient to reconstruct the original secret.

![alt text](https://media.geeksforgeeks.org/wp-content/uploads/20200415120740/math4.png)

### Build

```
npm run build
```

### Run tests

```
npm run test
```

Curves are compatible with Ethereum.
