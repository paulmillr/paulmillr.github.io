<script>
  import { secp256k1 } from '@noble/curves/secp256k1'
  import { p256 as P256 } from '@noble/curves/p256';
  import { p384 as P384 } from '@noble/curves/p384';
  import { p521 as P521 } from '@noble/curves/p521';
  import { ed25519 } from '@noble/curves/ed25519';
  import { ed448 } from '@noble/curves/ed448';
  import { bls12_381 } from '@noble/curves/bls12-381';
  import { curves, defaultCustomCurveParams } from "./../data";
  import { pad, isPositiveBigInt, isNonHexStr } from './../lib/utils';
  import { onMount } from 'svelte';
  import { getErrMsg, createCustomCurve } from './../lib/utils';
  import PointInput from './PointInput.svelte';
  import CurveRadioBtn from './CurveRadioBtn.svelte';
  import CustomCurveFields from './CustomCurveFields.svelte';
  import { customCurveErrorDemo2 } from './../stores';

  // default Point and Curve
  let Point = secp256k1.ProjectivePoint;
  let Curve = secp256k1;

  const { a, b, p, n, h, Gx, Gy } = defaultCustomCurveParams;

  let a_x = '';
  let a_y = '';
  let b_x = '';
  let b_y = '';
  let c_x = '';
  let c_y = '';
  let a_x_c0 = '';
  let a_x_c1 = '';
  let a_y_c0 = '';
  let a_y_c1 = '';
  let b_x_c0 = '';
  let b_x_c1 = '';
  let b_y_c0 = '';
  let b_y_c1 = '';
  let c_x_c0 = '';
  let c_x_c1 = '';
  let c_y_c0 = '';
  let c_y_c1 = '';

  let scalar = '31415';

  let error = '';
  let errorPointA = '';
  let errorPointB = '';
  let errorScalar = '';

  let is_bls12_381_g2 = false;
  let showScalar = false;
  let showPointB = true;
  let operation = 'add';
  let isScalarHex = false;
  let isShowCustom = false;

  const intErrorMsg = 'number must be positive and non-floating point integer, for hex click checkbox above';
  const hexErrorMsg = 'number must be a hex number, for decimals uncheck checkbox above';

  onMount(() => {
    randomPoint('A');
    randomPoint('B');
  });

  const handleCurveChange = (e) => {
    const curveTitle = e.detail.toLowerCase().split('points_')[1];
    switch (curveTitle) {
      case 'ecdsa_secp256k1':
        Curve = secp256k1;
        Point = secp256k1.ProjectivePoint;
        break;
      case 'ecdsa_p256':
        Curve = P256;
        Point = P256.ProjectivePoint;
        break;
      case 'ecdsa_p384':
        Curve = P384;
        Point = P384.ProjectivePoint;
        break;
      case 'ecdsa_p521':
        Curve = P521;
        Point = P521.ProjectivePoint;
        break;
      case 'eddsa_ed25519':
        Curve = ed25519;
        Point = ed25519.ExtendedPoint;
        break;
      case 'eddsa_ed448':
        Curve = ed448;
        Point = ed448.ExtendedPoint;
        break;
      case 'bls_bls12-381_g1':
        Curve = bls12_381;
        Point = bls12_381.G1.ProjectivePoint;
        break;
      case 'bls_bls12-381_g2':
        Curve = bls12_381;
        Point = bls12_381.G2.ProjectivePoint;
        break;
      case 'custom':
        try {
          Curve = createCustomCurve(a, b, p, n, h, Gx, Gy);
          Point = Curve.ProjectivePoint;
        } catch (e) {
          $customCurveErrorDemo2 = getErrMsg(e);
        }
        break;
      default:
        Curve = secp256k1;
        Point = secp256k1.ProjectivePoint;
        break;
    }
    is_bls12_381_g2 = curveTitle === 'bls_bls12-381_g2';
    isShowCustom = curveTitle === 'custom';
    randomPoint('A');
    randomPoint('B');
    clearResults();
  }

  const showCustomCurveData = (e) => {
    Curve = e.detail;
    Point = Curve.ProjectivePoint;
    randomPoint('A');
    randomPoint('B');
    clearResults();
  }

  const createPoint = (coords) => {
    const point = Point.fromAffine(coords);
    try {
      point.assertValidity();
    } catch (e) {
      if (e.message !== 'bad point: ZERO') {
        throw e;
      }
    }
    return point;
  }

  const getCoordsPointA = () => {
    if (is_bls12_381_g2) {
      return {
        x: {
          c0: BigInt(a_x_c0),
          c1: BigInt(a_x_c1),
        },
        y: {
          c0: BigInt(a_y_c0),
          c1: BigInt(a_y_c1),
        },
      };
    } else {
      return {
        x: BigInt(a_x),
        y: BigInt(a_y)
      };
    }
  }

  const getCoordsPointB = () => {
    if (is_bls12_381_g2) {
      return {
        x: {
          c0: BigInt(b_x_c0),
          c1: BigInt(b_x_c1),
        },
        y: {
          c0: BigInt(b_y_c0),
          c1: BigInt(b_y_c1),
        },
      };
    } else {
      return {
        x: BigInt(b_x),
        y: BigInt(b_y)
      };
    }
  }

  const createPoints = () => {
    let a, b;
    errorPointA = errorPointB = '';

    try {
      const coords = getCoordsPointA();
      a = createPoint(coords);
    } catch (e) {
      errorPointA = getErrMsg(e);
    }

    try {
      const coords = getCoordsPointB();
      b = createPoint(coords);
    } catch (e) {
      errorPointB = getErrMsg(e);
    }

    return [a, b];
  }

  const addPoints = () => {
    const [a, b] = createPoints();
    if (!a || !b) return;
    error = '';
    try {
      const c = a.add(b);
      showResults(c);
    } catch (e) {
      error = getErrMsg(e);
    }
  }

  const subtractPoints = () => {
    const [a, b] = createPoints();
    if (!a || !b) return;

    error = '';
    try {
      const c = a.subtract(b);
      showResults(c);
    } catch (e) {
      error = getErrMsg(e);
    }
  }

  const multiplyPoints = () => {
    if (errorScalar) return;
    error = '';
    try {
      const coords = getCoordsPointA();
      const a = createPoint(coords);
      const s = isScalarHex ? BigInt(`0x${scalar}`) : BigInt(scalar);
      const c = a.multiply(s);
      showResults(c);
    } catch (e) {
      error = getErrMsg(e);
    }
  }

  const handlePointInput = (e) => {
    const { field, value } = e.detail;
    if (field === 'a_x') a_x = value;
    if (field === 'a_y') a_y = value;
    if (field === 'b_x') b_x = value;
    if (field === 'b_y') b_y = value;
    if (field === 'a_x_c0') a_x_c0 = value;
    if (field === 'a_x_c1') a_x_c1 = value;
    if (field === 'a_y_c0') a_y_c0 = value;
    if (field === 'a_y_c1') a_y_c1 = value;
    if (field === 'b_x_c0') b_x_c0 = value;
    if (field === 'b_x_c1') b_x_c1 = value;
    if (field === 'b_y_c0') b_y_c0 = value;
    if (field === 'b_y_c1') b_y_c1 = value;
  }

  const handleScalarInput = (e) => {
    scalar = e.target.value;
    verifyScalarInput();
  }

  const handleScalarHexClick = (e) => {
    isScalarHex = e.target.checked;
    verifyScalarInput();
  }

  const verifyScalarInput = () => {
    if (isScalarHex) {
      if (isNonHexStr(scalar)) {
        errorScalar = hexErrorMsg;
        return;
      }
    } else {
      if (!isPositiveBigInt(scalar)) {
        errorScalar = intErrorMsg;
        return;
      }
    }
    errorScalar = '';
  }

  const setPointToInputs = (point, field) => {
    const p = point.toAffine();
    if (is_bls12_381_g2) {
      const [x_c0, x_c1, y_c0, y_c1] = [p.x.c0, p.x.c1, p.y.c0, p.y.c1].map((n) => pad(n));
      if ( field === 'A' ) {
        [a_x_c0, a_x_c1, a_y_c0, a_y_c1] = [x_c0, x_c1, y_c0, y_c1];
      } else {
        [b_x_c0, b_x_c1, b_y_c0, b_y_c1] = [x_c0, x_c1, y_c0, y_c1];
      }
    } else {
      const [x, y] = [p.x, p.y].map((n) => pad(n));
      if (field === 'A') {
        [a_x, a_y] = [x, y];
      } else if (field === 'B') {
        [b_x, b_y] = [x, y];
      }
    }
  }

  const showResults = (point) => {
    const p = point.toAffine();
    if (is_bls12_381_g2) {
      [c_x_c0, c_x_c1, c_y_c0, c_y_c1] = [p.x.c0, p.x.c1, p.y.c0, p.y.c1].map((n) => pad(n));
    } else {
      [c_x, c_y] = [p.x, p.y].map((n) => pad(n));
    }
  }

  const basePoint = (field) => {
    setPointToInputs(Point.BASE, field);
  }

  const zeroPoint = (field) => {
    setPointToInputs(Point.ZERO, field);
  }

  const randomPoint = (field) => {
    const priv = Curve.utils.randomPrivateKey();
    const randomPoint = Point.fromPrivateKey(priv);
    setPointToInputs(randomPoint, field);
  }

  const clearResults = () => {
    c_x = c_y = c_x_c0 = c_x_c1 = c_y_c0 = c_y_c1 = '';
  }

  const handleChooseOperation = (e) => {
    operation = e.target.value;
    showScalar = operation === 'multiply';
    showPointB = !showScalar;
    errorPointA = errorPointB = errorScalar = '';
  }

  const calculateResults = () => {
    if (operation === 'add') {
      addPoints();
    } else if (operation === 'subtract') {
      subtractPoints();
    } else if (operation === 'multiply') {
      multiplyPoints();
    }
  }
