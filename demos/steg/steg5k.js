(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('crypto')) :
    typeof define === 'function' && define.amd ? define(['crypto'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.nodeCrypto));
})(this, (function (nodeCrypto) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        const n = Object.create(null);
        if (e) {
            for (const k in e) {
                if (k !== 'default') {
                    const d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            }
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    const nodeCrypto__namespace = /*#__PURE__*/_interopNamespace(nodeCrypto);

    const crypto = {
        node: nodeCrypto__namespace,
        web: typeof self === 'object' && 'crypto' in self ? self.crypto : undefined,
    };
    function hexToBytes(hex) {
        if (typeof hex !== 'string') {
            throw new TypeError('hexToBytes: expected string, got ' + typeof hex);
        }
        if (hex.length % 2)
            throw new Error('hexToBytes: received invalid unpadded hex' + hex.length);
        const array = new Uint8Array(hex.length / 2);
        for (let i = 0; i < array.length; i++) {
            const j = i * 2;
            const hexByte = hex.slice(j, j + 2);
            const byte = Number.parseInt(hexByte, 16);
            if (Number.isNaN(byte) || byte < 0)
                throw new Error('Invalid byte sequence');
            array[i] = byte;
        }
        return array;
    }
    function concatBytes(...arrays) {
        if (!arrays.every((arr) => arr instanceof Uint8Array))
            throw new Error('Uint8Array list expected');
        if (arrays.length === 1)
            return arrays[0];
        const length = arrays.reduce((a, arr) => a + arr.length, 0);
        const result = new Uint8Array(length);
        for (let i = 0, pad = 0; i < arrays.length; i++) {
            const arr = arrays[i];
            result.set(arr, pad);
            pad += arr.length;
        }
        return result;
    }
    const MD = { e: 'AES-GCM', i: { name: 'AES-GCM', length: 256 } };
    async function encrypt(sharedKey, plaintext) {
        if (typeof plaintext === 'string')
            plaintext = utils$1.utf8ToBytes(plaintext);
        const iv = utils$1.randomBytes(12);
        if (crypto.web) {
            const iKey = await crypto.web.subtle.importKey('raw', sharedKey, MD.i, true, ['encrypt']);
            const cipher = await crypto.web.subtle.encrypt({ name: MD.e, iv }, iKey, plaintext);
            const ciphertext = new Uint8Array(cipher);
            const encrypted = new Uint8Array(iv.length + ciphertext.byteLength);
            encrypted.set(iv, 0);
            encrypted.set(ciphertext, iv.length);
            return encrypted;
        }
        else {
            const cipher = crypto.node.createCipheriv('aes-256-gcm', sharedKey, iv);
            let ciphertext = cipher.update(plaintext, undefined, 'hex');
            ciphertext += cipher.final('hex');
            const ciphertextBytes = hexToBytes(ciphertext);
            const tag = cipher.getAuthTag();
            const encrypted = concatBytes(iv, ciphertextBytes, tag);
            return encrypted;
        }
    }
    async function decrypt(sharedKey, encoded) {
        if (typeof encoded === 'string')
            encoded = hexToBytes(encoded);
        const iv = encoded.slice(0, 12);
        if (crypto.web) {
            const ciphertextWithTag = encoded.slice(12);
            const iKey = await crypto.web.subtle.importKey('raw', sharedKey, MD.i, true, ['decrypt']);
            const plaintext = await crypto.web.subtle.decrypt({ name: MD.e, iv }, iKey, ciphertextWithTag);
            return new Uint8Array(plaintext);
        }
        else {
            const ciphertext = encoded.slice(12, -16);
            const authTag = encoded.slice(-16);
            const decipher = crypto.node.createDecipheriv('aes-256-gcm', sharedKey, iv);
            decipher.setAuthTag(authTag);
            const plaintext = decipher.update(ciphertext);
            const final = Uint8Array.from(decipher.final());
            const res = concatBytes(plaintext, final);
            return res;
        }
    }
    const utils$1 = {
        randomBytes: (bytesLength = 32) => {
            if (crypto.web) {
                return crypto.web.getRandomValues(new Uint8Array(bytesLength));
            }
            else if (crypto.node) {
                const { randomBytes } = crypto.node;
                return Uint8Array.from(randomBytes(bytesLength));
            }
            else {
                throw new Error("The environment doesn't have randomBytes function");
            }
        },
        bytesToUtf8(bytes) {
            return new TextDecoder().decode(bytes);
        },
        utf8ToBytes(string) {
            return new TextEncoder().encode(string);
        },
        hexToBytes,
        concatBytes,
    };
    const aes = { encrypt, decrypt };

    const ENCRYPTED_METADATA_SIZE = 28;
    function validateBits(bitsTaken) {
        const b = bitsTaken;
        if (!(Number.isSafeInteger(b) && b >= 1 && b <= 8))
            throw new Error('Bits taken must be >= 1 and <= 8');
    }
    function clearBits(n, bits) {
        return (n >> bits) << bits;
    }
    function readBit(byte, pos) {
        return (byte >> (7 - pos)) & 1;
    }
    function isAlpha(pixel) {
        return pixel % 4 === 3;
    }
    function getRandomByte() {
        return utils$1.randomBytes(1)[0];
    }
    const createView$1 = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    class RawFile {
        constructor(data, name) {
            this.data = data;
            this.name = name;
            this.size = data.byteLength;
            if (!this.name)
                this.name = `file-${this.size}.file`;
        }
        static fromPacked(packed) {
            const padded = Uint8Array.from(packed);
            const view = createView$1(padded);
            let offset = 0;
            const nsize = view.getUint8(offset);
            offset += 1;
            if (nsize < 1)
                throw new Error('file name must contain at least 1 character');
            const name = utils.bytesToUtf8(padded.subarray(offset, offset + nsize));
            offset += nsize;
            const fsize = view.getUint32(offset);
            offset += 4;
            const unpadded = padded.subarray(offset, offset + fsize);
            return new RawFile(unpadded, name);
        }
        static async fromFileInput(element) {
            return new Promise((resolve, reject) => {
                const file = FileReader && element.files && element.files[0];
                if (!file)
                    return reject();
                const reader = new FileReader();
                reader.addEventListener('load', () => {
                    let res = reader.result;
                    if (typeof res === 'string')
                        res = utils.utf8ToBytes(res);
                    if (!res)
                        return reject(new Error('No file'));
                    resolve(new RawFile(new Uint8Array(res), file.name));
                });
                reader.addEventListener('error', reject);
                reader.readAsArrayBuffer(file);
            });
        }
        createHeader() {
            const nbytes = utils.utf8ToBytes(this.name);
            const nsize = nbytes.byteLength;
            if (nsize < 1 || nsize > 255)
                throw new Error('File name must be 1-255 chars');
            const metadataSize = 1 + nsize + 4;
            const meta = new Uint8Array(metadataSize);
            const view = createView$1(meta);
            let offset = 0;
            view.setUint8(offset, nsize);
            offset += 1;
            meta.set(nbytes, offset);
            offset += nsize;
            view.setUint32(offset, this.size);
            offset += 4;
            return meta;
        }
        pack() {
            const header = this.createHeader();
            const packed = new Uint8Array(header.byteLength + this.size);
            packed.set(header);
            packed.set(this.data, header.byteLength);
            return packed;
        }
        packWithPadding(requiredLength) {
            const packed = this.pack();
            const difference = requiredLength - packed.length;
            if (difference < 0)
                throw new Error('requiredLength is lesser than result');
            const padded = new Uint8Array(packed.length + difference);
            padded.set(packed, 0);
            return padded;
        }
        download() {
            utils.downloadFile(utils.bytesToURL(this.data), this.name);
        }
    }
    class StegImage {
        constructor(image) {
            this.image = image;
            const { canvas, imageData } = this.createCanvas(image);
            this.canvas = canvas;
            this.imageData = imageData;
        }
        static async fromBytesOrURL(urlOrBytes) {
            const image = new Image();
            const src = urlOrBytes instanceof Uint8Array ? utils.bytesToURL(urlOrBytes) : urlOrBytes;
            await utils.setImageSource(image, src, true);
            return new StegImage(image);
        }
        createCanvas(image = this.image) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            if (!context)
                throw new Error('Invalid context');
            context.drawImage(image, 0, 0);
            const imageData = context.getImageData(0, 0, image.width, image.height);
            return { canvas, imageData };
        }
        reset() {
            const { canvas, imageData } = this.createCanvas();
            this.canvas = canvas;
            this.imageData = imageData;
        }
        calcCapacity(bitsTaken) {
            validateBits(bitsTaken);
            const channels = this.imageData.data;
            const rgba = 4;
            const channelsNoFirst = channels.length - rgba;
            const pixels = channelsNoFirst / rgba;
            const rgb = 3;
            const bits = pixels * rgb * bitsTaken;
            const bytes = Math.floor(bits / 8);
            return { bits, bytes };
        }
        async hide(rawFile, key, bitsTaken = 1) {
            const capacity = this.calcCapacity(bitsTaken).bytes;
            const packed = rawFile.packWithPadding(capacity - ENCRYPTED_METADATA_SIZE);
            const ciphertext = await aes.encrypt(key, packed);
            if (ciphertext.byteLength !== capacity)
                throw new Error('Encrypted blob must be equal to total data length');
            return await this.hideBlob(ciphertext, bitsTaken);
        }
        async reveal(key) {
            const ciphertext = await this.revealBlob();
            const packed = await aes.decrypt(key, ciphertext);
            return RawFile.fromPacked(packed);
        }
        async hideBlob(hData, bitsTaken = 1) {
            if (!(hData instanceof Uint8Array))
                throw new Error('Uint8Array expected');
            const canvas = this.canvas;
            const channels = this.imageData.data;
            const channelsLen = channels.length;
            const hDataLen = hData.byteLength;
            validateBits(bitsTaken);
            const cap = this.calcCapacity(bitsTaken).bytes;
            if (hDataLen > cap)
                throw new Error('StegImage#hideBlob: ' +
                    `Can't hide ${hDataLen} bytes in ${cap} bytes at ${bitsTaken} bits taken`);
            let channelId = 0;
            function writeChannel(data, bits = bitsTaken) {
                const curr = channels[channelId];
                channels[channelId++] = clearBits(curr, bits) | data;
                if (isAlpha(channelId))
                    channels[channelId++] = 256;
            }
            while (channelId < 3)
                writeChannel(readBit(bitsTaken - 1, 8 - 3 + channelId), 1);
            let buf = 0;
            let bufBits = 0;
            for (let byte = 0; byte < hData.length; byte++) {
                let hiddenDataByte = hData[byte];
                for (let bit = 0; bit < 8; bit++) {
                    buf = (buf << 1) | readBit(hiddenDataByte, bit);
                    bufBits++;
                    if (bufBits === bitsTaken) {
                        writeChannel(buf);
                        buf = 0;
                        bufBits = 0;
                    }
                }
            }
            if (bufBits) {
                const randomByte = getRandomByte();
                const leftoverBits = bitsTaken - bufBits;
                for (let i = 0; i < leftoverBits; i++) {
                    if (i > 7)
                        throw new Error('StegImage#hideBlob: Need more than 7 random bits');
                    const randomBit = readBit(randomByte, i);
                    buf = (buf << 1) | randomBit;
                    bufBits++;
                }
                if (bufBits !== bitsTaken)
                    throw new Error('StegImage#hideBlob: bufBits !== bitsTaken');
                writeChannel(buf);
            }
            while (channelId < channelsLen) {
                const randomByte = getRandomByte();
                const bitsTakenMask = 2 ** bitsTaken - 1;
                writeChannel(randomByte & bitsTakenMask);
            }
            if (channelId !== channelsLen) {
                throw new Error('StegImage#hideBlob: Current pixel length ' +
                    `${channelId} is different from total capacity ${channelsLen}`);
            }
            const vctx = canvas.getContext('2d');
            if (!vctx)
                throw new Error('StegImage#hideBlob: No context');
            vctx.putImageData(this.imageData, 0, 0);
            const vchannels = vctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 0; i < channelsLen; i++) {
                const v1 = channels[i];
                const v2 = vchannels[i];
                if (v1 !== v2) {
                    throw new Error(`StegImage#hideBlob: Mismatch after verification; idx=${i} v1=${v1} v2=${v2} pos=${i % 4}`);
                }
            }
            return await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b)
                        resolve(URL.createObjectURL(b));
                    else
                        reject(new Error('StegImage#hideBlob: No blob'));
                    this.reset();
                });
            });
        }
        revealBitsTaken() {
            const channels = this.imageData.data;
            const bit0 = readBit(channels[0], 7) << 2;
            const bit1 = readBit(channels[1], 7) << 1;
            const bit2 = readBit(channels[2], 7);
            const bitsTaken = 1 + (bit0 | bit1 | bit2);
            validateBits(bitsTaken);
            return bitsTaken;
        }
        async revealBlob() {
            const channels = this.imageData.data;
            const bitsTaken = this.revealBitsTaken();
            const { bytes } = this.calcCapacity(bitsTaken);
            const mask = 2 ** bitsTaken - 1;
            let buf = 0;
            let bufBits = 0;
            const out = new Uint8Array(bytes);
            let outPos = 0;
            for (let channelId = 4; channelId < channels.length; channelId++) {
                if (isAlpha(channelId))
                    channelId++;
                buf = (buf << bitsTaken) | (channels[channelId] & mask);
                bufBits += bitsTaken;
                if (bufBits >= 8) {
                    const leftBits = bufBits - 8;
                    out[outPos++] = buf >> leftBits;
                    buf = buf & (2 ** leftBits - 1);
                    bufBits = leftBits;
                }
            }
            return out;
        }
    }
    const utils = {
        utf8ToBytes(str) {
            return new TextEncoder().encode(str);
        },
        bytesToUtf8(bytes) {
            return new TextDecoder().decode(bytes);
        },
        bytesToURL(bytes) {
            return URL.createObjectURL(new Blob([bytes]));
        },
        setImageSource(el, url, revoke = false) {
            return new Promise((resolve) => {
                el.src = url;
                el.addEventListener('load', () => {
                    if (revoke)
                        URL.revokeObjectURL(url);
                    resolve();
                });
            });
        },
        downloadFile(url, fileName = `hidden-${new Date().toISOString()}.png`) {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = 'Download';
            link.setAttribute('download', fileName);
            link.click();
        },
        formatSize(bytes) {
            const KB = 1024;
            const MB = 1024 * 1024;
            if (bytes < KB)
                return `${bytes}B`;
            if (bytes < MB)
                return `${(bytes / KB).toFixed(2)}KB`;
            return `${(bytes / MB).toFixed(2)}MB`;
        }
    };

    function number(n) {
        if (!Number.isSafeInteger(n) || n < 0)
            throw new Error(`Wrong positive integer: ${n}`);
    }
    function bool(b) {
        if (typeof b !== 'boolean')
            throw new Error(`Expected boolean, not ${b}`);
    }
    function bytes(b, ...lengths) {
        if (!(b instanceof Uint8Array))
            throw new TypeError('Expected Uint8Array');
        if (lengths.length > 0 && !lengths.includes(b.length))
            throw new TypeError(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    function hash(hash) {
        if (typeof hash !== 'function' || typeof hash.create !== 'function')
            throw new Error('Hash should be wrapped by utils.wrapConstructor');
        number(hash.outputLen);
        number(hash.blockLen);
    }
    function exists(instance, checkFinished = true) {
        if (instance.destroyed)
            throw new Error('Hash instance has been destroyed');
        if (checkFinished && instance.finished)
            throw new Error('Hash#digest() has already been called');
    }
    function output(out, instance) {
        bytes(out);
        const min = instance.outputLen;
        if (out.length < min) {
            throw new Error(`digestInto() expects output buffer of length at least ${min}`);
        }
    }
    const assert = {
        number,
        bool,
        bytes,
        hash,
        exists,
        output,
    };

    /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
    const u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
    // Cast array to view
    const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    // The rotate right (circular right shift) operation for uint32
    const rotr = (word, shift) => (word << (32 - shift)) | (word >>> shift);
    const isLE = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
    // There is almost no big endian hardware, but js typed arrays uses platform specific endianness.
    // So, just to be sure not to corrupt anything.
    if (!isLE)
        throw new Error('Non little-endian hardware is not supported');
    Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
    function utf8ToBytes(str) {
        if (typeof str !== 'string') {
            throw new TypeError(`utf8ToBytes expected string, got ${typeof str}`);
        }
        return new TextEncoder().encode(str);
    }
    function toBytes(data) {
        if (typeof data === 'string')
            data = utf8ToBytes(data);
        if (!(data instanceof Uint8Array))
            throw new TypeError(`Expected input type is Uint8Array (got ${typeof data})`);
        return data;
    }
    // For runtime check if class implements interface
    class Hash {
        // Safe version that clones internal state
        clone() {
            return this._cloneInto();
        }
    }
    // Check if object doens't have custom constructor (like Uint8Array/Array)
    const isPlainObject = (obj) => Object.prototype.toString.call(obj) === '[object Object]' && obj.constructor === Object;
    function checkOpts(defaults, opts) {
        if (opts !== undefined && (typeof opts !== 'object' || !isPlainObject(opts)))
            throw new TypeError('Options should be object or undefined');
        const merged = Object.assign(defaults, opts);
        return merged;
    }
    function wrapConstructor(hashConstructor) {
        const hashC = (message) => hashConstructor().update(toBytes(message)).digest();
        const tmp = hashConstructor();
        hashC.outputLen = tmp.outputLen;
        hashC.blockLen = tmp.blockLen;
        hashC.create = () => hashConstructor();
        return hashC;
    }

    // Polyfill for Safari 14
    function setBigUint64(view, byteOffset, value, isLE) {
        if (typeof view.setBigUint64 === 'function')
            return view.setBigUint64(byteOffset, value, isLE);
        const _32n = BigInt(32);
        const _u32_max = BigInt(0xffffffff);
        const wh = Number((value >> _32n) & _u32_max);
        const wl = Number(value & _u32_max);
        const h = isLE ? 4 : 0;
        const l = isLE ? 0 : 4;
        view.setUint32(byteOffset + h, wh, isLE);
        view.setUint32(byteOffset + l, wl, isLE);
    }
    // Base SHA2 class (RFC 6234)
    class SHA2 extends Hash {
        constructor(blockLen, outputLen, padOffset, isLE) {
            super();
            this.blockLen = blockLen;
            this.outputLen = outputLen;
            this.padOffset = padOffset;
            this.isLE = isLE;
            this.finished = false;
            this.length = 0;
            this.pos = 0;
            this.destroyed = false;
            this.buffer = new Uint8Array(blockLen);
            this.view = createView(this.buffer);
        }
        update(data) {
            assert.exists(this);
            const { view, buffer, blockLen } = this;
            data = toBytes(data);
            const len = data.length;
            for (let pos = 0; pos < len;) {
                const take = Math.min(blockLen - this.pos, len - pos);
                // Fast path: we have at least one block in input, cast it to view and process
                if (take === blockLen) {
                    const dataView = createView(data);
                    for (; blockLen <= len - pos; pos += blockLen)
                        this.process(dataView, pos);
                    continue;
                }
                buffer.set(data.subarray(pos, pos + take), this.pos);
                this.pos += take;
                pos += take;
                if (this.pos === blockLen) {
                    this.process(view, 0);
                    this.pos = 0;
                }
            }
            this.length += data.length;
            this.roundClean();
            return this;
        }
        digestInto(out) {
            assert.exists(this);
            assert.output(out, this);
            this.finished = true;
            // Padding
            // We can avoid allocation of buffer for padding completely if it
            // was previously not allocated here. But it won't change performance.
            const { buffer, view, blockLen, isLE } = this;
            let { pos } = this;
            // append the bit '1' to the message
            buffer[pos++] = 0b10000000;
            this.buffer.subarray(pos).fill(0);
            // we have less than padOffset left in buffer, so we cannot put length in current block, need process it and pad again
            if (this.padOffset > blockLen - pos) {
                this.process(view, 0);
                pos = 0;
            }
            // Pad until full block byte with zeros
            for (let i = pos; i < blockLen; i++)
                buffer[i] = 0;
            // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
            // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
            // So we just write lowest 64 bits of that value.
            setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
            this.process(view, 0);
            const oview = createView(out);
            this.get().forEach((v, i) => oview.setUint32(4 * i, v, isLE));
        }
        digest() {
            const { buffer, outputLen } = this;
            this.digestInto(buffer);
            const res = buffer.slice(0, outputLen);
            this.destroy();
            return res;
        }
        _cloneInto(to) {
            to || (to = new this.constructor());
            to.set(...this.get());
            const { blockLen, buffer, length, finished, destroyed, pos } = this;
            to.length = length;
            to.pos = pos;
            to.finished = finished;
            to.destroyed = destroyed;
            if (length % blockLen)
                to.buffer.set(buffer);
            return to;
        }
    }

    // Choice: a ? b : c
    const Chi = (a, b, c) => (a & b) ^ (~a & c);
    // Majority function, true if any two inpust is true
    const Maj = (a, b, c) => (a & b) ^ (a & c) ^ (b & c);
    // Round constants:
    // first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311)
    // prettier-ignore
    const SHA256_K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);
    // Initial state (first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19):
    // prettier-ignore
    const IV = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);
    // Temporary buffer, not used to store anything between runs
    // Named this way because it matches specification.
    const SHA256_W = new Uint32Array(64);
    class SHA256 extends SHA2 {
        constructor() {
            super(64, 32, 8, false);
            // We cannot use array here since array allows indexing by variable
            // which means optimizer/compiler cannot use registers.
            this.A = IV[0] | 0;
            this.B = IV[1] | 0;
            this.C = IV[2] | 0;
            this.D = IV[3] | 0;
            this.E = IV[4] | 0;
            this.F = IV[5] | 0;
            this.G = IV[6] | 0;
            this.H = IV[7] | 0;
        }
        get() {
            const { A, B, C, D, E, F, G, H } = this;
            return [A, B, C, D, E, F, G, H];
        }
        // prettier-ignore
        set(A, B, C, D, E, F, G, H) {
            this.A = A | 0;
            this.B = B | 0;
            this.C = C | 0;
            this.D = D | 0;
            this.E = E | 0;
            this.F = F | 0;
            this.G = G | 0;
            this.H = H | 0;
        }
        process(view, offset) {
            // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
            for (let i = 0; i < 16; i++, offset += 4)
                SHA256_W[i] = view.getUint32(offset, false);
            for (let i = 16; i < 64; i++) {
                const W15 = SHA256_W[i - 15];
                const W2 = SHA256_W[i - 2];
                const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ (W15 >>> 3);
                const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ (W2 >>> 10);
                SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
            }
            // Compression function main loop, 64 rounds
            let { A, B, C, D, E, F, G, H } = this;
            for (let i = 0; i < 64; i++) {
                const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
                const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
                const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
                const T2 = (sigma0 + Maj(A, B, C)) | 0;
                H = G;
                G = F;
                F = E;
                E = (D + T1) | 0;
                D = C;
                C = B;
                B = A;
                A = (T1 + T2) | 0;
            }
            // Add the compressed chunk to the current hash value
            A = (A + this.A) | 0;
            B = (B + this.B) | 0;
            C = (C + this.C) | 0;
            D = (D + this.D) | 0;
            E = (E + this.E) | 0;
            F = (F + this.F) | 0;
            G = (G + this.G) | 0;
            H = (H + this.H) | 0;
            this.set(A, B, C, D, E, F, G, H);
        }
        roundClean() {
            SHA256_W.fill(0);
        }
        destroy() {
            this.set(0, 0, 0, 0, 0, 0, 0, 0);
            this.buffer.fill(0);
        }
    }
    /**
     * SHA2-256 hash function
     * @param message - data that would be hashed
     */
    const sha256 = wrapConstructor(() => new SHA256());

    // HMAC (RFC 2104)
    class HMAC extends Hash {
        constructor(hash, _key) {
            super();
            this.finished = false;
            this.destroyed = false;
            assert.hash(hash);
            const key = toBytes(_key);
            this.iHash = hash.create();
            if (!(this.iHash instanceof Hash))
                throw new TypeError('Expected instance of class which extends utils.Hash');
            const blockLen = (this.blockLen = this.iHash.blockLen);
            this.outputLen = this.iHash.outputLen;
            const pad = new Uint8Array(blockLen);
            // blockLen can be bigger than outputLen
            pad.set(key.length > this.iHash.blockLen ? hash.create().update(key).digest() : key);
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36;
            this.iHash.update(pad);
            // By doing update (processing of first block) of outer hash here we can re-use it between multiple calls via clone
            this.oHash = hash.create();
            // Undo internal XOR && apply outer XOR
            for (let i = 0; i < pad.length; i++)
                pad[i] ^= 0x36 ^ 0x5c;
            this.oHash.update(pad);
            pad.fill(0);
        }
        update(buf) {
            assert.exists(this);
            this.iHash.update(buf);
            return this;
        }
        digestInto(out) {
            assert.exists(this);
            assert.bytes(out, this.outputLen);
            this.finished = true;
            this.iHash.digestInto(out);
            this.oHash.update(out);
            this.oHash.digestInto(out);
            this.destroy();
        }
        digest() {
            const out = new Uint8Array(this.oHash.outputLen);
            this.digestInto(out);
            return out;
        }
        _cloneInto(to) {
            // Create new instance without calling constructor since key already in state and we don't know it.
            to || (to = Object.create(Object.getPrototypeOf(this), {}));
            const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
            to = to;
            to.finished = finished;
            to.destroyed = destroyed;
            to.blockLen = blockLen;
            to.outputLen = outputLen;
            to.oHash = oHash._cloneInto(to.oHash);
            to.iHash = iHash._cloneInto(to.iHash);
            return to;
        }
        destroy() {
            this.destroyed = true;
            this.oHash.destroy();
            this.iHash.destroy();
        }
    }
    /**
     * HMAC: RFC2104 message authentication code.
     * @param hash - function that would be used e.g. sha256
     * @param key - message key
     * @param message - message data
     */
    const hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
    hmac.create = (hash, key) => new HMAC(hash, key);

    // Common prologue and epilogue for sync/async functions
    function pbkdf2Init(hash, _password, _salt, _opts) {
        assert.hash(hash);
        const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
        const { c, dkLen, asyncTick } = opts;
        assert.number(c);
        assert.number(dkLen);
        assert.number(asyncTick);
        if (c < 1)
            throw new Error('PBKDF2: iterations (c) should be >= 1');
        const password = toBytes(_password);
        const salt = toBytes(_salt);
        // DK = PBKDF2(PRF, Password, Salt, c, dkLen);
        const DK = new Uint8Array(dkLen);
        // U1 = PRF(Password, Salt + INT_32_BE(i))
        const PRF = hmac.create(hash, password);
        const PRFSalt = PRF._cloneInto().update(salt);
        return { c, dkLen, asyncTick, DK, PRF, PRFSalt };
    }
    function pbkdf2Output(PRF, PRFSalt, DK, prfW, u) {
        PRF.destroy();
        PRFSalt.destroy();
        if (prfW)
            prfW.destroy();
        u.fill(0);
        return DK;
    }
    /**
     * PBKDF2-HMAC: RFC 2898 key derivation function
     * @param hash - hash function that would be used e.g. sha256
     * @param password - password from which a derived key is generated
     * @param salt - cryptographic salt
     * @param opts - {c, dkLen} where c is work factor and dkLen is output message size
     */
    function pbkdf2(hash, password, salt, opts) {
        const { c, dkLen, DK, PRF, PRFSalt } = pbkdf2Init(hash, password, salt, opts);
        let prfW; // Working copy
        const arr = new Uint8Array(4);
        const view = createView(arr);
        const u = new Uint8Array(PRF.outputLen);
        // DK = T1 + T2 + ⋯ + Tdklen/hlen
        for (let ti = 1, pos = 0; pos < dkLen; ti++, pos += PRF.outputLen) {
            // Ti = F(Password, Salt, c, i)
            const Ti = DK.subarray(pos, pos + PRF.outputLen);
            view.setInt32(0, ti, false);
            // F(Password, Salt, c, i) = U1 ^ U2 ^ ⋯ ^ Uc
            // U1 = PRF(Password, Salt + INT_32_BE(i))
            (prfW = PRFSalt._cloneInto(prfW)).update(arr).digestInto(u);
            Ti.set(u.subarray(0, Ti.length));
            for (let ui = 1; ui < c; ui++) {
                // Uc = PRF(Password, Uc−1)
                PRF._cloneInto(prfW).update(u).digestInto(u);
                for (let i = 0; i < Ti.length; i++)
                    Ti[i] ^= u[i];
            }
        }
        return pbkdf2Output(PRF, PRFSalt, DK, prfW, u);
    }

    // RFC 7914 Scrypt KDF
    // Left rotate for uint32
    const rotl = (a, b) => (a << b) | (a >>> (32 - b));
    // The main Scrypt loop: uses Salsa extensively.
    // Six versions of the function were tried, this is the fastest one.
    // prettier-ignore
    function XorAndSalsa(prev, pi, input, ii, out, oi) {
        // Based on https://cr.yp.to/salsa20.html
        // Xor blocks
        let y00 = prev[pi++] ^ input[ii++], y01 = prev[pi++] ^ input[ii++];
        let y02 = prev[pi++] ^ input[ii++], y03 = prev[pi++] ^ input[ii++];
        let y04 = prev[pi++] ^ input[ii++], y05 = prev[pi++] ^ input[ii++];
        let y06 = prev[pi++] ^ input[ii++], y07 = prev[pi++] ^ input[ii++];
        let y08 = prev[pi++] ^ input[ii++], y09 = prev[pi++] ^ input[ii++];
        let y10 = prev[pi++] ^ input[ii++], y11 = prev[pi++] ^ input[ii++];
        let y12 = prev[pi++] ^ input[ii++], y13 = prev[pi++] ^ input[ii++];
        let y14 = prev[pi++] ^ input[ii++], y15 = prev[pi++] ^ input[ii++];
        // Save state to temporary variables (salsa)
        let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
        // Main loop (salsa)
        for (let i = 0; i < 8; i += 2) {
            x04 ^= rotl(x00 + x12 | 0, 7);
            x08 ^= rotl(x04 + x00 | 0, 9);
            x12 ^= rotl(x08 + x04 | 0, 13);
            x00 ^= rotl(x12 + x08 | 0, 18);
            x09 ^= rotl(x05 + x01 | 0, 7);
            x13 ^= rotl(x09 + x05 | 0, 9);
            x01 ^= rotl(x13 + x09 | 0, 13);
            x05 ^= rotl(x01 + x13 | 0, 18);
            x14 ^= rotl(x10 + x06 | 0, 7);
            x02 ^= rotl(x14 + x10 | 0, 9);
            x06 ^= rotl(x02 + x14 | 0, 13);
            x10 ^= rotl(x06 + x02 | 0, 18);
            x03 ^= rotl(x15 + x11 | 0, 7);
            x07 ^= rotl(x03 + x15 | 0, 9);
            x11 ^= rotl(x07 + x03 | 0, 13);
            x15 ^= rotl(x11 + x07 | 0, 18);
            x01 ^= rotl(x00 + x03 | 0, 7);
            x02 ^= rotl(x01 + x00 | 0, 9);
            x03 ^= rotl(x02 + x01 | 0, 13);
            x00 ^= rotl(x03 + x02 | 0, 18);
            x06 ^= rotl(x05 + x04 | 0, 7);
            x07 ^= rotl(x06 + x05 | 0, 9);
            x04 ^= rotl(x07 + x06 | 0, 13);
            x05 ^= rotl(x04 + x07 | 0, 18);
            x11 ^= rotl(x10 + x09 | 0, 7);
            x08 ^= rotl(x11 + x10 | 0, 9);
            x09 ^= rotl(x08 + x11 | 0, 13);
            x10 ^= rotl(x09 + x08 | 0, 18);
            x12 ^= rotl(x15 + x14 | 0, 7);
            x13 ^= rotl(x12 + x15 | 0, 9);
            x14 ^= rotl(x13 + x12 | 0, 13);
            x15 ^= rotl(x14 + x13 | 0, 18);
        }
        // Write output (salsa)
        out[oi++] = (y00 + x00) | 0;
        out[oi++] = (y01 + x01) | 0;
        out[oi++] = (y02 + x02) | 0;
        out[oi++] = (y03 + x03) | 0;
        out[oi++] = (y04 + x04) | 0;
        out[oi++] = (y05 + x05) | 0;
        out[oi++] = (y06 + x06) | 0;
        out[oi++] = (y07 + x07) | 0;
        out[oi++] = (y08 + x08) | 0;
        out[oi++] = (y09 + x09) | 0;
        out[oi++] = (y10 + x10) | 0;
        out[oi++] = (y11 + x11) | 0;
        out[oi++] = (y12 + x12) | 0;
        out[oi++] = (y13 + x13) | 0;
        out[oi++] = (y14 + x14) | 0;
        out[oi++] = (y15 + x15) | 0;
    }
    function BlockMix(input, ii, out, oi, r) {
        // The block B is r 128-byte chunks (which is equivalent of 2r 64-byte chunks)
        let head = oi + 0;
        let tail = oi + 16 * r;
        for (let i = 0; i < 16; i++)
            out[tail + i] = input[ii + (2 * r - 1) * 16 + i]; // X ← B[2r−1]
        for (let i = 0; i < r; i++, head += 16, ii += 16) {
            // We write odd & even Yi at same time. Even: 0bXXXXX0 Odd:  0bXXXXX1
            XorAndSalsa(out, tail, input, ii, out, head); // head[i] = Salsa(blockIn[2*i] ^ tail[i-1])
            if (i > 0)
                tail += 16; // First iteration overwrites tmp value in tail
            XorAndSalsa(out, head, input, (ii += 16), out, tail); // tail[i] = Salsa(blockIn[2*i+1] ^ head[i])
        }
    }
    // Common prologue and epilogue for sync/async functions
    function scryptInit(password, salt, _opts) {
        // Maxmem - 1GB+1KB by default
        const opts = checkOpts({
            dkLen: 32,
            asyncTick: 10,
            maxmem: 1024 ** 3 + 1024,
        }, _opts);
        const { N, r, p, dkLen, asyncTick, maxmem, onProgress } = opts;
        assert.number(N);
        assert.number(r);
        assert.number(p);
        assert.number(dkLen);
        assert.number(asyncTick);
        assert.number(maxmem);
        if (onProgress !== undefined && typeof onProgress !== 'function')
            throw new Error('progressCb should be function');
        const blockSize = 128 * r;
        const blockSize32 = blockSize / 4;
        if (N <= 1 || (N & (N - 1)) !== 0 || N >= 2 ** (blockSize / 8) || N > 2 ** 32) {
            // NOTE: we limit N to be less than 2**32 because of 32 bit variant of Integrify function
            // There is no JS engines that allows alocate more than 4GB per single Uint8Array for now, but can change in future.
            throw new Error('Scrypt: N must be larger than 1, a power of 2, less than 2^(128 * r / 8) and less than 2^32');
        }
        if (p < 0 || p > ((2 ** 32 - 1) * 32) / blockSize) {
            throw new Error('Scrypt: p must be a positive integer less than or equal to ((2^32 - 1) * 32) / (128 * r)');
        }
        if (dkLen < 0 || dkLen > (2 ** 32 - 1) * 32) {
            throw new Error('Scrypt: dkLen should be positive integer less than or equal to (2^32 - 1) * 32');
        }
        const memUsed = blockSize * (N + p);
        if (memUsed > maxmem) {
            throw new Error(`Scrypt: parameters too large, ${memUsed} (128 * r * (N + p)) > ${maxmem} (maxmem)`);
        }
        // [B0...Bp−1] ← PBKDF2HMAC-SHA256(Passphrase, Salt, 1, blockSize*ParallelizationFactor)
        // Since it has only one iteration there is no reason to use async variant
        const B = pbkdf2(sha256, password, salt, { c: 1, dkLen: blockSize * p });
        const B32 = u32(B);
        // Re-used between parallel iterations. Array(iterations) of B
        const V = u32(new Uint8Array(blockSize * N));
        const tmp = u32(new Uint8Array(blockSize));
        let blockMixCb = () => { };
        if (onProgress) {
            const totalBlockMix = 2 * N * p;
            // Invoke callback if progress changes from 10.01 to 10.02
            // Allows to draw smooth progress bar on up to 8K screen
            const callbackPer = Math.max(Math.floor(totalBlockMix / 10000), 1);
            let blockMixCnt = 0;
            blockMixCb = () => {
                blockMixCnt++;
                if (onProgress && (!(blockMixCnt % callbackPer) || blockMixCnt === totalBlockMix))
                    onProgress(blockMixCnt / totalBlockMix);
            };
        }
        return { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick };
    }
    function scryptOutput(password, dkLen, B, V, tmp) {
        const res = pbkdf2(sha256, password, B, { c: 1, dkLen });
        B.fill(0);
        V.fill(0);
        tmp.fill(0);
        return res;
    }
    /**
     * Scrypt KDF from RFC 7914.
     * @param password - pass
     * @param salt - salt
     * @param opts - parameters
     * - `N` is cpu/mem work factor (power of 2 e.g. 2**18)
     * - `r` is block size (8 is common), fine-tunes sequential memory read size and performance
     * - `p` is parallelization factor (1 is common)
     * - `dkLen` is output key length in bytes e.g. 32.
     * - `asyncTick` - (default: 10) max time in ms for which async function can block execution
     * - `maxmem` - (default: `1024 ** 3 + 1024` aka 1GB+1KB). A limit that the app could use for scrypt
     * - `onProgress` - callback function that would be executed for progress report
     * @returns Derived key
     */
    function scrypt(password, salt, opts) {
        const { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb } = scryptInit(password, salt, opts);
        for (let pi = 0; pi < p; pi++) {
            const Pi = blockSize32 * pi;
            for (let i = 0; i < blockSize32; i++)
                V[i] = B32[Pi + i]; // V[0] = B[i]
            for (let i = 0, pos = 0; i < N - 1; i++) {
                BlockMix(V, pos, V, (pos += blockSize32), r); // V[i] = BlockMix(V[i-1]);
                blockMixCb();
            }
            BlockMix(V, (N - 1) * blockSize32, B32, Pi, r); // Process last element
            blockMixCb();
            for (let i = 0; i < N; i++) {
                // First u32 of the last 64-byte block (u32 is LE)
                const j = B32[Pi + blockSize32 - 16] % N; // j = Integrify(X) % iterations
                for (let k = 0; k < blockSize32; k++)
                    tmp[k] = B32[Pi + k] ^ V[j * blockSize32 + k]; // tmp = B ^ V[j]
                BlockMix(tmp, 0, B32, Pi, r); // B = BlockMix(B ^ V[j])
                blockMixCb();
            }
        }
        return scryptOutput(password, dkLen, B, V, tmp);
    }

    function passwordToKey(password) {
      return scrypt(password, 'steg-file', { N: 2 ** 19, r: 8, p: 1 });
    }
    function el(selector) {
      const e = document.querySelector(selector);
      if (!e) throw new Error('Invalid element');
      return e;
    }
    function on(selector, event, handler) {
      el(selector).addEventListener(event, handler);
    }
    const formatSize = utils.formatSize;

    function setupEncryption() {
      const cache = { bitsTaken: 1 };
      function labelFor(id) {
        return el(`#steg-encrypt label[for="${id}"] small`);
      }
      function reformat() {
        const si = cache.stegImg;
        const hf = cache.hiddenFile;
        const bt = el('#steg-encrypt-submit-button');
        if (si) el('#steg-encrypt-data-file').disabled = false;
        if (!si || !hf || !cache.key) return (bt.disabled = true);
        if (hf.size > si.calcCapacity(cache.bitsTaken).bytes) return (bt.disabled = true);
        bt.disabled = false;
      }
      on('#steg-encrypt-image', 'change', async (ev) => {
        const img = await RawFile.fromFileInput(ev.target);
        cache.stegImg = await StegImage.fromBytesOrURL(img.data);
        const minSize = formatSize(cache.stegImg.calcCapacity(1).bytes);
        const maxSize = formatSize(cache.stegImg.calcCapacity(8).bytes);
        labelFor(
          'steg-encrypt-image'
        ).innerHTML = `can hide <strong>from ${minSize} to ${maxSize}</strong> of data`;
        ev.target.disabled = true;
        el('#steg-encrypt-data-file').disabled = false;
        reformat();
      });
      on('#steg-encrypt-data-file', 'change', async (ev) => {
        cache.hiddenFile = await RawFile.fromFileInput(ev.target);
        labelFor('steg-encrypt-data-file').innerHTML = `with size of <strong>${formatSize(
      cache.hiddenFile.size
    )}</strong>`;
        el('#steg-encrypt-password').disabled = false;
        reformat();
      });
      on('#steg-encrypt-password', 'change', (ev) => {
        const t = ev.target;
        const l = labelFor('steg-encrypt-password');
        if (t.validity.valid) {
          cache.key = passwordToKey(t.value);
          l.innerHTML = '<strong>set<strong>';
        } else {
          l.innerHTML = 'Invalid password';
        }
        reformat();
      });
      on('#steg-encrypt-bits-taken', 'change', (ev) => {
        const val = Number.parseInt(ev.target.value);
        cache.bitsTaken = val;
        el('#steg-encrypt-bits-taken-value').textContent = val;
        const capacity = cache.stegImg.calcCapacity(val).bytes;
        labelFor('steg-encrypt-bits-taken').innerHTML = `gets capacity of ${formatSize(
      capacity
    )}`;
        reformat();
      });
      on('#steg-encrypt', 'submit', async (ev) => {
        ev.preventDefault();
        if (!(cache.stegImg && cache.hiddenFile && cache.key)) return;
        const url = await cache.stegImg.hide(cache.hiddenFile, cache.key, cache.bitsTaken);
        await utils.setImageSource(el('#steg-encrypt-output'), url);
        const dl = el('#steg-encrypt-download');
        dl.removeAttribute('hidden');
        dl.addEventListener('click', (ev) => {
          ev.preventDefault();
          utils.downloadFile(url);
        });
      });
    }
    function setupDecryption() {
      const cache = {};
      function labelFor(id) {
        return el(`#steg-decrypt label[for="${id}"] small`);
      }
      on('#steg-decrypt-file', 'change', async (ev) => {
        const image = await RawFile.fromFileInput(ev.target);
        const simg = await StegImage.fromBytesOrURL(image.data);
        const l = labelFor('steg-decrypt-file');
        try {
          const bitsTaken = simg.revealBitsTaken();
          const cap = simg.calcCapacity(bitsTaken);
          l.innerHTML = `amidst max size of <strong>${formatSize(cap.bytes)}</strong>`;
          cache.simg = simg;
        } catch (error) {
          l.innerHTML = 'Incorrect bitsTaken header: probably not a steg png';
        }
      });
      on('#steg-decrypt-password', 'change', (ev) => {
        const t = ev.target;
        const l = labelFor('steg-decrypt-password');
        const input = el('#steg-decrypt-submit');
        if (t.validity.valid) {
          cache.key = passwordToKey(t.value);
          l.innerHTML = '<strong>set<strong>';
          input.disabled = false;
        } else {
          l.innerHTML = 'Invalid password';
          input.disabled = true;
        }
      });
      on('#steg-decrypt', 'submit', async (ev) => {
        ev.preventDefault();
        if (!cache.key || !cache.simg) return;
        const status = el('#steg-decrypt-status');
        const cont = el('#steg-decrypt-output-container');
        let revealed;
        try {
          revealed = await cache.simg.reveal(cache.key);
        } catch (error) {
          cont.hidden = true;
          status.textContent = `Decryption error, probably invalid password: ${error.message}`;
          return;
        }
        cont.hidden = false;
        status.textContent = 'Successfully decrypted';
        el('#steg-decrypt-output-metadata').innerHTML = `hidden file <strong>${
      revealed.name
    }</strong> with size of <strong>${formatSize(revealed.size)}</strong> (${
      revealed.size
    }B)`;
        el('#steg-decrypt-download').addEventListener('click', (ev) => {
          ev.preventDefault();
          revealed.download();
        });
      });
    }

    function onDocumentReady() {
      function listen() {
        setupEncryption();
        setupDecryption();
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', listen);
      } else {
        listen();
      }
    }

    onDocumentReady();

}));
