<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { nip19, generateSecretKey } from 'nostr-tools'
  import ShowImagesCheckbox from './ShowImagesCheckbox.vue'
  import { DEFAULT_RELAYS } from './../app'
  import { useRelay } from '@/stores/Relay'
  import { useImages } from '@/stores/Images'
  import { useNsec } from '@/stores/Nsec'

  const props = defineProps<{
    wsError: string
  }>()

  const emit = defineEmits(['relayConnect', 'relayDisconnect'])

  const relayStore = useRelay()
  const imagesStore = useImages()
  const nsecStore = useNsec()
  
  const showCustomRelayUrl = ref(false)
  const showConnectBtn = computed(() => {
    return relayStore.selectedRelay !== relayStore.connectedRelayUrl
  })

  relayStore.setSelectedRelay(DEFAULT_RELAYS[0])

  const handleRelaySelect = (event: any) => {
    const value = event.target.value
    showCustomRelayUrl.value = value === 'custom'
    relayStore.setSelectedRelay(value)
  }

  const handleNsecInput = (event: any) => {
    if (nsecStore.rememberMe) {
      localStorage.setItem('privkey', nsecStore.nsec as string)
    }
    
    // do not reconnect if the same key was presented
    if (nsecStore.cachedNsec === nsecStore.nsec) {
      return
    }
    
    // reconnect to relay if nsec was updated
    if (relayStore.isConnectedToRelay) {
      const pubkey = nsecStore.getPubkey()
      if (pubkey.length) {
        emit('relayConnect')
      }
    }
  }

  const handleGenerateRandomPrivKey = () => {
    const privKeyHex = generateSecretKey()
    nsecStore.updateNsec(nip19.nsecEncode(privKeyHex))
  }

  const handleRememberMe = () => {
    if (nsecStore.rememberMe) {
      localStorage.setItem('rememberMe', 'true')
      localStorage.setItem('privkey', nsecStore.nsec as string)
    } else {
      localStorage.clear()
    }
  }

  const toggleImages = () => {
    imagesStore.updateShowImages(!imagesStore.showImages)
  }

  const handleRelayConnect = () => {
    emit('relayConnect')
  }

  const handleRelayDisconnect = () => {
    emit('relayDisconnect')
  }
</script>

<template>
  <p class="relay-fields">
    <div class="relay-fields__wrapper">
      <div class="relay-fields__relay">
        <div class="relay-fields__select-field">
          <label class="field-label_priv-key" for="relays">
            <strong>Select relay</strong>
          </label>
          <div class="field-elements">
            <select class="select-relay__select" @change="handleRelaySelect" name="relays" id="relays">
              <option v-for="url in DEFAULT_RELAYS" :value="url">
                {{ url }}
              </option>
              <option value="custom">custom url</option>
            </select>
            <button v-if="showConnectBtn" @click="handleRelayConnect" class="select-relay__btn">
              {{ relayStore.isConnectingToRelay ? 'Connecting...' : 'Connect' }}
            </button>
            <button v-else @click="handleRelayDisconnect" class="select-relay__btn">
              Disconnect
            </button>
          </div>
        </div>
        <div class="show-images">
          <ShowImagesCheckbox 
            :showImages="imagesStore.showImages" 
            @toggleImages="toggleImages" 
          />
        </div>
      </div>
      <div class="message-fields__field">
        <label for="priv_key">
          <strong>Private key (optional)</strong>
        </label>
        <div class="field-elements">
          <input @input="handleNsecInput" v-model="nsecStore.nsec" class="priv-key-input" id="priv_key" type="password" placeholder="nsec..." />
          <button @click="handleGenerateRandomPrivKey" class="random-key-btn">Random</button>
        </div>
        <div class="remember-me">
          <input @change="handleRememberMe" class="remember-me__input" type="checkbox" id="remember-me" v-model="nsecStore.rememberMe" />
          <label class="remember-me__label" for="remember-me"> Remember me</label>
        </div>
      </div>
    </div>
    <div class="error">
      {{ props.wsError }}
    </div>
  </p>

  <div v-if="showCustomRelayUrl" class="field">
    <label for="relay_url">
      <strong>Relay URL</strong>
    </label>
    <div class="field-elements">
      <input 
        v-model="relayStore.customRelayUrl" 
        class="relay-input" 
        id="relay_url" 
        type="text" 
        placeholder="[wss://]relay.example.com" 
      />
    </div>
  </div>
</template>

<style scoped>
  .relay-fields {
    margin-bottom: 20px;
  }

  .relay-fields__wrapper {
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
  }

  @media (min-width: 768px) {
    .relay-fields__wrapper {
      flex-direction: row;
    }
  }

  @media (min-width: 768px) {
    .relay-fields__select-field {
      padding-right: 15px;
      border-right: 1px solid #bbb;
      margin-right: 15px;
    }
  }

  .field-label_priv-key {
    display: flex;
    align-items: center;
  }

  .random-key-btn {
    font-size: 14px;
    cursor: pointer;
  }

  .error {
    color: red;
    font-size: 16px;
    margin-top: 5px;
  }

  .select-relay__select {
    margin-top: 5px;
    font-size: 17px;
    margin-bottom: 5px;
  }

  @media (min-width: 768px) {
    .select-relay__select {
      margin-top: 0;
      margin-bottom: 0;
      margin-right: 5px;
      font-size: 16px;
    }
  }

  .select-relay__btn {
    font-size: 14px;
    cursor: pointer;
  }

  .show-images {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  @media (min-width: 768px) {
    .show-images {
      margin-bottom: 0px;
    }
  }

  .remember-me {
    margin-top: 10px;
  }

  .remember-me__input,
  .remember-me__label {
    cursor: pointer;
  }

  .message-fields__field {
    flex-grow: 1;
  }

  .message-fields__field:first-child {
    margin-right: 5px;
    margin-bottom: 10px
  }

  @media (min-width: 768px) {
    .message-fields__field:first-child {
      margin-bottom: 0;
    }
  }

  .field {
    margin-bottom: 15px;
  }

  .field-elements {
    margin-top: 5px;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .field-elements {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  .relay-input {
    font-size: 16px;
    padding: 1px 3px;
    flex-grow: 1;
  }

  .priv-key-input {
    font-size: 16px;
    padding: 1px 3px;
    flex-grow: 1;
    margin-bottom: 5px;
  }

  @media (min-width: 768px) {
    .relay-input,
    .priv-key-input{
      font-size: 15px;
      margin-right: 5px;
      margin-bottom: 0;
    }
  }
</style>