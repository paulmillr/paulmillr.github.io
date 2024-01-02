<script lang="ts">
  import { p256 as P256 } from '@noble/curves/p256';
  import { sha256 } from '@noble/hashes/sha256';
  import { sha3_256, keccak_256 } from '@noble/hashes/sha3';
  import { bytesToHex } from '@noble/hashes/utils';
  import { pad } from '../../lib/utils';
  import { err } from '../../data';
  import { currCurveN, message } from '../../stores';
  import SignatureHashList from '../SignatureHashList.svelte';
  import HashRadioBtn from '../HashRadioBtn.svelte';
  import Message from '../Message.svelte';

  export let privKey;

  let x, y, hex33, hex64, r, s, compactSig, derSig, msgHashHex;

  $: isMessage = $message.length > 0;

  $currCurveN = P256.CURVE.n;

  let hash = 'sha256';
  const hashFunctions = {
    sha256,
    sha3_256,
    keccak_256,
  };
  const hashList = Object.keys(hashFunctions);

  $: {
    // public key
    const hex = P256.getPublicKey(privKey);
    const pub = P256.ProjectivePoint.fromHex(hex);
    [x, y] = [pub.x, pub.y].map((n) => pad(n));
    hex33 = pub.toHex(true);
    hex64 = pub.toHex(false);
  }

  // signature
  $: {
    if (isMessage) {
      const hashFunc = hashFunctions[hash];
      const msgHash = hashFunc($message);
      const sig = P256.sign(msgHash, privKey);
      [r, s] = [sig.r, sig.s].map((n) => pad(n));
      compactSig = sig.toCompactHex();
      derSig = sig.toDERHex();
      msgHashHex = bytesToHex(msgHash);
    }
  }

  const handleHashChange = (e) => {
    hash = e.detail;
  }
</script>

<div class="curve-data">
  <h4 class="curve-data__header">Public key</h4>
  <table class="curve-data__table">
    <tbody>
      <tr><td class="curve-data__key">x</td><td><code>{x}</code></td></tr>
      <tr><td class="curve-data__key">y</td><td><code>{y}</code></td></tr>
      <tr><td class="curve-data__key">33b hex</td><td><code>{hex33}</code></td></tr>
      <tr><td class="curve-data__key">64b hex</td><td><code>{hex64}</code></td></tr>
    </tbody>
  </table>

  <h4 class="curve-data__header">Signature</h4>
  <Message />
  <SignatureHashList>
    {#each hashList as h, i}
      <HashRadioBtn on:change={handleHashChange} hash={h} checked={i === 0} />
    {/each}
  </SignatureHashList>
  {#if isMessage}
    <table class="curve-data__table">
      <tbody>
        <tr><td class="curve-data__key">msgHash</td><td><code>{msgHashHex}</code></td></tr>
        <tr><td class="curve-data__key">r</td><td><code>{r}</code></td></tr>
        <tr><td class="curve-data__key">s</td><td><code>{s}</code></td></tr>
        <tr><td class="curve-data__key">compact</td><td><code>{compactSig}</code></td></tr>
        <tr><td class="curve-data__key">der</td><td><code>{derSig}</code></td></tr>
      </tbody>
    </table>
  {:else}
    <p>{err['NO_MESSAGE']}</p>
  {/if}
</div>
