<script>
  import { createEventDispatcher } from 'svelte';
  import { mod } from '@noble/curves/abstract/modular';
  import { err, defaultCustomCurveParams } from '../data';
  import { customCurveErrorDemo1, customCurveErrorDemo2 } from '../stores';
  import { getErrMsg, isPositiveBigInt, isBigInt, createCustomCurve } from '../lib/utils';

  export let demo;

  const dispatch = createEventDispatcher();

  let error = '';
  $: if (demo == 1) {
    error = $customCurveErrorDemo1;
  }
  $: if (demo == 2) {
    error = $customCurveErrorDemo2;
  }

  // default values taken from P256
  let { a, b, p, n, h } = defaultCustomCurveParams;
  const { Gx, Gy } = defaultCustomCurveParams;

  let aErr = '';
  let bErr = '';
  let pErr = '';
  let nErr = '';
  let hErr = '';

  $: {
    aErr = bErr = pErr = nErr = hErr = '';
    if (!isBigInt(a)) aErr = `a ${err['INT']}`;
    if (!isBigInt(b)) bErr = `b ${err['INT']}`;
    if (!isPositiveBigInt(p)) pErr = `P ${err['POSITIVE_INT']}`;
    if (!isPositiveBigInt(n)) nErr = `n ${err['POSITIVE_INT']}`;
    if (!isPositiveBigInt(h)) hErr = `h ${err['POSITIVE_INT']}`;
  }

  $: isErr = aErr.length || bErr.length || pErr.length || nErr.length || hErr.length;

  const handleCreateCustomCurve = () => {
    if (isErr) return;

    a = BigInt(a);
    b = BigInt(b);
    p = BigInt(p);
    n = BigInt(n);
    h = BigInt(h);

    // check the matching of params to y² ≡ x³ + ax + b (mod p)
    if (mod(Gy ** 2n, p) !== mod(Gx ** 3n + a * Gx + b, p)) {
      error = 'Values of a, b, p, Gx, and Gy do not match the equation y² ≡ x³ + ax + b (mod p)'
      return;
    }

    let curve;
    try {
      curve = createCustomCurve(a, b, p, n, h, Gx, Gy);
    } catch (e) {
      error = getErrMsg(e);
      return;
    }

    error = '';
    dispatch('showData', curve);
  }
</script>

<h3 class="header">Define custom weierstrass curve</h3>

<div class="curve-desc">
  <div class="subheader">Curve's formula is <b>y² = x³ + ax + b</b></div>
  <div>
    Generator point (<b>G</b>) used for curve calculator:
    <ul class="curve-desc__coords">
      <li><b>Gx</b>: <code>0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296</code></li>
      <li><b>Gy</b>: <code>0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5</code></li>
    </ul>
    <b>a</b> and <b>b</b> params must be non-floating point integers. <b>P</b>, <b>n</b> and <b>h</b> must be positive and non-floating point integers.
  </div>
</div>

<div class="curve">
  <div class="curve__field">
    <label for="a" class="priv-key__label">
      <strong>a</strong> - constant "a"
    </label>
    <input class="text-input" bind:value={a} id="a" type="text" name="a" placeholder="a">
    {#if aErr}
      <div class="error">{aErr}</div>
    {/if}
  </div>
  <div class="curve__field">
    <label for="b" class="priv-key__label">
      <strong>b</strong> - constant "b"
    </label>
    <input class="text-input" bind:value={b} id="b" type="text" name="b" placeholder="b">
    {#if bErr}
      <div class="error">{bErr}</div>
    {/if}
  </div>
  <div class="curve__field">
    <label for="P" class="priv-key__label">
      <strong>P</strong> - modulus at <b>y² ≡ x³ + ax + b (mod p)</b>
    </label>
    <input class="text-input" bind:value={p} id="P" type="text" name="P" placeholder="P">
    {#if pErr}
      <div class="error">{pErr}</div>
    {/if}
  </div>
  <div class="curve__field">
    <label for="n" class="priv-key__label">
      <strong>n</strong> - curve order, the count of all possible EC points
    </label>
    <input class="text-input" bind:value={n} id="n" type="text" name="n" placeholder="n">
    {#if nErr}
      <div class="error">{nErr}</div>
    {/if}
  </div>
  <div class="curve__field">
    <label for="h" class="priv-key__label">
      <strong>h</strong> - cofactor, the number of subgroups
    </label>
    <input class="text-input" bind:value={h} id="h" type="text" name="h" placeholder="h">
    {#if hErr}
      <div class="error">{hErr}</div>
    {/if}
  </div>

  <div class="error">
    {error}
  </div>
  
  <button class="button" on:click={handleCreateCustomCurve}>
    Create curve
  </button>
  {#if demo == 2}
    <small class="create-note">(random coordinates for points will be generated)</small>
  {/if}
</div>

<style>
  .header {
    margin-top: 0;
    margin-bottom: 0;
    font-size: 1.17em;
  }

  .text-input { 
    width: 100%;
  }

  button {
    margin-top: 10px;
  }

  .subheader {
    margin-top: 5px;
    margin-bottom: 15px;
  }

  .curve {
    margin-bottom: 30px;
  }

  .curve__field {
    margin-bottom: 12px;
  }

  .error {
    color: red;
    font-weight: bold;
    font-size: 16px;
    margin-top: 3px;
    margin-bottom: 3px;
  }

  .curve-desc {
    margin-bottom: 15px;
  }

  .curve-desc__coords code {
    line-break: anywhere;
  }

  .curve-desc__coords :first-child {
    margin-bottom: 5px;
  }

  .create-note {
    display: block;
    margin-top: 5px;
  }

  @media (min-width: 480px) {
    .create-note {
      display: inline;
      margin: 0;
    }
  }
</style>