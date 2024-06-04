<script lang="ts">
    import { ed448 } from '@noble/curves/ed448';
    import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
    import { pad } from '../../lib/utils';
    import { err } from '../../data';
    import { currCurveN, message } from '../../stores';
    import Message from '../Message.svelte';

    export let privKey;

    let x, y, pubHex, msgHex, sigHex;

    $: isMessage = $message.length > 0;

    $currCurveN = ed448.CURVE.n;

    $: {
      // public key
      const hex = ed448.getPublicKey(privKey);
      const pub = ed448.ExtendedPoint.fromHex(hex);
      [x, y] = [pub.x, pub.y].map((n) => pad(n));
      pubHex = pub.toHex();

      // signature
      if (isMessage) {
        const msg = utf8ToBytes($message);
        const sig = ed448.sign(msg, privKey);
        msgHex = bytesToHex(msg);
        sigHex = bytesToHex(sig);
      }
    }
</script>

<div class="curve-data">
  <h4 class="curve-data__header">Public key</h4>
  <table class="curve-data__table">
    <tbody>
      <tr><td class="curve-data__key">x</td><td><code>{x}</code></td></tr>
      <tr><td class="curve-data__key">y</td><td><code>{y}</code></td></tr>
      <tr><td class="curve-data__key">hex</td><td><code>{pubHex}</code></td></tr>
    </tbody>
  </table>

  <h4 class="curve-data__header">Signature</h4>
  <Message />
  {#if isMessage}
    <table class="curve-data__table">
      <tbody>
        <tr><td class="curve-data__key">msg</td><td><code>{msgHex}</code></td></tr>
        <tr><td class="curve-data__key">sigHex</td><td><code>{sigHex}</code></td></tr>
      </tbody>
    </table>
  {:else}
    <p>{err['NO_MESSAGE']}</p>
  {/if}
</div>