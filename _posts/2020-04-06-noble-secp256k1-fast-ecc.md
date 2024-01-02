---
layout: post
title: 'Learning fast elliptic-curve cryptography'
tags: ['programming']
highlight: true
---

It’s great to create tools that serve as a foundation for developer projects. Huge impact. Last year, we’ve released [Chokidar 3](/posts/chokidar-3-save-32tb-of-traffic/) file watcher and started saving terabytes of NPM traffic daily while improving overall security of JS ecosystem. You may have Chokidar on your machine if you're coding in [VSCode](https://code.visualstudio.com/).

After this, i’ve started diving more into cryptography. It's very useful to know how those algorithms work, to be able to verify them & to create safe systems.

It was immediately clear that Elliptic Curve Cryptography (ECC) libraries must be improved. In this post i'll describe how to make **one of the fastest** JS implementations of *secp256k1*, that can be **audited by non-cryptographers**.

[![](/media/posts/noble-secp256k1-fast-ecc/curve.jpg)](/media/posts/noble-secp256k1-fast-ecc/curve.jpg)

- [State of cryptography in JS](#state-of-cryptography-in-js)
- [Naïve, but very simple first take](#na%c3%afve-but-very-simple-first-take)
- [Public keys](#public-keys)
- [Fighting timing attacks](#fighting-timing-attacks)
- [JS BigInts, JIT, GC and other scary words](#js-bigints-jit-gc-and-other-scary-words)
- [Signing & verification with precomputes](#signing--verification-with-precomputes)
- [Jacobi coordinates](#jacobi-coordinates)
- [w-ary non-adjacent form](#w-ary-non-adjacent-form)
- [Unsafe multiplication for key recovery](#unsafe-multiplication-for-key-recovery)
- [Batch inversion](#batch-inversion)
- [End game: Endomorphism](#end-game-endomorphism)
- [Future plans](#future-plans)

### State of cryptography in JS
If you could characterize state of JS cryptography in one word, it would be: “sad”.

- There are lots of 3rd-party libraries that implement all sorts of primitives. Even though [some authors](https://github.com/dchest/) write simple & high-quality code, most libs share one common property: they depend on other libraries. Essentially this means that if you install [elliptic](https://github.com/indutny/elliptic/), a standard & very popular package for ECC, you’ll get 9,000 lines of code, which are hard to understand & hard to read.  As i’ve mentioned before, **every dependency is a potential security vulnerability** — any underlying package could get hacked & malwared. This is unacceptable for cryptographic primitives, which are made to defend user secrets.
- `window.crypto` standard for in-browser primitives is unnecessarily complicated. It also doesn’t have popular curves like `secp256k1` or `ed25519`. node.js doesn’t support `window.crypto`, which means you need to write twice as much code for cross-platform apps.
- You can compile C software to wasm. But wasm is not really an option. Wasm is a binary format. If the goal is auditable source code, how exactly are you supposed to audit wasm running on a site you’re visiting? Even if we’re talking about node.js packages for your own app, those distribute *compiled* wasm code, which is just as unhelpful. No one distributes wasm hashes nowadays.
- Small tidbit. A modulo operator is commonly used in cryptography. In JS, `%` operator is not the *modulo* operator but the *remainder* operator. In computer science theory, those mean different things. Specifically, *modulo* can not be negative. So, we need to re-implement the operator, even though it takes 3 lines. By the way, Python doesn’t have this problem.

### Naïve, but very simple first take
Taking all of this into consideration, i’ve decided to create TypeScript libraries that don’t use dependencies & are simple to audit for everyone. Having no "deep" math background, it wasn’t that simple. [Cloudflare blog post](https://blog.cloudflare.com/a-relatively-easy-to-understand-primer-on-elliptic-curve-cryptography/), [Nakov’s book](https://cryptobook.nakov.com/) and [Andrea’s blog post](https://andrea.corbellini.name/2015/05/17/elliptic-curve-cryptography-a-gentle-introduction/) have all been very useful.

And you can’t just go ahead and read through the code. Almost every implementation — even in Haskell — work with unreadable and highly optimized code. In a real world, we’ll see [something more like](https://github.com/dchest/tweetnacl-js/blob/71df1d6a1d78236ca3e9f6c788786e21f5a651a6/nacl.js#L386):

```js
for (i=254; i>=0; --i) {
  r=(z[i>>>3]>>>(i&7))&1;
  sel25519(a,b,r);
  sel25519(c,d,r);
  A(e,a,c);
  Z(a,a,c);
  A(c,b,d);
  Z(b,b,d);
  S(d,e);
}
```

The only lib i've found useful, besides Noble, was [fastecdsa.py](https://github.com/AntonKueltz/fastecdsa); unfortunately it only appeared recently. Unfortunately, almost every library doesn't support Big Integers. It's much easier to reason with numbers, instead of byte arrays.

### Public keys

We will start with a function that takes private key and generates public key from it. Books tell us that to produce public key `Q` (a Point on EC), we need to multiply some base point `G` by a random number `q`: `Q = G × q`

We need to do [elliptic curve point multiplication](https://en.wikipedia.org/wiki/Elliptic_curve_point_multiplication). Multiplying a point G by a number q is as simple as doing G + G + G...q times. But how do we add two points, `(x1, y1) + (x2, y2)` and get `(x3, y3)`? Let's glance over [hyperelliptic.org by Tanja Lange](http://hyperelliptic.org/EFD/g1p/auto-shortw.html):

```
x3 = (y2-y1)**2/(x2-x1)**2-x1-x2
y3 = (2*x1+x2)*(y2-y1)/(x2-x1)-(y2-y1)**3/(x2-x1)**3-y1
```

Simple, but not quite. Keep in mind: we're working in a finite field over some big prime `Curve.P`. This basically means all operations — additions, multiplications, subtractions — would be done `modulo Curve.P`. And, as it seems, there is no classic division in finite fields. Instead, a [*modular multiplicative inverse*](https://en.wikipedia.org/wiki/Modular_multiplicative_inverse) is used. It is most efficiently calculated by iterative version of Euclid’s GCD algorithm. Let’s code this:

```typescript
const CURVE = {
  P: 2n ** 256n - 2n ** 32n - 977n,
  n: 2n ** 256n - 432420386565659656852420866394968145599n
};
class Point {
  static ZERO = new Point(0n, 0n); // Point at infinity aka identity point aka zero
  constructor(public x: bigint, public y: bigint) {}
  // Adds point to itself. http://hyperelliptic.org/EFD/g1p/auto-shortw.html
  double(): Point {
    const X1 = this.x;
    const Y1 = this.y;
    const lam = mod(3n * X1 ** 2n * invert(2n * Y1, CURVE.P));
    const X3 = mod(lam * lam - 2n * X1);
    const Y3 = mod(lam * (X1 - X3) - Y1);
    return new Point(X3, Y3);
  }
  // Adds point to other point. http://hyperelliptic.org/EFD/g1p/auto-shortw.html
  add(other: Point): Point {
    const [a, b] = [this, other];
    const [X1, Y1, X2, Y2] = [a.x, a.y, b.x, b.y];
    if (X1 === 0n || Y1 === 0n) return b;
    if (X2 === 0n || Y2 === 0n) return a;
    if (X1 === X2 && Y1 === Y2) return this.double();
    if (X1 === X2 && Y1 === -Y2) return Point.ZERO;
    const lam = mod((Y2 - Y1) * invert(X2 - X1, CURVE.P));
    const X3 = mod(lam * lam - X1 - X2);
    const Y3 = mod(lam * (X1 - X3) - Y1);
    return new Point(X3, Y3);
  }
}
function mod(a: bigint, b: bigint = CURVE.P): bigint {
  const result = a % b;
  return result >= 0 ? result : b + result;
}
// Inverses number over modulo
function invert(number: bigint, modulo: bigint = CURVE.P): bigint {
  if (number === 0n || modulo <= 0n) {
    throw new Error(`invert: expected positive integers, got n=${number} mod=${modulo}`);
  }
  // Eucledian GCD https://brilliant.org/wiki/extended-euclidean-algorithm/
  let a = mod(number, modulo);
  let b = modulo;
  let x = 0n, y = 1n, u = 1n, v = 0n;
  while (a !== 0n) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a; a = r;
    x = u; y = v;
    u = m; v = n;
  }
  const gcd = b;
  if (gcd !== 1n) throw new Error('invert: does not exist');
  return mod(x, modulo);
}
```

Now, we can create `getPublicKey`, which is `Q = G × q`. We’ll add `Point#multiply` method which uses [double-and-add algorithm](https://en.wikipedia.org/wiki/Elliptic_curve_point_multiplication).

```typescript
// G x, y values taken from official secp256k1 document
CURVE.Gx = 55066263022277343669578718895168534326250603453777594175500187360389116729240n;
CURVE.Gy = 32670510020758816978083085130507043184471273380659243275938904335757337482424n;
class Point {
  // Elliptic curve point multiplication with double-and-add algo.
  multiplyDA(n: bigint) {
    let p = Point.ZERO;
    let d: Point = this;
    while (n > 0n) {
      if (n & 1n) p = p.add(d);
      d = d.double();
      n >>= 1n;
    }
    return p;
  }
}
const G = new Point(CURVE.Gx, CURVE.Gy);

// Example
function getPublicKey(privKey: bigint) {
  return G.multiplyDA(privKey);
}
// console.log(getPublicKey(140n));
```

Yay, it works.

### Fighting timing attacks
[Timing attack](https://en.wikipedia.org/wiki/Timing_attack) is a side-channel attack, in which the attacker measures time your algorithms run and identifies secrets after analyzing the timings.

Suppose you have a web app which signs user messages with your private key. Private key by definition could not be known by the public. A hacker observes timings of 100,000 requests to `/sign` endpoint with different inputs. If your software executes those in different timespans, hacker could deduce your private key! More sophisticated versions of side-channel attacks observe power consumption.

This means cryptographic software must act as if inputs are identical and take identical time to work on. Which means implementing char-by-char string comparison etc.

Fortunately, timing attacks are not that widespread. You’re much more likely to get hacked through a third-party dependency.

Let’s see if we’re protected against timing attacks right now:

```typescript
measure(G.multiplyDA(2n)) // 1,561 ops/sec @ 640μs/op
measure(G.multiplyDA(2n ** 255n - 19n)) // 25 ops/sec @ 38ms/op
```

getPublicKey takes 54x as much time on a big private key, which means we’re definitely unprotected. The simplest solution here would be change our `double-and-add` algo to something more resilient:

```typescript
// Constant-time multiplication
multiplyCT(n: bigint) {
  let dbl = new Point(this.x, this.y);
  let p = Point.ZERO;
  let f = Point.ZERO; // fake point
  for (let i = 0; i <= 256; i++) {
    if (n & 1n) p = p.add(dbl); else f = f.add(dbl);
    dbl = dbl.double();
    n >>= 1n;
  }
  return p;
}
```

Basically, when the addition isn't done, we add some garbage to a fake point. Let’s measure `getPublicKey` now.

```typescript
measure(G.multiplyCT(2n)) // 25 ops/sec @ 38ms/op
measure(G.multiplyCT(2n ** 255n - 19n)) // 25 ops/sec @ 38ms/op
```

Now it is slower for some cases, but at least it's “constant-time”. If we've been using a low-level language, i'd pick [Renes-Costello-Batina 2015](https://eprint.iacr.org/2015/1060) exception-free addition / doubling formulas.

### JS BigInts, JIT, GC and other scary words
Native JS BigInts are “unsuitable for cryptography”. This means operations on those numbers are not constant-time.
I've did some tests and the "constant-timeness" is there until around 1024-bit numbers.
Since we do most operations over `modulo P` and the numbers we add/multiply are persistently less than 1024 bits,
native JS BigInt implementation chews BigInts without hassle & visible timing differences.
It takes million times more effort to execute a timing attack on this, if we have algorithmically correct `Point#multiply`.
Which means we don't need to create any additional library that is "more constant-time".

I’m also going to point to the fact JS is a dynamic language. There are at least a few locations where “constant-time” guarantees are easily shattered:

1. Garbage collection. Suddenly, your `5ms` function would take `7ms` to execute, because JS engine would decide to reclaim dead objects.
2. Just-in-time compilation. Modern JS engines have unsurmountable amount of optimizations in their JIT compilers. Our code would be optimized and deoptimized all over the place. Which means it would take different time to run depending on a context.

This means, should we be using native bigints, or a custom library with 6,000 lines of code re-implementing bigints, like `bn.js` — in both cases we won’t achieve any constant-timeness.

“Constant-time” is impossible in javascript. That’s it. The best we can do is an algorithmic constant-time & removing dependencies like bn.js which make us more likely to get malwared.

### Signing & verification with precomputes
So far we only implemented `getPublicKey`. Most ECC libraries also produce signatures and are able to verify them. Let’s take a look at formulas for `sign` & `verify`:

```
sign(m, d, k) where
  m = message to sign and h(m) is its hash converted to number
  d = private key converted to number
  k = random number
(x1, y1) = G × k
r = x1 mod n
s = (k**-1 * (h(m) + d * r) mod n

verify(r, s, m, Q) where
  r, s = outputs from sign()
  m = message to sign
  h(m) message hash converted to number
  Q = public key for private key d which signed m
w = s**-1 mod n
u1 = h(m)*w mod n
u2 = rw mod n
(x2, y2) = G × u1 + Q × u2
x2 == r
```

We can see that in both cases `sign` and `verify` depend on multiplying G by something. Which is basically `getPublicKey`. So, it would be great if we could speed-up *multiplying Base Point G*. Since we are working with numbers up to 256 bits, let’s cache `G × 2 ** bit` for all 256 bits:

```typescript
function getPrecomputes() {
  if (this.precomputes) return this.precomputes;
  this.precomputes = [];
  let dbl: Point = this;
  for (let i = 0; i < 256; i++) {
    this.precomputes.push(dbl);
    dbl = dbl.double(); // [G, 2G, 4G, 8G..., 256G], optimized
  }
  return this.precomputes;
}

// Constant-time multiplication
multiplyPreCT(n: bigint) {
  // …
  let dbls = this.getPrecomputes();
  for (let i = 0; dbl = dbls[i], i <= 256; i++) {
  // …
}

```

Let’s see what we’ve got here. Obviously, the first call would still take more time to initialize cache.

```
init x 23 ops/sec @ 42ms/op
multiplyPreCT x 49 ops/sec @ 20ms/op
```

We have 2x improvement with precomputes.

### Jacobi coordinates
Right now our call structure looks like this:

- Initialization: 256 doubles
- Multiplication: 256 adds

Let’s look closely at what happens inside `Point#add` and `Point#double`. There are some additions, some multiplications and one **invert** (aka finite field division). If we do some profiling, we can see that `invert` is extremely slow. Like, 20 or 100 times slower than multiplication by itself. So, that’s 512 **invert**s per multiplication.

[Jacobi coordinates](https://en.wikipedia.org/wiki/Jacobi_coordinates) are going to save the day. They are used to simplify and speed-up calculations. In our case, this would eliminate `invert` from both methods. By the way, our “default” x, y coordinates are called Affine.

Jacobi coordinates are represented by triple (X, Y, Z). To convert from Jacobi to Affine, we can use a simple formula: `Ax=X/Z**2, Ay=Y/Z**3`. Converting **to** Jacobi is simpler: we set Z to 1 and copy X & Y.

Let’s implement the class.

```typescript
class JacobianPoint {
  static ZERO = new JacobianPoint(0n, 1n, 0n);
  constructor(public x: bigint, public y: bigint, public z: bigint) {}
  static fromAffine(p: Point): JacobianPoint {
    return new JacobianPoint(p.x, p.y, 1n);
  }
  toAffine(invZ: bigint = invert(this.z)): Point {
    const x = mod(this.x * invZ ** 2n);
    const y = mod(this.y * invZ ** 3n);
    return new Point(x, y);
  }
}
```

We’re also going to implement `JacobianPoint#double` & `add` methods, which i’ll skip here because they’re long [(see the code separately)](https://github.com/paulmillr/noble-secp256k1). We’ll take formulas from hyperelliptic.org: [double](http://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#doubling-dbl-2009-l), [add](http://hyperelliptic.org/EFD/g1p/auto-shortw-jacobian-0.html#addition-add-1998-cmo-2). The site has variety of formulas for all kinds of curves. We select Jacobi coordinates for curve with a=0; but *not* a case where Z1=Z2, because Zs are usually different. We could use Z1=Z2 as a special case if we explicitly check their equality, but my benchmarks haven’t shown any speedups. Perhaps that would be different with a low-level language.

We’ll change our `Point#multiply` and `Point#getPrecomputes` to work with `JacobianPoint` everywhere. And just before return we’ll execute `JacobianPoint#toAffine()` to get default `Point`.

```typescript
multiplyPreCTJ(n: bigint) {
  const precomputes = this.getPrecomputesJ();
  let dbl = JacobianPoint.fromAffine(this);
  let p = JacobianPoint.ZERO;
  let f = JacobianPoint.ZERO; // fake point
  for (let i = 0; dbl = precomputes[i], i < 256; i++) {
    if (n & 1n) p = p.add(dbl); else f = f.add(dbl);
    n >>= 1n;
  }
  return p.toAffine();
}
```

Let’s see how this improves things for us:

```
init x 247 ops/sec @ 4ms/op
multiplyPreCTJ x 536 ops/sec @ 1ms/op
```

Woah! That’s 11x improvement for `multiply`.

### w-ary non-adjacent form
Let’s see if we can use faster point multiplication. We have been using double-and-add first, but then switched to full loop to preserve constant time.

[wNAF method](https://en.wikipedia.org/wiki/Elliptic_curve_point_multiplication) allows to implement faster constant time multiplication. Our adjusted version of wNAF goes further. Instead of saving 256 points like we did before, we would save 520 (W=4), 4224 (W=8) or 557056 (W=16). We could also do this with windowed method, but wNAF saves us ½ RAM and is 2x faster in init time. The reason for this is that wNAF does addition and subtraction — and for subtraction it simply negates point, which can be done in constant time.

```typescript
precomputesW: JacobianPoint[] = [];
private precomputeWindow(W: number): JacobianPoint[] {
  if (this.precomputesW.length) return this.precomputesW;
  const windows = 256 / W + 1;
  const windowSize = 2 ** (W - 1);
  let points: JacobianPoint[] = [];
  let p = JacobianPoint.fromAffine(this);
  let base = p;
  for (let window = 0; window < windows; window++) {
    base = p;
    points.push(base);
    for (let i = 1; i < windowSize; i++) {
      base = base.add(p);
      points.push(base);
    }
    p = base.double();
  }
  this.precomputesW = points;
  return points;
}
private wNAF(n: bigint, W = 4) {
  if (256 % W) {
    throw new Error('Point#wNAF: Invalid precomputation window, must be power of 2');
  }
  const precomputes = this.precomputeWindow(W);

  let p = JacobianPoint.ZERO;
  let f = JacobianPoint.ZERO;

  const windows = 256 / W + 1;
  const windowSize = 2 ** (W - 1);
  const mask = BigInt(2 ** W - 1); // Create mask with W ones: 0b1111 for W=4 etc.
  const maxNumber = 2 ** W;
  const shiftBy = BigInt(W);

  for (let window = 0; window < windows; window++) {
    const offset = window * windowSize;
    // Extract W bits.
    let wbits = Number(n & mask);

    // Shift number by W bits.
    n >>= shiftBy;

    // If the bits are bigger than max size, we’ll split those.
    // +224 => 256 - 32
    if (wbits > windowSize) {
      wbits -= maxNumber;
      n += 1n;
    }

    // Check if we’re onto Zero point.
    // Add random point inside current window to f.
    if (wbits === 0) {
      f = f.add(precomputes[offset]);
    } else {
      const cached = precomputes[offset + Math.abs(wbits) - 1];
      p = p.add(wbits < 0 ? cached.negate() : cached);
    }
  }
  return {p, f};
}
multiplywNAF(n: bigint): Point | JacobianPoint {
  const {p, f} = this.wNAF(n);
  f.toAffine(); // result ignored
  return p.toAffine();
}
```

Let’s see where this lands us:

```
multiplywNAF init x 196 ops/sec @ 5ms/op
multiplywNAF x 1627 ops/sec @ 614μs/op
```

So, 3x faster; even though `init` got slightly slower. You may have noticed that it’s possible to adjust `wNAF` `W` parameter: it specifies how many precomputed points we’ll calculate. Let’s adjust the parameter to `8` instead of `4`:

```
multiplywNAF init x 28 ops/sec @ 34ms/op
multiplywNAF x 2987 ops/sec @ 334μs/op
```

That’s more like it. Takes 20ms more for init, but speeds up the whole post-precompute thing 6x.

### Unsafe multiplication for key recovery
Having cacheable base point multiplication is great, but `verify` (verifies the message hash has been signed by public key `P`) and `recoverPublicKey` (recovers public key from a signature) do multiplication of custom point by a scalar.

Re-calculating cache for those every time isn’t really an option - it would take 34ms by itself. So, what we can do here?

It turns out, we don’t need constant-time multiplication for those. We are working with public keys, not private keys, so we won’t leak theirs content. You may want to skip this step, but I don’t see how it impacts security in a meaningful way.

So, let’s implement `JacobianPoint#multiplyUnsafe` using the same code from our `double-and-add` algorithm. We’ll be working directly with Jacobian Points in `verify` and `recoverPublicKey` .

```typescript
class JacobianPoint {
  multiplyUnsafe(n: bigint) {
    let p = JacobianPoint.ZERO;
    let d: JacobianPoint = this;
    while (n > 0n) {
      if (n & 1n) p = p.add(d);
      d = d.double();
      n >>= 1n;
    }
    return p;
  }
}
function sign(msg: string, priv: bigint) {
  // omitted
}
function verify(r: bigint, s: bigint, msg: string, pubkey: Point): boolean {
  const h = mod(BigInt('0x' + msg), CURVE.n);
  const P = JacobianPoint.fromAffine(pubkey);
  const is = invert(s, CURVE.n);
  const u1 = mod(h * is, CURVE.n);
  const u2 = mod(r * is, CURVE.n);
  const R = G.multiply(u1).add(P.multiplyUnsafe(u2)).toAffine();
  const v = mod(R.x, CURVE.n);
  return v === r;
}
```

That gets us here:

```
getPublicKey x 3064 ops/sec @ 326μs/op
sign x 2058 ops/sec @ 485μs/op
verify x 381 ops/sec @ 2ms/op
recoverPublicKey x 215 ops/sec @ 4ms/op
getSharedSecret aka ecdh x 348 ops/sec @ 2ms/op
```

### Batch inversion
There’s a trick called Montgomery Batch Inversion. Basically it works like the picture says. We get a bunch a numbers, do one inverse, and then we apply it to all numbers.

[![](/media/posts/noble-secp256k1-fast-ecc/batch.jpg)](/media/posts/noble-secp256k1-fast-ecc/batch.jpg)

We don’t really use `invert` anywhere except for a few places at this point. So, i’ve thought it would be a great idea to implement batch inversion for cases like `verifyBatch`, that would take 50 signatures & verify them.

```typescript
function invertBatch(nums: bigint[], n: bigint = CURVE.P): bigint[] {
  const len = nums.length;
  const scratch = new Array(len);
  let acc = 1n;
  for (let i = 0; i < len; i++) {
    if (nums[i] === 0n) continue;
    scratch[i] = acc;
    acc = mod(acc * nums[i], n);
  }
  acc = invert(acc, n);
  for (let i = len - 1; i >= 0; i--) {
    if (nums[i] === 0n) continue;
    let tmp = mod(acc * nums[i], n);
    nums[i] = mod(acc * scratch[i], n);
    acc = tmp;
  }
  return nums;
}
```

Unfortunately, profiling told me having one batch on 50-100 signatures saves about 2% of CPU time. And complicates code a lot. For those interested on implementing `verifyBatch` in a low-level language, check out [the source code](https://github.com/paulmillr/noble-secp256k1/issues/3).

For us, we could still apply batch inversion in an unexpected place. Which is: `Point#precomputeWindow`. Before returning points list, we will do this:

```typescript
function toAffineBatch(points: JacobianPoint[]): Point[] {
  const toInv = invertBatch(points.map(p => p.z));
  return points.map((p, i) => p.toAffine(toInv[i]));
}
points = JacobianPoint.toAffineBatch(points).map(JacobianPoint.fromAffine);
```

What are we doing here? We take Jacobian Points, convert them to affine points, and then create jacobian points again. Why?

To normalize all `Z`s to `1`! As it turns out, the normalization speeds up our computation a bit:

```
getPublicKey x 4,101 ops/sec @ 243μs/op
sign x 2,592 ops/sec @ 385μs/op
verify x 441 ops/sec @ 2ms/op
recoverPublicKey x 215 ops/sec @ 4ms/op
getSharedSecret aka ecdh x 335 ops/sec @ 2ms/op
```

It even speeds up `getPublicKey` aka `Point#multiply`.

### End game: Endomorphism
Alright, there’s almost nothing we can do without making this hardcore. Let’s get hardcore. But not too much — otherwise, the code would be unauditable.

To improve performance even more, we must look at the properties at our underlying elliptic curve.

We are using special case of short weistrass curve, called Koblitz Curve. Weistrass curve is defined by equation `y**2 = x**3+a*x+b`. Our “Koblitz” curve has a = 0, b=7, which makes equation `y**2 = x**3+7`.

Some folks tell us that secp256k1 may not have a [backdoor that secp256r1 (aka NSA/NIST-256) has](https://crypto.stackexchange.com/questions/10263/should-we-trust-the-nist-recommended-ecc-parameters), but we won’t dive deeply into this. Let’s just say secp256k1 params were chosen in a special transparent way that allows so-called **efficiently-computable endomorphism φ**.

This idea was popularized for the curve [by Hal Finney](https://gist.github.com/paulmillr/eb670806793e84df628a7c434a873066). Based on pages 125-129 of the Guide to Elliptic Curve Cryptography, by Hankerson, Menezes and Vanstone, it basically says that if we find special values β and λ, we could speed-up computation by placing them in right places:`lambda * Q = (beta*x mod p, y)`.

1. We need values λ and β. We need to split a number by which we’ll be multiplying `Point` or `JacobianPoint`.
2. We need to multiply points twice in `multiply` / `JacobianPoint#multiplyUnsafe`.
3. We need to change window param in `getPrecomputes` from 256 to 128 since we’re splitting 256-bit number into two 128-bit.

I’ll provide the implementation of `splitScalar`, and implementation of `JacobianPoint#multiply`, the rest you can see in [noble-secp256k1 source code](https://github.com/paulmillr/noble-secp256k1).

```typescript
CURVE.lambda = 0x5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72n
CURVE.beta = 0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501een
const divNearest = (a: bigint, b: bigint) => (a + b / 2n) / b;
const POW_2_128 = 2n ** 128n;
function splitScalar(k: bigint): [boolean, bigint, boolean, bigint] {
  const { n } = CURVE;
  const a1 = 0x3086d221a7d46bcde86c90e49284eb15n;
  const b1 = -0xe4437ed6010e88286f547fa90abfe4c3n;
  const a2 = 0x114ca50f7a8e2f3f657c1108d9d44cfd8n;
  const b2 = a1;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = mod(k - c1 * a1 - c2 * a2, n);
  let k2 = mod(-c1 * b1 - c2 * b2, n);
  const k1neg = k1 > POW_2_128;
  const k2neg = k2 > POW_2_128;
  if (k1neg) k1 = n - k1;
  if (k2neg) k2 = n - k2;
  if (k1 > POW_2_128 || k2 > POW_2_128) throw new Error('splitScalarEndo: Endomorphism failed');
  return [k1neg, k1, k2neg, k2];
}

class JacobianPoint {
  multiply(n) {
    let [k1neg, k1, k2neg, k2] = splitScalar(n);
    let k1p = JacobianPoint.ZERO;
    let k2p = JacobianPoint.ZERO;
    let d: JacobianPoint = this;
    while (k1 > 0n || k2 > 0n) {
      if (k1 & 1n) k1p = k1p.add(d);
      if (k2 & 1n) k2p = k2p.add(d);
      d = d.double();
      k1 >>= 1n;
      k2 >>= 1n;
    }
    if (k1neg) k1p = k1p.negate();
    if (k2neg) k2p = k2p.negate();
    k2p = new JacobianPoint(mod(k2p.x * CURVE.beta), k2p.y, k2p.z);
    return k1p.add(k2p);
  }
}
```

The benchmarks look like that now:

```
getPublicKey x 4,017 ops/sec @ 248μs/op
sign x 2,620 ops/sec @ 381μs/op
verify x 558 ops/sec @ 1ms/op
recoverPublicKey x 295 ops/sec @ 3ms/op
```

Endomorphism gives us an improvement of about 25% for `verify` and `recoverPublicKey`. Awesome!

### Future plans
We’ve got `getPublicKey` from non-constant-time 25 ops/sec to algorithmic constant-time 4017 ops/sec without re-implementing big ints, esoteric math (well, besides endomorphism) and low-level languages. At this point it's the fastest secp256k1 lib in pure JavaScript.

[noble-secp256k1](https://github.com/paulmillr/noble-secp256k1) is ready to be used in all kinds of small and big projects.

Some future plans in this direction:

- We’ve already re-impelemented most of the techniques in [noble ed25519](https://github.com/paulmillr/noble-ed25519). This library also includes support for [ristretto255](https://ristretto.group/).
- Getting [noble bls12-381](https://github.com/paulmillr/noble-bls12-381) production-ready & very fast. This particular elliptic curve may be hard to optimize, but we’ll see.
- Finishing tiny, but useful [Python port of noble](https://github.com/paulmillr/noble.py/)

Special thanks to [all contributors](https://github.com/paulmillr/noble-secp256k1#contributing) who gave advice about speed optimizations. Join us on our journey to auditable cryptography via [Twitter](https://twitter.com/paulmillr) & [GitHub](https://github.com/paulmillr).
