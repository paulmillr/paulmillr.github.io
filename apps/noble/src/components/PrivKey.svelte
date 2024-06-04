<script>
  import { bytesToHex } from '@noble/hashes/utils';
  import { privKey } from './../stores';
  import { currCurveN } from '../stores';

  export let keyLength;
  export let curve;
  let currCurve = curve;

  let error = '';

  $: {
    if (currCurve !== curve) {
      currCurve = curve;
      error = '';
    }
  }

  function containsNonHex(str) {
    return /[^0-9A-Fa-f]/g.test(str);
  }

  function handleGenerateRandom() {
    const array = window.crypto.getRandomValues(new Uint8Array(keyLength / 2));
    $privKey = bytesToHex(array);
    error = '';
	}

  function handleInput(e) {
    const value = e.target.value;
    const curveFullTitle = curve.split('_').join(' ');

    if (value.length !== keyLength || containsNonHex(value)) {
      error = `Key must be ${keyLength / 2} bytes (${keyLength} hex digits) for ${curveFullTitle}`;
    } else if (BigInt(`0x${value}`) >= $currCurveN) {
      error = "Key is out of curve's order (n)";
    } else {
      $privKey = value;
      error = '';
    }
  }
</script>

<div class="priv-key">
  <div class="priv-key__header">
    <label for="priv-key-input" class="priv-key__label">
      <strong>Private key in hex format</strong>
    </label>
    <button 
      type="button" 
      class="priv-key__btn button" 
      on:click={handleGenerateRandom}
    >
      Generate Random
    </button>
  </div>
  <div>
    <input
      class='text-input'
      id="priv-key-input"
      type="text"
      maxlength={keyLength}
      on:input={handleInput}
      value={$privKey}
    />
  </div>
  <div class="error">
    {error}
  </div>
</div>

<style>
  .priv-key {
    margin-bottom: 15px;
  }

  .priv-key__header {
    display: flex; 
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 6px; 
    margin-top: -5px;
  }

  @media (min-width: 425px) {
    .priv-key__header {
      align-items: center;
      flex-direction: row;
    }
  }

  .priv-key__label {
    margin-right: 10px;
  }

  .priv-key__btn {
    margin-top: 3px;
  }

  @media (min-width: 425px) {
    .priv-key__btn {
      margin-top: 0;
    }
  }

  .error {
    color: red;
    font-weight: bold;
    font-size: 16px;
    margin-top: 3px;
  }
</style>