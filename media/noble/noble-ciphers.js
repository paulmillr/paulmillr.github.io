"use strict";
var nobleCiphers = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // input.js
  var input_exports = {};
  __export(input_exports, {
    chacha12: () => chacha12,
    chacha20: () => chacha20,
    chacha20poly1305: () => chacha20poly1305,
    chacha8: () => chacha8,
    salsa20: () => salsa20,
    utils: () => utils,
    xchacha20poly1305: () => xchacha20poly1305,
    xsalsa20poly1305: () => xsalsa20poly1305
  });

  // node_modules/.pnpm/file+../node_modules/@noble/ciphers/esm/utils.js
  var u8a = (a) => a instanceof Uint8Array;
  var u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  var createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
  if (!isLE)
    throw new Error("Non little-endian hardware is not supported");
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes2) {
    if (!u8a(bytes2))
      throw new Error("Uint8Array expected");
    let hex = "";
    for (let i = 0; i < bytes2.length; i++) {
      hex += hexes[bytes2[i]];
    }
    return hex;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    const len = hex.length;
    if (len % 2)
      throw new Error("padded hex string expected, got unpadded hex of length " + len);
    const array = new Uint8Array(len / 2);
    for (let i = 0; i < array.length; i++) {
      const j = i * 2;
      const hexByte = hex.slice(j, j + 2);
      const byte = Number.parseInt(hexByte, 16);
      if (Number.isNaN(byte) || byte < 0)
        throw new Error("Invalid byte sequence");
      array[i] = byte;
    }
    return array;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function bytesToUtf8(bytes2) {
    return new TextDecoder().decode(bytes2);
  }
  function concatBytes(...arrays) {
    const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
    let pad = 0;
    arrays.forEach((a) => {
      if (!u8a(a))
        throw new Error("Uint8Array expected");
      r.set(a, pad);
      pad += a.length;
    });
    return r;
  }
  var isPlainObject = (obj) => Object.prototype.toString.call(obj) === "[object Object]" && obj.constructor === Object;
  function checkOpts(defaults, opts) {
    if (opts !== void 0 && (typeof opts !== "object" || !isPlainObject(opts)))
      throw new Error("options must be object or undefined");
    const merged = Object.assign(defaults, opts);
    return merged;
  }
  function ensureBytes(b, len) {
    if (!(b instanceof Uint8Array))
      throw new Error("Uint8Array expected");
    if (typeof len === "number") {
      if (b.length !== len)
        throw new Error(`Uint8Array length ${len} expected`);
    }
  }
  function equalBytes(a, b) {
    if (a.length !== b.length)
      throw new Error("equalBytes: Different size of Uint8Arrays");
    let isSame = true;
    for (let i = 0; i < a.length; i++)
      isSame && (isSame = a[i] === b[i]);
    return isSame;
  }
  function setBigUint64(view, byteOffset, value, isLE2) {
    if (typeof view.setBigUint64 === "function")
      return view.setBigUint64(byteOffset, value, isLE2);
    const _32n = BigInt(32);
    const _u32_max = BigInt(4294967295);
    const wh = Number(value >> _32n & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE2 ? 4 : 0;
    const l = isLE2 ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE2);
    view.setUint32(byteOffset + l, wl, isLE2);
  }

  // node_modules/.pnpm/file+../node_modules/@noble/ciphers/esm/_assert.js
  function number(n) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error(`Wrong positive integer: ${n}`);
  }
  function bool(b) {
    if (typeof b !== "boolean")
      throw new Error(`Expected boolean, not ${b}`);
  }
  function bytes(b, ...lengths) {
    if (!(b instanceof Uint8Array))
      throw new Error("Expected Uint8Array");
    if (lengths.length > 0 && !lengths.includes(b.length))
      throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
  }
  function hash(hash2) {
    if (typeof hash2 !== "function" || typeof hash2.create !== "function")
      throw new Error("hash must be wrapped by utils.wrapConstructor");
    number(hash2.outputLen);
    number(hash2.blockLen);
  }
  function exists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function output(out, instance) {
    bytes(out);
    const min = instance.outputLen;
    if (out.length < min) {
      throw new Error(`digestInto() expects output buffer of length at least ${min}`);
    }
  }
  var assert = { number, bool, bytes, hash, exists, output };
  var assert_default = assert;

  // node_modules/.pnpm/file+../node_modules/@noble/ciphers/esm/_salsa.js
  var sigma16 = utf8ToBytes("expand 16-byte k");
  var sigma32 = utf8ToBytes("expand 32-byte k");
  var sigma16_32 = u32(sigma16);
  var sigma32_32 = u32(sigma32);
  var isAligned32 = (b) => !(b.byteOffset % 4);
  var salsaBasic = (opts) => {
    const { core, rounds, counterRight, counterLen, allow128bitKeys, extendNonceFn, blockLen } = checkOpts({ rounds: 20, counterRight: false, counterLen: 8, allow128bitKeys: true, blockLen: 64 }, opts);
    assert_default.number(counterLen);
    assert_default.number(rounds);
    assert_default.number(blockLen);
    assert_default.bool(counterRight);
    assert_default.bool(allow128bitKeys);
    const blockLen32 = blockLen / 4;
    if (blockLen % 4 !== 0)
      throw new Error("Salsa/ChaCha: blockLen must be aligned to 4 bytes");
    return (key, nonce, data, output2, counter = 0) => {
      assert_default.bytes(key);
      assert_default.bytes(nonce);
      assert_default.bytes(data);
      if (!output2)
        output2 = new Uint8Array(data.length);
      assert_default.bytes(output2);
      assert_default.number(counter);
      if (counter < 0 || counter >= 2 ** 32 - 1)
        throw new Error("Salsa/ChaCha: counter overflow");
      if (output2.length < data.length) {
        throw new Error(`Salsa/ChaCha: output (${output2.length}) is shorter than data (${data.length})`);
      }
      const toClean = [];
      let k, sigma;
      if (key.length === 32) {
        if (isAligned32(key))
          k = key;
        else {
          k = key.slice();
          toClean.push(k);
        }
        sigma = sigma32_32;
      } else if (key.length === 16 && allow128bitKeys) {
        k = new Uint8Array(32);
        k.set(key);
        k.set(key, 16);
        sigma = sigma16_32;
        toClean.push(k);
      } else
        throw new Error(`Salsa/ChaCha: invalid 32-byte key, got length=${key.length}`);
      if (!isAligned32(nonce)) {
        nonce = nonce.slice();
        toClean.push(nonce);
      }
      if (extendNonceFn) {
        if (nonce.length <= 16)
          throw new Error(`Salsa/ChaCha: extended nonce must be bigger than 16 bytes`);
        k = extendNonceFn(sigma, k, nonce.subarray(0, 16), new Uint8Array(32));
        toClean.push(k);
        nonce = nonce.subarray(16);
      }
      const nonceLen = 16 - counterLen;
      if (nonce.length !== nonceLen)
        throw new Error(`Salsa/ChaCha: nonce must be ${nonceLen} or 16 bytes`);
      if (nonceLen !== 12) {
        const nc = new Uint8Array(12);
        nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
        toClean.push(nonce = nc);
      }
      const block = new Uint8Array(blockLen);
      const b32 = u32(block);
      const k32 = u32(k);
      const n32 = u32(nonce);
      const d32 = isAligned32(data) && u32(data);
      const o32 = isAligned32(output2) && u32(output2);
      toClean.push(b32);
      const len = data.length;
      for (let pos = 0, ctr = counter; pos < len; ctr++) {
        core(sigma, k32, n32, b32, ctr, rounds);
        if (ctr >= 2 ** 32 - 1)
          throw new Error("Salsa/ChaCha: counter overflow");
        const take = Math.min(blockLen, len - pos);
        if (take === blockLen && o32 && d32) {
          const pos32 = pos / 4;
          if (pos % 4 !== 0)
            throw new Error("Salsa/ChaCha: invalid block position");
          for (let j = 0; j < blockLen32; j++)
            o32[pos32 + j] = d32[pos32 + j] ^ b32[j];
          pos += blockLen;
          continue;
        }
        for (let j = 0; j < take; j++)
          output2[pos + j] = data[pos + j] ^ block[j];
        pos += take;
      }
      for (let i = 0; i < toClean.length; i++)
        toClean[i].fill(0);
      return output2;
    };
  };

  // node_modules/.pnpm/file+../node_modules/@noble/ciphers/esm/_micro.js
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    return BigInt(hex === "" ? "0" : `0x${hex}`);
  }
  function bytesToNumberLE(bytes2) {
    return hexToNumber(bytesToHex(Uint8Array.from(bytes2).reverse()));
  }
  function numberToBytesLE(n, len) {
    return hexToBytes(n.toString(16).padStart(len * 2, "0")).reverse();
  }
  var rotl = (a, b) => a << b | a >>> 32 - b;
  function salsaQR(x, a, b, c, d) {
    x[b] ^= rotl(x[a] + x[d] | 0, 7);
    x[c] ^= rotl(x[b] + x[a] | 0, 9);
    x[d] ^= rotl(x[c] + x[b] | 0, 13);
    x[a] ^= rotl(x[d] + x[c] | 0, 18);
  }
  function chachaQR(x, a, b, c, d) {
    x[a] = x[a] + x[b] | 0;
    x[d] = rotl(x[d] ^ x[a], 16);
    x[c] = x[c] + x[d] | 0;
    x[b] = rotl(x[b] ^ x[c], 12);
    x[a] = x[a] + x[b] | 0;
    x[d] = rotl(x[d] ^ x[a], 8);
    x[c] = x[c] + x[d] | 0;
    x[b] = rotl(x[b] ^ x[c], 7);
  }
  function salsaRound(x, rounds = 20) {
    for (let i = 0; i < rounds; i += 2) {
      salsaQR(x, 0, 4, 8, 12);
      salsaQR(x, 5, 9, 13, 1);
      salsaQR(x, 10, 14, 2, 6);
      salsaQR(x, 15, 3, 7, 11);
      salsaQR(x, 0, 1, 2, 3);
      salsaQR(x, 5, 6, 7, 4);
      salsaQR(x, 10, 11, 8, 9);
      salsaQR(x, 15, 12, 13, 14);
    }
  }
  function chachaRound(x, rounds = 20) {
    for (let i = 0; i < rounds; i += 2) {
      chachaQR(x, 0, 4, 8, 12);
      chachaQR(x, 1, 5, 9, 13);
      chachaQR(x, 2, 6, 10, 14);
      chachaQR(x, 3, 7, 11, 15);
      chachaQR(x, 0, 5, 10, 15);
      chachaQR(x, 1, 6, 11, 12);
      chachaQR(x, 2, 7, 8, 13);
      chachaQR(x, 3, 4, 9, 14);
    }
  }
  function salsaCore(c, k, n, out, cnt, rounds = 20) {
    const y = new Uint32Array([
      c[0],
      k[0],
      k[1],
      k[2],
      k[3],
      c[1],
      n[0],
      n[1],
      cnt,
      0,
      c[2],
      k[4],
      k[5],
      k[6],
      k[7],
      c[3]
      // Key    Key     Key     "te k"
    ]);
    const x = y.slice();
    salsaRound(x, rounds);
    for (let i = 0; i < 16; i++)
      out[i] = y[i] + x[i] | 0;
  }
  function hsalsa(c, key, nonce) {
    const k = u32(key);
    const i = u32(nonce);
    const x = new Uint32Array([
      c[0],
      k[0],
      k[1],
      k[2],
      k[3],
      c[1],
      i[0],
      i[1],
      i[2],
      i[3],
      c[2],
      k[4],
      k[5],
      k[6],
      k[7],
      c[3]
    ]);
    salsaRound(x);
    return u8(new Uint32Array([x[0], x[5], x[10], x[15], x[6], x[7], x[8], x[9]]));
  }
  function chachaCore(c, k, n, out, cnt, rounds = 20) {
    const y = new Uint32Array([
      c[0],
      c[1],
      c[2],
      c[3],
      k[0],
      k[1],
      k[2],
      k[3],
      k[4],
      k[5],
      k[6],
      k[7],
      cnt,
      n[0],
      n[1],
      n[2]
      // Counter  Counter	Nonce   Nonce
    ]);
    const x = y.slice();
    chachaRound(x, rounds);
    for (let i = 0; i < 16; i++)
      out[i] = y[i] + x[i] | 0;
  }
  function hchacha(c, key, nonce) {
    const k = u32(key);
    const i = u32(nonce);
    const x = new Uint32Array([
      c[0],
      c[1],
      c[2],
      c[3],
      k[0],
      k[1],
      k[2],
      k[3],
      k[4],
      k[5],
      k[6],
      k[7],
      i[0],
      i[1],
      i[2],
      i[3]
    ]);
    chachaRound(x);
    return u8(new Uint32Array([x[0], x[1], x[2], x[3], x[12], x[13], x[14], x[15]]));
  }
  var salsa20 = salsaBasic({ core: salsaCore, counterRight: true });
  var xsalsa20 = salsaBasic({
    core: salsaCore,
    counterRight: true,
    extendNonceFn: hsalsa,
    allow128bitKeys: false
  });
  var chacha20orig = salsaBasic({ core: chachaCore, counterRight: false, counterLen: 8 });
  var chacha20 = salsaBasic({
    core: chachaCore,
    counterRight: false,
    counterLen: 4,
    allow128bitKeys: false
  });
  var xchacha20 = salsaBasic({
    core: chachaCore,
    counterRight: false,
    counterLen: 8,
    extendNonceFn: hchacha,
    allow128bitKeys: false
  });
  var chacha8 = salsaBasic({
    core: chachaCore,
    counterRight: false,
    counterLen: 4,
    rounds: 8
  });
  var chacha12 = salsaBasic({
    core: chachaCore,
    counterRight: false,
    counterLen: 4,
    rounds: 12
  });
  var POW_2_130_5 = 2n ** 130n - 5n;
  var POW_2_128_1 = 2n ** (16n * 8n) - 1n;
  function poly1305(msg, key) {
    ensureBytes(msg);
    ensureBytes(key);
    let acc = 0n;
    const r = bytesToNumberLE(key.subarray(0, 16)) & 0x0ffffffc0ffffffc0ffffffc0fffffffn;
    const s = bytesToNumberLE(key.subarray(16));
    for (let i = 0; i < msg.length; i += 16) {
      const m = msg.subarray(i, i + 16);
      const n = bytesToNumberLE(m) | 1n << BigInt(8 * m.length);
      acc = (acc + n) * r % POW_2_130_5;
    }
    const res = acc + s & POW_2_128_1;
    return numberToBytesLE(res, 16);
  }
  function computeTag(fn, key, nonce, ciphertext, AAD) {
    const res = [];
    if (AAD) {
      res.push(AAD);
      const leftover2 = AAD.length % 16;
      if (leftover2 > 0)
        res.push(new Uint8Array(16 - leftover2));
    }
    res.push(ciphertext);
    const leftover = ciphertext.length % 16;
    if (leftover > 0)
      res.push(new Uint8Array(16 - leftover));
    const num = new Uint8Array(16);
    const view = createView(num);
    setBigUint64(view, 0, BigInt(AAD ? AAD.length : 0), true);
    setBigUint64(view, 8, BigInt(ciphertext.length), true);
    res.push(num);
    const authKey = fn(key, nonce, new Uint8Array(32));
    return poly1305(concatBytes(...res), authKey);
  }
  function xsalsa20poly1305(key, nonce) {
    ensureBytes(key);
    ensureBytes(nonce);
    return {
      encrypt: (plaintext) => {
        ensureBytes(plaintext);
        const m = concatBytes(new Uint8Array(32), plaintext);
        const c = xsalsa20(key, nonce, m);
        const authKey = c.subarray(0, 32);
        const data = c.subarray(32);
        const tag = poly1305(data, authKey);
        return concatBytes(tag, data);
      },
      decrypt: (ciphertext) => {
        ensureBytes(ciphertext);
        if (ciphertext.length < 16)
          throw new Error("encrypted data must be at least 16 bytes");
        const c = concatBytes(new Uint8Array(16), ciphertext);
        const authKey = xsalsa20(key, nonce, new Uint8Array(32));
        const tag = poly1305(c.subarray(32), authKey);
        if (!equalBytes(c.subarray(16, 32), tag))
          throw new Error("invalid poly1305 tag");
        return xsalsa20(key, nonce, c).subarray(32);
      }
    };
  }
  var _poly1305_aead = (fn) => (key, nonce, AAD) => {
    const tagLength = 16;
    const keyLength = 32;
    ensureBytes(key, keyLength);
    ensureBytes(nonce);
    return {
      tagLength,
      encrypt: (plaintext) => {
        ensureBytes(plaintext);
        const res = fn(key, nonce, plaintext, void 0, 1);
        const tag = computeTag(fn, key, nonce, res, AAD);
        return concatBytes(res, tag);
      },
      decrypt: (ciphertext) => {
        ensureBytes(ciphertext);
        if (ciphertext.length < tagLength)
          throw new Error(`encrypted data must be at least ${tagLength} bytes`);
        const passedTag = ciphertext.subarray(-tagLength);
        const data = ciphertext.subarray(0, -tagLength);
        const tag = computeTag(fn, key, nonce, data, AAD);
        if (!equalBytes(passedTag, tag))
          throw new Error("invalid poly1305 tag");
        return fn(key, nonce, data, void 0, 1);
      }
    };
  };
  var chacha20poly1305 = _poly1305_aead(chacha20);
  var xchacha20poly1305 = _poly1305_aead(xchacha20);

  // input.js
  var utils = { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes };
  return __toCommonJS(input_exports);
})();
/*! Bundled license information:

@noble/ciphers/esm/utils.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)

@noble/ciphers/esm/_micro.js:
  (*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) *)
*/
