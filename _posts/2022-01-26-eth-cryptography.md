---
layout: post
title: "A safer, smaller, and faster Ethereum cryptography stack"
tags: ['programming']
---

Originally posted on [medium.com/nomic-foundation-blog/a-safer-smaller-and-faster-ethereum-cryptography-stack-5eeb47f62d79](https://medium.com/nomic-foundation-blog/a-safer-smaller-and-faster-ethereum-cryptography-stack-5eeb47f62d79) with over 400 likes.

**We’ve published a revamped release of ethereum-cryptography.**

In Q4 2020, the Nomic Labs team [released and deployed ethereum-cryptography](https://medium.com/nomic-labs-blog/turning-a-page-in-ethereum-javascript-history-4ec89136fccc) to significantly improve the developer experience degradation being caused by the wide usage of node-gyp across the JS Ethereum stack at the time. The project has been pretty successful, and it had clear next steps ahead to improve on aspects that were deprioritized in favor of quickly relieving the developer experience nightmare the incumbent solution represented.

Since then, I personally took notice of some of these potential improvements and recently started collaborating with the Nomic Labs team to implement them. The Ethereum Foundation funded the work.

## The issues

The main and most obvious aspect to improve on was that ethereum-cryptography pulled in 38 different dependencies and downloaded 3.6MB of source code with tests. Stripped down into a production build this meant that every Ethereum dapp that uses every function was downloading 793KB of JS code, which wasn’t great. Some dependencies also offered duplicated cryptography functionality, producing waste.

When it comes to security, auditing and tracking changes in 23799 lines of code responsible for important security primitives is a significant challenge. While dependencies were carefully managed, that doesn’t take away the fact that every dependency is a potential security vulnerability in a significant supply chain used for sensitive code.

## The rewrite

I set out to rewrite many of these cryptography implementations and managed to bring down the dependencies used to 5 instead of 38. These 5 dependencies now are:

- [noble-secp256k1](https://github.com/paulmillr/noble-secp256k1). Used for signing transactions and managing private/public keys. The package was already present and in a good post-audit shape
- [noble-hashes](https://github.com/paulmillr/noble-hashes). Implements SHA2, SHA3, RIPEMD, BLAKE2/3, HMAC, HKDF, PBKDF2 & Scrypt
- [scure-base](https://github.com/paulmillr/scure-base). Implements bech32, base64, base58, base32 & base16
- [scure-bip32](https://github.com/paulmillr/scure-bip32). Implementation of BIP32 hierarchical deterministic (HD) wallets using noble-hashes, noble-secp256k1 and scure-base
- [scure-bip39](https://github.com/paulmillr/scure-bip39). Implementation of BIP39 mnemonic phrases using noble-hashes and scure-base

Developing those was fun —for some interesting technical insights that came up during the process, check out [this separate article](https://gist.github.com/paulmillr/bff927eb421457c9e2efddd26082cc7a).

## The audit
We engaged a reputable vendor, [Cure53](https://cure53.de/), to audit the new implementations. They previously audited Mist for the Ethereum Foundation in 2016, and noble-secp256k1 after [the Ethereum community crowdfunded an audit on Gitcoin](https://gitcoin.co/grants/2451/audit-of-noble-secp256k1-cryptographic-library). You can read the [audit report here](https://cure53.de/pentest-report_hashing-libs.pdf). Every vulnerability that was found during the audit has been addressed and the fixes have been verified by Cure53.

## The result

|                             | v0.1    | v1.0   | Change |   |
|-----------------------------|---------|--------|--------|---|
| Dependencies used           | 38      | 5      |        |   |
| Native deps                 | 3       | 0      |        |   |
| People who can change deps  | 33      | 1      |        |   |
| Unpacked size               | 10.2 MB | 650 KB | 15.7x  |   |
| Lines of JS code            | 23799   | 5225   | 4.6x   |   |
| NPM traffic used            | 3.6 MB  | 324 KB | 11x    |   |
| Download time over 2G       | 4m 43s  | 25s    |        |   |

The new version is 15 times smaller than the original implementation, and some of the hashing implementations are even faster than their WASM counterparts.
We first published an RC release for the ecosystem to try out, and we’ve now published the stable v1.0.0 release. [Check it out!](https://github.com/ethereum/js-ethereum-cryptography/)
