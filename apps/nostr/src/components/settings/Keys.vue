<script setup lang="ts">
  import { ref } from 'vue'
  import { nip19 } from 'nostr-tools'
  import { useNsec } from '@/stores/Nsec'

  const nsecStore = useNsec()

  const showCopyPubCheck = ref(false)
  const showCopyPubHexCheck = ref(false)
  const showCopyPrivCheck = ref(false)
  const showCopyPrivHexCheck = ref(false)

  const handleCopyPubkeyNpub = () => {
    if (!nsecStore.isValidNsecPresented()) return
    const pubkey = nsecStore.getPubkey()
    navigator.clipboard.writeText(nip19.npubEncode(pubkey))
    showCopyPubCheck.value = true
    setTimeout(() => {
      showCopyPubCheck.value = false
    }, 2000)
  }

  const handleCopyPubkeyHex = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPubkey())
    showCopyPubHexCheck.value = true
    setTimeout(() => {
      showCopyPubHexCheck.value = false
    }, 2000)
  }

  const handleCopyPrivkeyNsec = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPrivkey())
    showCopyPrivCheck.value = true
    setTimeout(() => {
      showCopyPrivCheck.value = false
    }, 2000)
  }

  const handleCopyPrivkeyHex = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPrivkeyHex())
    showCopyPrivHexCheck.value = true
    setTimeout(() => {
      showCopyPrivHexCheck.value = false
    }, 2000)
  }
</script>

<template>
  <h4>Your Keys:</h4>
  <div class="keys">
    <div class="key-block">
      <div>Public key:</div>
      <div class="key-block__desc">
        <small>
          Public key identifies your Nostr account. Feel free to share it with others.
        </small>
      </div>
      <div>
        🔑&nbsp;
        <code v-if="nsecStore.isValidNsecPresented()" class="key-block__code">
          {{ nip19.npubEncode(nsecStore.getPubkey()) }}
        </code>
        <span v-else>Please login to see your public key.</span>
      </div>
      <div class="key-block__btns">
        <button class="copy-btn" @click="handleCopyPubkeyNpub">
          <i v-if="!showCopyPubCheck" class="bi bi-clipboard copy-icon"></i>
          <i v-else class="bi bi-check-lg copy-icon"></i>
          Copy pubkey
        </button>
        <button class="copy-btn" @click="handleCopyPubkeyHex">
          <i v-if="!showCopyPubHexCheck" class="bi bi-clipboard copy-icon"></i>
          <i v-else class="bi bi-check-lg copy-icon"></i>
          Copy hex
        </button>
      </div>
    </div>

    <div class="key-block">
      <div>Private key:</div>
      <div class="key-block__desc">
        <small>
          Private key fully controls your Nostr account and used to cryptographically sign your
          messages.
          <b>Do not share your private key with anyone and keep it secure.</b>
        </small>
      </div>
      <div>
        🔐&nbsp;
        <code v-if="nsecStore.isValidNsecPresented()" class="key-block__code">
          ***************************************************************
        </code>
        <span v-else>Please login to get your private key.</span>
      </div>
      <div class="key-block__btns">
        <button class="copy-btn" @click="handleCopyPrivkeyNsec">
          <i v-if="!showCopyPrivCheck" class="bi bi-clipboard copy-icon"></i>
          <i v-else class="bi bi-check-lg copy-icon"></i>
          Copy privkey
        </button>
        <button class="copy-btn" @click="handleCopyPrivkeyHex">
          <i v-if="!showCopyPrivHexCheck" class="bi bi-clipboard copy-icon"></i>
          <i v-else class="bi bi-check-lg copy-icon"></i>
          Copy hex
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  h4 {
    margin-bottom: 10px;
  }

  .key-block {
    margin-bottom: 25px;
  }

  .key-block__code {
    font-size: 15px;
    word-wrap: break-word;
  }

  .key-block__desc {
    margin-bottom: 5px;
  }

  .key-block__btns {
    margin-top: 7px;
  }

  .copy-btn {
    background: #2a2f3b;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 15px;
    margin-right: 5px;
  }

  .copy-btn:hover {
    background: #323741;
  }

  .copy-btn:active {
    opacity: 0.9;
  }

  .copy-icon {
    margin-right: 2px;
  }
</style>