</script>

<div class="curves-list-container">
  {#each curves as c}
    {#if c.type !== 'Schnorr'}
      <div class="curves-list">
        <div class="curves-list__title">{c.type}</div>

        <div>
          {#each c.list as title, i}
            {#if title == 'bls12-381'}
              {#each c.options as o}
                <CurveRadioBtn
                  on:change={handleCurveChange}
                  name="points_curve"
                  value="points_{`${c.type}_${title}_${o}`}"
                  title={`${title} - ${o}`}
                />
              {/each}
            {:else}
              <div class="ecc-radio">
                <CurveRadioBtn
                  on:change={handleCurveChange}
                  name="points_curve"
                  value="points_{`${c.type}_${title}`}"
                  checked={c.type == 'ECDSA' && i == 0}
                  title={title}
                />
              </div>
            {/if}
          {/each}
        </div>

        {#if c.type === 'ECDSA'}
          <CurveRadioBtn
            on:change={handleCurveChange}
            name="points_curve"
            value="points_custom"
            title='create curve'
          />
        {/if}
      </div>
    {/if}
  {/each}
</div>

{#if isShowCustom}
  <CustomCurveFields demo={2} on:showData={showCustomCurveData} />
{/if}

<div class="fields-block">
  <div class="point-header">
    <strong>Point A</strong>
    <small>(x, y)</small>
    <span class="point-header__btns">
      <button on:click={() => basePoint('A')} class="point-header__btn button">
        Base
      </button>
      <button on:click={() => zeroPoint('A')} class="point-header__btn button">
        Zero
      </button>
      <button on:click={() => randomPoint('A')} class="point-header__btn button">
        Random
      </button>
    </span>
  </div>
  {#if is_bls12_381_g2 }
    <div><strong>x</strong></div>
    <PointInput on:input={handlePointInput} label="c0" field="a_x_c0" value={a_x_c0} />
    <PointInput on:input={handlePointInput} label="c1" field="a_x_c1" value={a_x_c1} />
    <div><strong>y</strong></div>
    <PointInput on:input={handlePointInput} label="c0" field="a_y_c0" value={a_y_c0} />
    <PointInput on:input={handlePointInput} label="c1" field="a_y_c1" value={a_y_c1} />
  {:else}
    <PointInput on:input={handlePointInput} label="x" field="a_x" value={a_x} />
    <PointInput on:input={handlePointInput} label="y" field="a_y" value={a_y} />
  {/if}
  <div class="error">{errorPointA}</div>
</div>

<div class="operations">
  <span class="operation">
    <input type="radio" name="operation" value="add" id="add" checked on:change={handleChooseOperation}>
    <label for="add">Add</label>
  </span>
  <span class="operation">
    <input type="radio" name="operation" value="subtract" id="subtract" on:change={handleChooseOperation}>
    <label for="subtract">Subtract</label>
  </span>
  <span class="operation">
    <input type="radio" name="operation" value="multiply" id="multiply" on:change={handleChooseOperation}>
    <label for="multiply">Multiply</label>
  </span>
</div>

{#if showPointB}
  <div class="fields-block">
    <div class="point-header">
      <strong>Point B</strong>
      <small>(x, y)</small>
      <span class="point-header__btns">
        <button on:click={() => basePoint('B')} class="point-header__btn button">
          Base
        </button>
        <button on:click={() => zeroPoint('B')} class="point-header__btn button">
          Zero
        </button>
        <button on:click={() => randomPoint('B')} class="point-header__btn button">
          Random
        </button>
      </span>
    </div>
    {#if is_bls12_381_g2 }
      <div><strong>x</strong></div>
      <PointInput on:input={handlePointInput} label="c0" field="b_x_c0" value={b_x_c0} />
      <PointInput on:input={handlePointInput} label="c1" field="b_x_c1" value={b_x_c1} />
      <div><strong>y</strong></div>
      <PointInput on:input={handlePointInput} label="c0" field="b_y_c0" value={b_y_c0} />
      <PointInput on:input={handlePointInput} label="c1" field="b_y_c1" value={b_y_c1} />
    {:else}
      <PointInput on:input={handlePointInput} label="x" field="b_x" value={b_x} />
      <PointInput on:input={handlePointInput} label="y" field="b_y" value={b_y} />
    {/if}
    <div class="error">{errorPointB}</div>
  </div>
{/if}

{#if showScalar}
  <div class="fields-block">
    <div class="point-header">
      <strong>Scalar</strong>
      <small>(number used for multiply operation)</small>
    </div>
    <div class="point-input">
      <input
        class='text-input'
        id="scalar"
        type="text"
        value={scalar}
        on:input={handleScalarInput}
      />
    </div>
    <div>
      <input
        id="scalar-hex"
        class="scalar-checkbox"
        type="checkbox"
        on:click={handleScalarHexClick}
      >
      <label for="scalar-hex">Is hex</label>
    </div>
    <div class="error">{errorScalar}</div>
  </div>
{/if}

<div class="operations">
  <button class="button" on:click={calculateResults}>Calculate</button>
</div>

<div class="error">{error}</div>

<div class="point-header">
  <strong>Result C</strong>
  <small>(x, y)</small>
</div>
{#if is_bls12_381_g2 }
  <table class="result">
    <tr><td colspan="2"><strong>x</strong></td></tr>
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>c0:</strong></td>
      <td class="result__col"><code>{c_x_c0}</code></td>
    </tr>
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>c1:</strong></td>
      <td class="result__col"><code>{c_x_c1}</code></td>
    </tr>
    <tr><td colspan="2"><strong>y</strong></td></tr>
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>c0:</strong></td>
      <td class="result__col"><code>{c_y_c0}</code></td>
    </tr>
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>c1:</strong></td>
      <td class="result__col"><code>{c_y_c1}</code></td>
    </tr>
  </table>
{:else}
  <table class="result">
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>x:</strong></td>
      <td class="result__col"><code>{c_x}</code></td>
    </tr>
    <tr class="result__row">
      <td class="result__col result__col_title"><strong>y:</strong></td>
      <td class="result__col"><code>{c_y}</code></td>
    </tr>
  </table>
{/if}

<style>
  .fields-block {
    margin-bottom: 20px;
  }

  .curves-list-container {
    margin-bottom: 10px;
  }

  .header {
    margin-top: 40px;
  }

  .subheader {
    margin-bottom: 20px;
  }

  .point-header {
    margin-bottom: 10px;
  }

  .point-input {
    display: flex;
    margin-bottom: 10px;
  }

  .operations {
    margin-top: 20px;
    margin-bottom: 17px;
  }

  .operation {
    display: block;
    margin-bottom: 5px;
  }

  @media (min-width: 480px) {
    .operation {
      margin-bottom: 0;
      margin-right: 10px;
      display: inline;
    }
  }

  .point-header__btns {
    display: block;
  }

  @media (min-width: 480px) {
    .point-header__btns {
      display: inline;
      margin-left: 10px;
    }
  }

  .point-header__btn {
    margin-right: 5px;
  }

  .scalar-checkbox {
    margin-left: 0;
  }

  .error {
    color: red;
    font-weight: bold;
    font-size: 16px;
    margin-top: 3px;
    margin-bottom: 10px;
  }

  .result__col {
    padding-bottom: 5px;
  }

  .result__col_title {
    padding-right: 10px;
  }

  code {
    line-break: anywhere;
  }
</style>