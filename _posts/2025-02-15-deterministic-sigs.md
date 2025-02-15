---
layout: post
title: "Deterministic signatures are not your friends"
tags: ["programming"]
highlight: true
---

Deterministic signatures are praised as pinnacle of Elliptic Curve Digital Signature Algorithm.
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

Signatures can usually be random, or deterministic.
Determinism in context of signatures means same inputs would always produce same outputs.
If a private key `d` signs message `m`, the result output `sig` would always be the same.

Let's recall their formulas.
_Formulas are shortened, consult specs for full ones_.
`d` is a private key, `m` is a message to sign.

ECDSA:

    k = rand() # a: random
    k = hmac_drbg(d, m) # b: deterministic, RFC 6979
    (x_1, y_1) = G × k
    r = x_1 mod n
    s = k^-1 ⋅ (m + d⋅r) mod n
    sig = r || s

BIP340 Schnorr:

    A = G × d
    t = d ^ hash(rand())
    k = hash(t || A || m) mod n
    R = G × k
    e = hash(R || A || m) mod n
    s = (k + e⋅d) mod n
    sig = R || s

EdDSA (ed25519):

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

Before deterministic sigs became popular, they were produced with randomness.
Every time anyone signed anything, a random sequence of bytes `k` was generated.
Then, `k` was used to produce a signature:

    k = rand()

However, "random generation of k" is non-trivial task.
In short, random k must always be **unpredictable** and **not previously used**.

This could be achieved using ["cryptographically secure random" (CSPRNG)](https://en.wikipedia.org/wiki/Cryptographically_secure_pseudorandom_number_generator).
Which means, for example, one could not have used JS `Math.random()` - a
[whole different algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
was required.

> What happens if randomness is predictable?

TODO

> What happens if randomness is reused?

TODO

After that, people invented and popularized deterministic signatures

## Extracting keys using fault attacks

Fully deterministic signatures are vulnerable to fault injection attacks.

Here's an example using our ECDSA.b formula above with `k = hmac_drbg(d, m)`:

TODO

## Hedged signatures for the rescue

Hedged ("noisy" / "extra entropy") signatures combine both approaches.
They generate k deterministically, then incorporate randomness into it.

> What if fault attack happens in a hedged signature scheme?

The generated randomness would still produce new random valid signature,
without leaking `k`.

> What if bad randomness is used in hedged signature scheme?
> What happens if random nonce is **reused**?

The deterministic part would still produce new random valid signature,
also without leaking `k`.

So, to break hedged signatures, an attacker would need to break _both_ randomness
generator and inject a fault into generation process. Sounds good, but what about adoption?

- [RFC 6979](https://datatracker.ietf.org/doc/html/rfc6979) actually describes hedging [in section 3.6](https://datatracker.ietf.org/doc/html/rfc6979#section-3.6)! Libraries also do: for example, libsecp256k1 had it [since 2015](https://github.com/bitcoin-core/secp256k1/pull/229)
- [BIP 340](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki) authors also made a wise decision, incorporating hedging by default
- [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) ed25519 does not support hedged signatures, however,
  Signal made an effort and created [XEdDSA](https://signal.org/docs/specifications/xeddsa/).
  [Apple followed Signal](<https://developer.apple.com/documentation/cryptokit/curve25519/signing/privatekey/signature(for:)>)
  and added hedged ed25519 to both CryptoKit and its Safari implementation of webcrypto.
- While testing against fully random signatures was complicated, hedged signatures are simpler:
  to verify something against pre-generated set of vectors, you would to explicitly specify randomness,
  instead of fetching it from CSPRNG.

## Conclusion

Try to always use hedged signatures. There is no disadvantage of doing so.
You would gain security against all kinds of bugs in signature generation process.
After all, we could never be certain if there is a bug, or not.

[noble-curves](https://paulmillr.com/noble/) and its 4kb sister projects [noble-secp256k1, noble-ed25519](https://paulmillr.com/noble/)
already implement hedged ECDSA, EdDSA and BIP340.
The libraries are open-source, so feel free to copy its logic into your own implementations.
