<script lang="ts">
  import Secp256k1 from "./components/curves/Secp256k1.svelte";
  import P256 from "./components/curves/P256.svelte";
  import P384 from "./components/curves/P384.svelte";
  import P521 from "./components/curves/P521.svelte";
  import SchnorrSecp256k1 from "./components/curves/SchnorrSecp256k1.svelte";
  import Ed25519 from "./components/curves/Ed25519.svelte";
  import Ed448 from "./components/curves/Ed448.svelte";
  import Bls12_381 from "./components/curves/Bls12-381.svelte";
  import CustomCurve from "./components/curves/CustomCurve.svelte";
  import PrivKey from "./components/PrivKey.svelte";
  import CustomCurveFields from './components/CustomCurveFields.svelte';
  import { p256 as defaultCustomCurve } from '@noble/curves/p256';
  import Points from "./components/Points.svelte";

  import { privKey, message } from './stores';
  import { KEY_32, KEY_48, KEY_57, KEY_65, curves } from "./data";

  // default values for inputs
  $privKey = KEY_32;
  $message = 'greetings from noble';

  let isShowCustom = false;
  let customCurve = defaultCustomCurve; // default curve for custom calc

  let keyLength = KEY_32.length;
  let curve = 'ecdsa_secp256k1';

  let demosShown = false;

  const handleCurveChange = (e: { target: { id: string; }; }) => {
    curve = e.target.id.toLowerCase();
    let key = '';
    if (curve === 'ecdsa_p384') {
      $privKey = KEY_48;
    } else if (curve === 'ecdsa_p521') {
      $privKey = KEY_65;
    } else if (curve === 'eddsa_ed448') {
      $privKey = KEY_57;
    } else {
      $privKey = KEY_32;
    }
    keyLength = $privKey.length;
    isShowCustom = curve === 'custom';
  }

  const showCustomCurveData = (event) => {
    customCurve = event.detail;
    curve = 'custom';
    $privKey = KEY_32;
    keyLength = $privKey.length;
  }

  function toggleDemos() {
    demosShown = !demosShown;
  }
</script>

<!-- input -->
<button on:click={toggleDemos}>{#if demosShown}Hide apps{:else}Show apps{/if}</button>

<div class="noble-demo" hidden={!demosShown}>
<hr>
<h3 id="demo-name">App I: Elliptic curve calculator</h3>
<p>Calculate public keys and signatures with noble.</p>

<PrivKey {curve} {keyLength} />

<div class="curves-list-container">
  {#each curves as c}
    <div class="curves-list">
      <div class="curves-list__title">{c.type}</div>
      <div>
        {#each c.list as title, i}
          <div class="ecc-radio">
            <input
              on:change={handleCurveChange}
              type="radio"
              name="curve"
              value="{title}"
              id="{`${c.type}_${title}`}"
              checked={c.type == 'ECDSA' && i == 0}
            />
            <label for="{`${c.type}_${title}`}">{title}</label>
          </div>
        {/each}
        {#if c.type === 'ECDSA' }
          <div class="ecc-radio">
            <input
              on:change={handleCurveChange}
              type="radio"
              name="curve"
              value="custom"
              id="custom"
            >
            <label for="custom">create curve</label>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if isShowCustom}
  <CustomCurveFields demo={1} on:showData={showCustomCurveData} />
{/if}

{#if curve == 'ecdsa_secp256k1'}
  <Secp256k1 privKey={$privKey} />
{:else if curve == 'ecdsa_p256'}
  <P256 privKey={$privKey} />
{:else if curve == 'ecdsa_p384'}
  <P384 privKey={$privKey} />
{:else if curve == 'ecdsa_p521'}
  <P521 privKey={$privKey} />
{:else if curve == 'schnorr_secp256k1'}
  <SchnorrSecp256k1 privKey={$privKey} />
{:else if curve == 'eddsa_ed25519'}
  <Ed25519 privKey={$privKey} />
{:else if curve == 'eddsa_ed448'}
  <Ed448 privKey={$privKey} />
{:else if curve == 'bls_bls12-381'}
  <Bls12_381 privKey={$privKey} />
{:else if curve == 'custom'}
  <CustomCurve CURVE={customCurve} privKey={$privKey} />
{/if}

</div>

<div class="noble-demo" hidden={!demosShown}>
  <h3 class="header">App II: Elliptic curve point operations</h3>
  <p class="subheader">Add, subtract, multiply points on the chosen elliptic curve.</p>
  <Points />
</div>
