# bls-sign

npm: [bls-sign](https://www.npmjs.com/package/bls-sign)

### This package is still being downloaded ~10 times a week after 6 years! I decided to publish some small updates using new AI features.

### Changelog

Highlights from the latest round of fixes and cleanup:

- **Fixed threshold signature aggregation** (`BLSSignature.recover`) — it threw on any call, because it used raw arithmetic operators on elliptic-curve point objects instead of their `.multiply()`/`.add()` methods.
- **Fixed several curve-point bugs**: `BN128Fp2.toAffine()` crashed on the identity/zero point; `isValid()` had a dead type check that never actually validated anything; `eq()` compared raw Jacobian coordinates and could report two mathematically-equal points as unequal.
- **Fixed `BLSSecretKey.getPublicKey()`** — previously always threw; now correctly delegates to `BLSPublicKey`.
- **Removed the `bigint-crypto-utils` dependency** — `randBytesSync`/`randBetween` are now implemented locally (backed by Node's `crypto.randomBytes`, with a Web Crypto API fallback for the browser bundle), verified against the original implementation for identical behavior.
- **Fixed the browser bundle** — Babel's transform of the `**` exponentiation operator doesn't support `BigInt` operands, which silently broke `share()` and the random-point helpers whenever the library was bundled for the browser. Rewritten to avoid `**` on `BigInt` values entirely.
- **`BLSSigner` and `Pairing.ate()` now accept optional parameters** for the curve's fixed generator points and pairing loop constants (previously hardcoded), while staying backward compatible with existing calls.
- **Added BLS12-381 curve support** via `BLSSigner.bls12381()` — a from-scratch optimal ate pairing over BLS12-381's M-type sextic twist, verified for non-degeneracy and bilinearity. alt_bn128 (BN254) remains the default; existing code is unaffected.
- Added comprehensive test coverage (7 → 37 tests) and full API documentation (this README).

### Boneh–Lynn–Shacham signature scheme

The Boneh–Lynn–Shacham (BLS) signature scheme allows a user to verify that a signer is authentic. The scheme uses a bilinear pairing for verification, and signatures are elements of an elliptic curve group. Working in an elliptic curve group provides some defense against index calculus attacks, allowing shorter signatures than FDH signatures for a similar level of security. Signatures produced by the BLS signature scheme are often referred to as short signatures, BLS short signatures, or simply BLS signatures. The signature scheme is provably secure (it is existentially unforgeable under adaptive chosen-message attacks), assuming both the existence of random oracles and the intractability of the computational Diffie–Hellman problem in a gap Diffie–Hellman group.

### Usage

```
npm install bls-sign
```

```js
const { BLSSigner, BLSSecretKey, BLSPublicKey } = require('bls-sign')

const signer = new BLSSigner(256)

// Q is a fixed global generator on G1; H is the message hashed onto G2
const Q = signer.G.multiply(4n)
const H = signer.getRandomPointOnEt()

const secretKey = new BLSSecretKey()
const publicKey = new BLSPublicKey(secretKey, Q)
const signature = secretKey.sign(H)

signer.verify(Q, H, publicKey, signature) // true
```

#### Using the BLS12-381 curve

The default curve is alt_bn128 (BN254), matching Ethereum's precompiles. A signer over BLS12-381 (the curve used by Ethereum consensus, Zcash, Chia, and filecoin) works identically:

```js
const signer = BLSSigner.bls12381(256)

const Q = signer.G.multiply(4n)
const H = signer.getRandomPointOnEt()

const secretKey = new BLSSecretKey()
const publicKey = new BLSPublicKey(secretKey, Q)

signer.verify(Q, H, publicKey, secretKey.sign(H)) // true
```

Note: the BLS12-381 pairing currently uses a generic (unoptimized) final exponentiation, so `verify` takes a few seconds — fine for experimentation, not for high-throughput use.

#### Threshold signatures

A secret key can be split into `n` shares, any `k` of which are enough to reconstruct it (Shamir's Secret Sharing):

```js
// split secretKey into 5 shares, any 3 of which reconstruct it
const shares = secretKey.share(5, 3)

const recovered = new BLSSecretKey()
recovered.recover(shares.slice(0, 3))

recovered.s === secretKey.s // true
```

### API

#### `BLSSigner`

Holds the curve's fixed generator points and provides the top-level sign/verify helpers.

- `new BLSSigner(bitLength, G, G2, PairingCheckImpl, fieldPrime)` — creates `G` (a generator point on G1) and `G2` (a generator point on G2); both default to alt_bn128's standard generators and can be overridden, along with the pairing implementation and base-field prime. `bitLength` is currently unused.
- `BLSSigner.bls12381(bitLength)` — factory returning a signer over the BLS12-381 curve (standard generators, M-type-twist optimal ate pairing) instead of the default alt_bn128.
- `.G`, `.G2` — the fixed generator points.
- `.getRandomPointOnE()` — a random scalar multiple of `G` (a random point on G1).
- `.getRandomPointOnEt()` — a random scalar multiple of `G2` (a random point on G2); typically used as the "message" point `H`.
- `.sign(H, s)` — low-level signing: returns `H.multiply(s)`, a raw point (not a `BLSSignature`). For normal use prefer `BLSSecretKey.sign(H)` below.
- `.verify(Q, H, sQ, sH)` — checks `e(sQ, H) === e(Q, sH)`. `sQ` must be a `BLSPublicKey`, `sH` a `BLSSignature`.
- `.getPairing()`, `.getParameters()` — currently always return `undefined`; unimplemented.

#### `BLSSecretKey`

- `new BLSSecretKey(s)` — wraps a secret scalar. If `s` is omitted, generates a random one-byte secret (0-255).
- `.toString()`
- `.getPublicKey(Q)` — derives this key's `BLSPublicKey` for generator `Q`.
- `.sign(H)` — signs point `H`, returning a `BLSSignature`.
- `.getMasterSecretKey(k)` — builds the `k` coefficients of a degree `k-1` sharing polynomial with `this` as the constant term (the secret). Throws if `k <= 1`.
- `.share(n, k)` — Shamir's Secret Sharing: splits the secret into `n` shares (ids `1..n`) drawn from a degree `k-1` polynomial; any `k` of the returned shares can reconstruct the secret. Throws if `k > n`.
- `.recover(vec)` — reconstructs the secret from an array of shares via Lagrange interpolation and sets `this.s` (`this.id` becomes `0`). Passing fewer than `k` shares does not throw — it silently produces a different, wrong secret, so callers are responsible for gathering enough shares.

#### `BLSPublicKey`

- `new BLSPublicKey(secretKey, Q)` — computes `sQ = Q.multiply(secretKey.s)`.
- `.toString()`

#### `BLSSignature`

- `.toString()`
- `.recover(signVec)` — combines an array of partial signatures (each produced by a key share's `.sign()`) into one valid signature via Lagrange interpolation, without ever reconstructing the underlying secret key. Same "fewer than `k` shares silently gives a wrong result" caveat as `BLSSecretKey.recover`.

`BLSSignature` instances are normally produced by `BLSSecretKey.sign()` / `BLSSignature.recover()`, not constructed directly.

#### `BLSPolynomial`

Internal helper backing the threshold-sharing methods above:

- `.eval(msk, x)` — evaluates the sharing polynomial (coefficients `msk`, each with an `.s`) at `x`.
- `.calcDelta(ids)` — computes the Lagrange basis coefficients at `x = 0` for an array of share ids. Throws if fewer than 2 ids are given, or if two ids are equal.
- `.lagrange(vec)` — reconstructs either a secret scalar (if entries have `.s`) or an aggregated signature point (if entries have `.sH`) via Lagrange interpolation at `x = 0`.

#### `Parameters`

Re-exported from `alg-field`: the curve's field parameters — `Parameters.p` (the base field prime) and `Parameters.n` (the curve/group order).

### The Scheme

```
 e : G1 x G2 -> Fp12 ; ate pairing over BN curve
 Q in G1 ; fixed global parameter
 H : {str} -> G2
 s in Fr: secret key
 sQ in G1; public key
 s H(m) in G2; signature of m
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
