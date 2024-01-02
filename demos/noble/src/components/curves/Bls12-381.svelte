<script lang="ts">
    import { bls12_381 } from '@noble/curves/bls12-381';
    import { sha256 } from '@noble/hashes/sha256';
    import { bytesToHex } from '@noble/hashes/utils';
    import { pad } from '../../lib/utils';
    import { err } from '../../data';
    import { currCurveN, message } from '../../stores';
    import Message from '../Message.svelte';

    export let privKey;

    let x, y, hex, msgHex, sigX, sigXi, sigY, sigYi, sigHex;

    $: isMessage = $message.length > 0;

    $currCurveN = bls12_381.CURVE.r;

    $: {
      // public key
      const pubHex = bls12_381.getPublicKey(privKey);
      const pub = bls12_381.G1.ProjectivePoint.fromHex(pubHex);
      [x, y] = [pub.x, pub.y].map((n) => pad(n));
      hex = bytesToHex(pubHex);

      // signature
      if (isMessage) {
        const msgHash = sha256($message);
        const signatureHex = bls12_381.sign(msgHash, privKey);
        const sig = bls12_381.G2.ProjectivePoint.fromHex(signatureHex);
        [sigX, sigXi, sigY, sigYi] = [sig.x.c0, sig.x.c1, sig.y.c0, sig.y.c1].map((n) => {
          return pad(n);
        });
        msgHex = bytesToHex(msgHash);
        sigHex = bytesToHex(signatureHex);
      }
    }
</script>

<div class="curve-data">
  <h4 class="curve-data__header">Public key G1</h4>
  <table class="curve-data__table">
    <tbody>
      <tr><td class="curve-data__key">x</td><td><code>{x}</code></td></tr>
      <tr><td class="curve-data__key">y</td><td><code>{y}</code></td></tr>
      <tr><td class="curve-data__key">hex</td><td><code>{hex}</code></td></tr>
    </tbody>
  </table>
  <h4 class="curve-data__header">Signature G2</h4>
  <div>
    <small>bls consists of two curves: G1 (ordinary) and G2 (complex numbers). Most implementations use G1 for pubkeys and G2 for signatures. So, signatures will coordinates in form of <code>(x₀, x₁×i), (y₀, y₁×i)</code></small>
  </div>
  <Message />
  {#if isMessage}
    <table class="curve-data__table">
      <tbody>
        <tr><td class="curve-data__key">msgHash</td><td><code>{msgHex}</code></td></tr>
        <tr><td class="curve-data__key">x</td><td><code>{sigX}</code> +<br/><code>{sigXi}×i</code></td></tr>
        <tr><td class="curve-data__key">y</td><td><code>{sigY}</code> +<br/><code>{sigYi}×i</code></td></tr>
        <tr><td class="curve-data__key">sigHex</td><td><code>{sigHex}</code></td></tr>
      </tbody>
    </table>
  {:else}
    <p>{err['NO_MESSAGE']}</p>
  {/if}
</div>