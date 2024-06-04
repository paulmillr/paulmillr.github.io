<script lang="ts">
    import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
    import { bytesToHex, utf8ToBytes, randomBytes } from '@noble/hashes/utils';
    import { err } from '../../data';
    import { currCurveN, message } from '../../stores';
    import Message from '../Message.svelte';

    export let privKey: string;

    let msgHex, auxRand, sigHex;

    $: isMessage = $message.length > 0;

    $currCurveN = secp256k1.CURVE.n;

    $: {
      // signature
      if (isMessage) {
        const msg = utf8ToBytes($message);
        const random = randomBytes();
        const sig = schnorr.sign(msg, privKey, random);
        msgHex = bytesToHex(msg);
        auxRand = bytesToHex(random);
        sigHex = bytesToHex(sig);
      }
    }
</script>

<div class="curve-data">
  <h3 class="curve-data__header">Signature</h3>
  <Message />
  {#if isMessage}
    <table class="curve-data__table">
      <tbody>
        <tr><td class="curve-data__key">msg</td><td><code>{msgHex}</code></td></tr>
        <tr><td class="curve-data__key">auxRand</td><td><code>{auxRand}</code></td></tr>
        <tr><td class="curve-data__key">sigHex</td><td><code>{sigHex}</code></td></tr>
      </tbody>
    </table>
  {:else}
    <p>{err['NO_MESSAGE']}</p>
  {/if}
</div>