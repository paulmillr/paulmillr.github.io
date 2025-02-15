---
layout: post
title: "Deterministic signatures are not your friends"
tags: ["programming"]
highlight: true
---

Deterministic signatures are praised as the pinnacle of Elliptic Curve Cryptography.
ed25519 uses them. RFC 6979 spec describes them.
They eliminate the whole class of issues with "bad randomness".

Turns out, with [recent CVE in elliptic.js](https://github.com/indutny/elliptic/security/advisories/GHSA-vjh7-7g9h-fjfh),
which allowed attackers to extract private keys, full determinism is not great.

- [How signatures are made?](#how-signatures-are-made)
- [Extracting keys using bad randomness](#extracting-keys-using-bad-randomness)
- [Extracting keys using fault attacks](#extracting-keys-using-fault-attacks)
- [Hedged signatures for the rescue](#hedged-signatures-for-the-rescue)
- [Conclusion](#conclusion)

## How signatures are made?

Implementing digital signatures from scratch is simple,
i've described it in previous article: [Learning fast elliptic-curve cryptography](https://paulmillr.com/posts/noble-secp256k1-fast-ecc/).

Signatures are usually either random or deterministic.
"Random" means using pair (privkey=`d`, message=`m`) would always generate new signature.
"Deterministic" means (`d`, `m`) would always generate the same signature.

Let's recall their shortened formulas.

- _inputs_: `d` is a private key, `m` is a message to sign
- _methods_: `rand` is function producing secure randomness, `hash` is a hashing function,
  `combine` is [HMAC-DRBG](https://en.wikipedia.org/wiki/NIST_SP_800-90A)
- _operations_: `G × k` is elliptic curve scalar multiplication, `||` is byte concatenation, `⋅` is multiplication

ECDSA:

    k = rand() # a: random
    k = combine(d, m) # b: deterministic, RFC 6979
    R = G × k
    r = R.x mod n
    s = k^-1 ⋅ (m + d⋅r) mod n
    sig = r || s

Schnorr from BIP340:

    A = G × d
    t = d ^ hash(rand())
    k = hash(t || A || m) mod n
    R = G × k
    e = hash(R || A || m) mod n
    s = (k + e⋅d) mod n
    sig = R || s

EdDSA ed25519 from RFC 8032:

    h = hash(d)
    d_ = h[0..32]
    t = h[32..64]
    A = G × d_
    k = hash(t || m)
    R = G × k
    e = hash(R || A || m)
    s = (k + e⋅d_) mod n
    sig = R || s

## Extracting keys using bad randomness

Before deterministic signatures became popular, signatures were produced with randomness
Every time anyone signed anything, a random sequence of bytes `k` (also known as "nonce") was generated.
Then, `k` was used to produce a signature:

    k = rand()

However, "random generation of k" is non-trivial task.
In short, random k must always be **unpredictable** and **not previously used**.
This could be achieved using ["cryptographically secure random" (CSPRNG)](https://en.wikipedia.org/wiki/Cryptographically_secure_pseudorandom_number_generator).
Which means, for example, one could not have used JS `Math.random()` - a
[whole different algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
was required.

_“What happens if randomness is predictable?”_

Predictable nonce `k` allows an attacker to extract private key from the signature:

    d = (r^-1)(s⋅k-m) mod n

_“What happens if randomness is reused?”_

Reusing random nonce `k` allows attacker to extract private keys from two distinct signatures:

    (s1-s2)   == (k^-1)(z1-z2)
    k⋅(s1-s2) == (z1-z2)
    k == (z1−z2)⋅(s1−s2)^-1
    s == (k^-1)⋅(z+r⋅x)
    x == (r^-1)⋅(s⋅k−z)
    where s1, s2 are s from sigs 1, 2; and
    all operations are mod n

After that, people invented and popularized deterministic signatures.

## Extracting keys using fault attacks

Deterministic signatures guard against bad randomness.
They produce `k` from private key `d` and message `m`:

    k = combine(d, m)

_Note: RFC 6979 uses HMAC-DRBG for combine, but if it was created later, it could have used simpler HKDF instead._

On the other hand, determinism makes them vulnerable to fault injection attacks.
If something wrong happens during `combine`, resulting in duplicate nonce `k`
getting produced for two distinct inputs, then it's just as bad as "bad randomness"
was.

Let's illustrate how RFC6979 fault injection could look in JS:

    k_bytes = combine_hmac_drbg(d, m)
    k = num(k_bytes)
    R = G.multiply(k) # multiply() only consumes num
    r = mod(R.x, n)
    s = mod(inv(k) * mod(m + d⋅r, n), n)

    // the buggy function which converts JS Uint8Array to bigint
    const num = (bytes) => BigInt('0x' + Array.from(bytes).map(b => b.toString(16)).join(''))
    // num(Uint8Array([1, 2, 15, 16, 255]))
    // expected: "01020f10ff", actual: "102f10ff"

In this example, `num` generates identical outputs for distinct inputs `[1, 1, 30]` and `[17, 30]`.

All attacker needs to do is convincing a user to sign two distinct specifically manipulated messages.
Those would produce signatures with identical `k`, which means an attacker would be able to
extract private key from them.

In a real world, there are all kinds of places where a subtle bug can happen.
Type-to-other-type conversion methods; byte fiddling routines, etc.

Another kind of fault attack is a "hardware error".
Attacker utilizes physical access to hardware (for example, to CPU, or a smart card),
and induces interference into device behavior.
This could be done using a voltage spike, a laser, or something else.
The result is the same: an error during sig generation.

## Hedged signatures for the rescue

Hedged ("noisy" / "extra entropy") signatures combine both approaches.
They generate k deterministically, then incorporate randomness into it.

Let's look again at hedged signatures in RFC 6979:

    rnd = rand()
    k_bytes = combine_hmac_drbg(d, m, rnd)
    k = num(k_bytes)

Randomness is incorporated into DRBG, and is then fed into `hash`.

_“What if fault attack happens in a hedged sig?”_

The generated randomness would still produce new random valid signature,
without leaking `k`:

    rnd = rand()
    k_bytes = combine_hmac_drbg(d, m, rnd)
    k = num(k_bytes)
    # still ok: combine() would have failed for d, m
    # but is saved by `rnd`

_“What if bad randomness is used in a hedged sig?”_

_“What if nonce is reused in a hedged sig?”_

The deterministic part would still produce new random valid signature,
also without leaking `k`:

    rnd = 000000000...
    k_bytes = combine_hmac_drbg(d, m, rnd)
    k = num(k_bytes)
    # still ok: combine() worked for d, m

So, to break hedged signatures, an attacker would need to break _both_ randomness
generator and inject a fault into generation process.

What about adoption?

- [RFC 6979](https://datatracker.ietf.org/doc/html/rfc6979) actually describes hedging [in section 3.6](https://datatracker.ietf.org/doc/html/rfc6979#section-3.6)! Libraries also do: for example, libsecp256k1 had it [since 2015](https://github.com/bitcoin-core/secp256k1/pull/229)
- [BIP 340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) authors also made a wise decision, incorporating hedging by default
- [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) ed25519 does not support hedged signatures, however,
  Signal made an effort and created [XEdDSA](https://signal.org/docs/specifications/xeddsa/).
  [Apple followed Signal](<https://developer.apple.com/documentation/cryptokit/curve25519/signing/privatekey/signature(for:)>)
  and added hedged ed25519 to both CryptoKit and its Safari implementation of webcrypto.
- While testing against fully random signatures was complicated, hedged signatures are simpler:
  to verify something against a pre-generated set of vectors, you would to explicitly specify randomness,
  instead of fetching it from CSPRNG.

## Conclusion

Always try to use hedged signatures. There is no disadvantage in doing so.
You would gain security against all kinds of bugs in signature generation process.
After all, we can never be certain if there is a bug.

I've created [noble cryptography](https://paulmillr.com/noble/) in 2019
to improve security of JS ecosystem.
[noble-curves](https://github.com/paulmillr/noble-curves) implement
hedged ECDSA, XEdDSA and BIP340.
Feel free to copy the logic, use and re-distribute the code.
