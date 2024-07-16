---
layout: noble
title: 'Noble cryptography'
title_project: 'noble'
description: 'High-security, auditable set of contained cryptographic libraries and tools'
---

**noble cryptography** is a high-security, easily auditable set of contained cryptographic libraries with following features:

- Zero or minimal dependencies
- Highly readable TypeScript / JS code
- PGP-signed releases and transparent NPM builds

The idea was to: 1) improve knowledge of cryptography 2) improve supply chain security of JS ecosystem 3) provide libraries that could be used for learning, because other libs are too low-level / unfriendly to beginners.

Active projects:

- **ciphers** ([github](https://github.com/paulmillr/noble-ciphers), [npm](https://www.npmjs.com/package/@noble/ciphers)): cryptographic ciphers, including Salsa20, ChaCha, AES and FF1.
- **curves** ([github](https://github.com/paulmillr/noble-curves), [npm](https://www.npmjs.com/package/@noble/curves)): elliptic curve cryptography, including Weierstrass, Edwards, Montgomery curves, pairings, hash-to-curve, poseidon hash, schnorr, secp256k1, ed25519, ed448, p521, bn254, bls12-381 and others.
  - 4kb versions of _curves_ with even better auditability and rarer update schedule: secp256k1 ([github](https://github.com/paulmillr/noble-secp256k1), [npm](https://www.npmjs.com/package/@noble/secp256k1)) and ed25519 ([github](https://github.com/paulmillr/noble-ed25519), [npm](https://www.npmjs.com/package/@noble/ed25519))
- **hashes** ([github](https://github.com/paulmillr/noble-hashes), [npm](https://www.npmjs.com/package/@noble/hashes)): hash functions, MACs & KDFs, including SHA, RIPEMD, BLAKE, HMAC, HKDF, PBKDF & Scrypt
- **post-quantum** ([github](https://github.com/paulmillr/noble-post-quantum), [npm](https://www.npmjs.com/package/@noble/post-quantum)): post-quantum public key algorithms: ML-KEM, ML-DSA, SLH-DSA aka Kyber, Dilithium and SPHINCS+

The code is also available on [gitlab](https://gitlab.com/paulmillr/backup) and [codeberg](https://codeberg.org/paulmillr)

### History

- Jun 2019: initial release of [secp256k1](https://github.com/paulmillr/noble-secp256k1/commit/d544593d752a3101414eb1b3c3bee0c0fec349db), [ed25519](https://github.com/paulmillr/noble-ed25519/commit/36ded8a5dcc83ed171d05bb1c66ba7791b2299eb) and then [bls12-381](https://github.com/paulmillr/noble-bls12-381/commit/d25ed4d8f1e91fc7a9858ac81c8cb52179f29ee0)
- Apr 2020: the [blog post](/posts/noble-secp256k1-fast-ecc/) about ecc went live
- 2021
  - Apr: secp256k1 has been [audited](https://cure53.de/pentest-report_noble-lib.pdf) by Cure53, [crowdfunded](https://gitcoin.co/grants/2451/audit-of-noble-secp256k1-cryptographic-library) with help of [Umbra.cash](https://umbra.cash)
  - Oct: hashes have been [released](https://github.com/paulmillr/noble-hashes/commit/54dfdfd9fc209814effbcbf20819336736be9273), funded by [Ethereum Foundation](https://ethereum.org/en/)
  - Nov: received a grant from [Optimism](https://www.optimism.io)
- 2022
  - Jan: hashes have been [audited](https://cure53.de/pentest-report_hashing-libs.pdf) by Cure53, funded by Ethereum Foundation with help of [Nomic Labs](https://nomiclabs.io)
  - Feb: ed25519 has been [audited](https://cure53.de/pentest-report_ed25519.pdf) by Cure53
  - Dec: curves have been [released](https://github.com/paulmillr/noble-curves/commit/a20a357225b2359534644663f11a70f19653fae9), consolidating three previous packages in one
- 2023
  - Feb: curves have been [audited](https://github.com/trailofbits/publications/blob/master/reviews/2023-01-ryanshea-noblecurveslibrary-securityreview.pdf) by Trail of Bits, funded by [Ryan Shea](https://www.shea.io)
  - Mar: secp256k1 and ed25519 have been rewritten and became 4KB single-feature versions of curves
  - Jun: ciphers have been [released](https://github.com/paulmillr/noble-ciphers/commit/f0e21ed3496a0d6082027effbc54d2e7f4db2027)
  - Sep: curves have been [audited](https://github.com/paulmillr/noble-curves/blob/main/audit/2023-09-kudelski-audit-starknet.pdf) by Kudelski Security, funded by [starknet](https://www.starknet.io/en)
- 2024
  - Feb: post-quantum have been [released](https://github.com/paulmillr/noble-post-quantum/commit/2834e5c3409f70309edf9c30b2c4206cd449cd8e)
  - May: received a grant from [Farcaster](https://www.farcaster.xyz)

### scure

Noble's non-cryptographic sister project. Audited micro-libraries:

- Jan 2022: [base](https://github.com/paulmillr/scure-base) base64, bech32..., [bip32](https://github.com/paulmillr/scure-bip32) hdkey, [bip39](https://github.com/paulmillr/scure-bip39) mnemonics
- Feb 2023: [btc-signer](https://github.com/paulmillr/scure-btc-signer) transactions, segwit, taproot, psbt, multisig
- Sep 2023: [starknet](https://github.com/paulmillr/scure-starknet) stark curve, pedersen and poseidon hash

### Apps built with noble

Here is some software which uses Noble. You can [add new entry on github](https://github.com/paulmillr/noble-curves/discussions/90).

- Apps: [Protonmail](https://github.com/ProtonMail/WebClients), [Reflect](https://reflect.app),
  [Keycloak](https://github.com/keycloak/keycloak/blob/5af30011225bf4fecec9d75f58ad35a4ea2c7211/js/libs/keycloak-js/package.json#L81)
- Wallets: [Metamask](https://github.com/MetaMask/eth-sig-util), [Rainbow](https://github.com/rainbow-me/browser-extension), [Rabby](https://github.com/RabbyHub/Rabby), [Phantom](https://phantom.app)
- Blockchain libraries:
  - Bitcoin: [scure-btc-signer](https://github.com/paulmillr/scure-btc-signer), [tapscript](https://github.com/cmdruid/tapscript)
  - Ethereum: [ethereum-cryptography](https://github.com/ethereum/js-ethereum-cryptography), [micro-eth-signer](https://github.com/paulmillr/micro-eth-signer), [ethers](https://github.com/ethers-io/ethers.js), [viem](https://viem.sh), [@ethereumjs](https://github.com/ethereumjs/ethereumjs-monorepo), [web3.js](https://github.com/web3/web3.js) [gridplus-lattice-sdk](https://github.com/GridPlus/lattice-eth2-utils),
  - HDkey: [scure-bip32](https://github.com/paulmillr/scure-bip32), [bitcoinjs/bip32](https://github.com/bitcoinjs/bip32)
  - Trezor: [trezor-suite](https://github.com/trezor/trezor-suite/blob/f420619d60b3a88731865a3964857f6ba614ff6a/packages/connect/package.json#L53)
  - [CoinSpace](https://github.com/CoinSpace/CoinSpace) wallet was built purely with noble libraries: [btc](https://github.com/CoinSpace/cs-bitcoin-wallet), [evm](https://github.com/CoinSpace/cs-evm-wallet), [sol](https://github.com/CoinSpace/cs-solana-wallet),
  [eos](https://github.com/CoinSpace/cs-eos-wallet),
  [tron](https://github.com/CoinSpace/cs-tron-wallet),
  [xmr](https://github.com/CoinSpace/cs-monero-wallet),
  [ada](https://github.com/CoinSpace/cs-cardano-wallet)
  - [micro-sol-signer](https://github.com/paulmillr/micro-sol-signer), [solana-web3.js](https://github.com/solana-labs/solana-web3.js), [avalanchejs](https://github.com/ava-labs/avalanchejs),  [near-api-js](https://github.com/near/near-api-js/blob/7c9142fed5a0ca10a710bd519f7d3543bd2a5a95/packages/crypto/package.json#L23), [polkadot.js](https://github.com/polkadot-js/common), [moneroj](https://github.com/beritani/moneroj), [cs-monero](https://github.com/CoinSpace/cs-monero-wallet),
  [aztec](https://github.com/AztecProtocol/aztec-packages), [drand](https://github.com/drand/drand-client),
    [celo](https://github.com/celo-org/developer-tooling/blob/38b26316d615e836e21bbfe2f44853f7e8220e03/packages/sdk/cryptographic-utils/package.json#L28),
    [aptos-ts-sdk](https://github.com/aptos-labs/aptos-ts-sdk/blob/62de7f532feaa653556846eea6b66e33f7dc29d6/package.json#L53)
- Others:
  - [did-jwt](https://github.com/decentralized-identity/did-jwt), [hpke-js](https://github.com/dajiaji/hpke-js), [js-libp2p-noise](https://github.com/ChainSafe/js-libp2p-noise)
  - [ed25519-keygen](https://github.com/paulmillr/ed25519-keygen) SSH, PGP, TOR key generation and [cli tool](https://news.ycombinator.com/item?id=39684380) on top of it
  - [secp256k1 compatibility layer](https://github.com/ethereum/js-ethereum-cryptography/blob/2.0.0/src/secp256k1-compat.ts) for users who want to switch from secp256k1-node or tiny-secp256k1\. Allows to see which methods map to corresponding noble code.
  - BLS signatures: [BLS BBS signatures](https://github.com/Wind4Greg/BBS-Draft-Checks), [KZG trusted setup ceremony](https://github.com/dsrvlabs/czg-keremony), [genthresh.com](https://genthresh.com/) online demo of BLS aggregation
- Everything that uses noble, tracked using GitHub dependency graph:
  - [ciphers](https://github.com/paulmillr/noble-ciphers/network/dependents): 3.5K repos, 95 packages
  - [curves](https://github.com/paulmillr/noble-curves/network/dependents): 150K repos, 500 packages
  - [hashes](https://github.com/paulmillr/noble-hashes/network/dependents): 310K repos, 1100 packages

### Resources, articles, documentation

- [Learning fast elliptic-curve cryptography](/posts/noble-secp256k1-fast-ecc/)
- EdDSA
  - [A Deep dive into Ed25519 Signatures](https://cendyne.dev/posts/2022-03-06-ed25519-signatures.html)
  - [Ed25519 Deep Dive Addendum](https://cendyne.dev/posts/2022-09-11-ed25519-deep-dive-addendum.html)
  - [It’s 255:19AM. Do you know what your validation criteria are?](https://hdevalence.ca/blog/2020-10-04-its-25519am)
  - [Taming the many EdDSAs](https://csrc.nist.gov/csrc/media/Presentations/2023/crclub-2023-03-08/images-media/20230308-crypto-club-slides--taming-the-many-EdDSAs.pdf) that describes concepts of Strong UnForgeability under Chosen Message Attacks and Strongly Binding Signatures
  - [Cofactor Explained: Clearing Elliptic Curves’ dirty little secret](https://loup-vaillant.fr/tutorials/cofactor)
  - [Surrounded by Elligators](https://loup-vaillant.fr/articles/implementing-elligator)
- Pairings and BLS
  - [BLS signatures for busy people](https://gist.github.com/paulmillr/18b802ad219b1aee34d773d08ec26ca2)
  - [BLS12-381 for the rest of us](https://hackmd.io/@benjaminion/bls12-381)
  - [Key concepts of pairings](https://medium.com/@alonmuroch_65570/bls-signatures-part-2-key-concepts-of-pairings-27a8a9533d0c)
  - Pairing over bls12-381: [fields](https://research.nccgroup.com/2020/07/06/pairing-over-bls12-381-part-1-fields/), [curves](https://research.nccgroup.com/2020/07/13/pairing-over-bls12-381-part-2-curves/), [pairings](https://research.nccgroup.com/2020/08/13/pairing-over-bls12-381-part-3-pairing/)
  - [Estimating the bit security of pairing-friendly curves](https://research.nccgroup.com/2022/02/03/estimating-the-bit-security-of-pairing-friendly-curves/)
- Ciphers
  - [Fast-key-erasure random-number generators](https://blog.cr.yp.to/20170723-random.html)
  - [The design of Chacha20](https://loup-vaillant.fr/tutorials/chacha20-design)
  - [The design of Poly1305](https://loup-vaillant.fr/tutorials/poly1305-design)
  - [How to design a new block cipher?](https://crypto.stackexchange.com/a/39792/71535)
  - [NIST Workshop on Block Cipher Modes of Operation 2023](https://csrc.nist.gov/Events/2023/third-workshop-on-block-cipher-modes-of-operation) contains a lot of useful information
- Multi-user / multi-key attacks
  - [Break a dozen secret keys, get a million more for free](https://blog.cr.yp.to/20151120-batchattacks.html)
  - [128 Bits of Security and 128 Bits of Security: Know the Difference](https://loup-vaillant.fr/tutorials/128-bits-of-security)

### Demo

You can try out noble in the browser JS console of the webpage. There are 3 global variables: `nobleCiphers`, `nobleCurves`, `nobleHashes`. The webpage also has two demo apps:

- App I: Elliptic curve calculator, calculate public keys and signatures
- App II: Add, subtract, multiply points on the chosen elliptic curve
