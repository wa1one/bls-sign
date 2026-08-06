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

The final exponentiation uses the standard optimized easy-part/hard-part split (Hayashida–Hayasaka–Teruya decomposition over the cyclotomic subgroup), and `verify` runs a single merged product check, so a full `verify` takes on the order of 110 ms (see the Performance section below). The computed value is the cube of the textbook pairing — a bijection on the result subgroup, so all equality and verification semantics are identical; only raw pairing outputs compared against other libraries would differ.

#### Threshold signatures

A secret key can be split into `n` shares, any `k` of which are enough to reconstruct it (Shamir's Secret Sharing):

```js
// split secretKey into 5 shares, any 3 of which reconstruct it
const shares = secretKey.share(5, 3)

const recovered = new BLSSecretKey()
recovered.recover(shares.slice(0, 3))

recovered.s === secretKey.s // true
```

### Performance

Benchmarked against the actual packages published on npm, installed fresh with each version's own declared dependencies. Environment: Node v24.11.0, Apple M2 Pro. Times are the mean over repeated iterations after warmup. (0.13.12 was never published to npm and was code-identical to 0.13.11, so 0.13.11 stands in for it below.)

#### BN254 (alt_bn128, default curve)

| Operation | 0.13.11 | 0.13.13 | 0.13.14 | 0.13.15 |
| --- | --- | --- | --- | --- |
| `sign` | 0.76 ms | 0.70 ms | 0.72 ms | 0.71 ms |
| `verify` | 176 ms | 175 ms | 170 ms | **111 ms** |
| `getRandomPointOnEt` | 0.99 ms | 1.1 ms | 1.0 ms | 1.0 ms |
| `share(5, 3)` | 12 µs | 11 µs | 12 µs | 11 µs |
| secret `recover` (3 shares) | 2.5 µs | 3.3 µs | 2.6 µs | 2.4 µs |
| signature aggregation (3 shares) | 0.65 ms | 0.67 ms | 0.65 ms | 0.64 ms |

BN254 performance was flat from 0.13.11 through 0.13.14 — in particular, the `alg-field`/`alg-bn` 0.1.x → 0.2.x upgrade (which rewrote the field tower to be curve-parameterized) cost nothing on the default-curve path. 0.13.15 restructured `verify` into a single product check `e(−sQ, H) · e(Q, sH) == 1` over a merged multi-Miller loop, sharing one squaring chain and one final exponentiation across both pairings instead of running two independent pairing computations.

#### BLS12-381 (`BLSSigner.bls12381()`, added in 0.13.13)

| Operation | 0.13.13 | 0.13.14 | 0.13.15 | 0.13.16 |
| --- | --- | --- | --- | --- |
| first `bls12381()` call (one-time) | 0.91 s | 0.95 s | 0.94 s | **~2 ms** |
| `sign` | 0.73 ms | 0.77 ms | 0.75 ms | 0.75 ms |
| `verify` | 3.36 s | 183 ms | **113 ms** | 112 ms |
| signature aggregation (3 shares) | 0.69 ms | 0.68 ms | 0.69 ms | 0.69 ms |

The 18x `verify` speedup in 0.13.14 comes from replacing the generic 4314-bit final exponentiation with the optimized easy-part/hard-part split (Hayashida–Hayasaka–Teruya decomposition over the cyclotomic subgroup); 0.13.15 adds the same merged single-product verify as BN254. Verification on the two curves is now equally fast (~110 ms). Signing and aggregation are scalar-multiplication-bound and unaffected.

In 0.13.16 the extension-tower parameters (non-residue and all Frobenius coefficients) are hardcoded rather than derived by brute-force search on first use, eliminating the ~0.9 s one-time `bls12381()` cost; a unit test re-runs the generic derivation and asserts it still matches the hardcoded constants.

#### Module load time (fixed in 0.13.17)

Importing the library (`require('bls-sign')`) took ~1.4 s from 0.13.13 through 0.13.16, up from ~7 ms in 0.13.11: the `alg-field`/`alg-bn` 0.2.x dependencies derived their BN254 default tower parameters at import time with the same brute-force search, and `alg-bn` bundles its own copy of `alg-field`, paying the cost twice. Fixed upstream with the same hardcoded-constants treatment (`alg-field` 0.2.4, `alg-bn` 0.2.2, each guarded by a derivation-match unit test); as of 0.13.17, `require('bls-sign')` takes ~7 ms and the first `bls12381()` call ~6 ms.

Unpacked package size: 29 kB (0.13.11) → 43 kB (0.13.14), the increase being the BLS12-381 curve and pairing code.

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
