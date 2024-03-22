<script setup lang="ts">
  import { ref, defineEmits } from 'vue'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { useNsec } from '@/stores/Nsec'
  import { usePubKey } from '@/stores/PubKey'
  
  defineProps<{
    isSendingMessage: boolean
    broadcastError: ''
  }>()
  
  const emit = defineEmits(['broadcastEvent'])
  const relayStore = useRelay()
  const feedStore = useFeed()
  const nsecStore = useNsec()
  const pubKeyStore = usePubKey()
  const jsonErr = ref('')

  const handleSendSignedEvent = () => {
    if (!feedStore.signedJson.length) {
      jsonErr.value = 'Provide signed event.'
      return;
    }

    let event;
    try {
      event = JSON.parse(feedStore.signedJson)
    } catch (e) {
      jsonErr.value = 'Invalid JSON. Please check it and try again.'
      return;
    }

    const relay = relayStore.currentRelay
    if (!relay?.connected) {
      jsonErr.value = 'Please connect to relay first.'
      return;
    }

    // update pubkey to ensure that event will be higlighted in the feed if private key is presented 
    if (nsecStore.isValidNsecPresented()) {
      const pubkey = nsecStore.getPubkey()
      if (pubkey?.length) {
        pubKeyStore.updateKeyFromPrivate(pubkey)
      }
    }

    jsonErr.value = ''

    emit('broadcastEvent', event, 'json')
  }

  const handleClickAddNewField = () => {
    const newCount = relayStore.additionalRelaysCountForSignedEvent + 1
    relayStore.updateAdditionalRelaysCountForSignedEvent(newCount)
  }

  const handleJsonInput = (event: any) => {
    feedStore.updateSignedJson(event?.target?.value)
  }

  const handleRelayInput = (event: any, index: number) => {
    const value = event?.target?.value
    relayStore.updateRelayAdditionalRelaysUrlsForSignedEvent(index, value)
  }
</script>

<template>
  <div class="message-fields-wrapper">
    <div class="signed-message-desc">
      <p class="signed-message-desc_p">
        Event should be signed with your private key in advance. Event will be broadcasted to a selected relay.
        More details about events and signatures are <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/01.md#events-and-signatures">here</a>.
      </p>
      <p class="signed-message-desc_p">
        Event will be broadcasted to a selected relay. 
        You can add more relays to retransmit the event.
        <br>

        <button class="additional-relay-btn" @click="handleClickAddNewField">
          Add relay
        </button>

        <div v-if="relayStore.additionalRelaysCountForSignedEvent > 0" class="additional-relays">
          <div class="additional-relay-field">
            <span>1.</span>
            <input 
              readonly 
              :value="relayStore.currentRelay?.url ? `${relayStore.currentRelay?.url} (already selected)` : 'Firstly connect to default relay'" 
              type="text"
            >
          </div>
          <div v-for="i in relayStore.additionalRelaysCountForSignedEvent">
            <div class="additional-relay-field">
              <span>{{ i + 1 }}.</span>
              <input @input="(event) => handleRelayInput(event, i)" placeholder="[wss://]relay.example.com" type="text">
            </div>
          </div>
        </div>
      </p>
    </div> 

    <div class="message-fields__field_sig">
      <label class="message-fields__label" for="signed_json">
        <strong>JSON of a signed event</strong>
      </label>
      <div class="field-elements">
        <textarea
        class="signed-json-textarea"
        name="signed_json"
        id="signed_json"
        cols="30"
        rows="5"
        @input="handleJsonInput"
        placeholder='{"kind":1,"pubkey":"5486dbb083512982669fa180aa02d722ce35054233cea724061fbc5f39f81aa3","created_at":1685664152,"content":"Test message 👋","tags":[],"id":"89adae408121ba6d721203365becff4d312292a9dd9b7a35ffa230a1483b09a2","sig":"b2592ae88ba1040c928e458dd6822413f148c8cc4f478d992e024e8c9d9648b96e6ce6dc564ab5815675007f824d9e9f634f8dbde554afeb6e594bcaac4389dd"}'>{{ feedStore.signedJson }}</textarea>
      </div>
    </div>
    <div class="signed-json-btn-wrapper">
      <div class="error">
        {{ jsonErr }}
        {{ broadcastError }}
      </div>
      <button :disabled="isSendingMessage" class="send-btn send-btn_signed-json" @click="handleSendSignedEvent">
        {{ isSendingMessage ? 'Broadcasting...' : 'Broadcast' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
  .message-fields-wrapper {
    margin-bottom: 20px;
  }

  .signed-message-desc {
    margin-bottom: 15px;
  }

  .signed-message-desc_p {
    margin-top: 15px;
    margin-bottom: 0;
  }

  .additional-relay-btn {
    cursor: pointer;
  }

  .additional-relays {
    margin-top: 5px;    
  }

  .additional-relay-field {
    display: flex;
    align-items: center;
  }

  .additional-relay-field input {
    width: 100%; 
    box-sizing: border-box;
    margin-left: 5px;
  }

  @media (min-width: 768px) {
    .message-fields__field_sig {
      margin-bottom: 5px;
    }
  }

  .message-fields__field_sig input {
    margin-right: 0;
  }

  .message-fields__label {
    display: flex;
    align-items: center;
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

  .signed-json-textarea {
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .signed-json-textarea{
      font-size: 15px;
    }
  }

  .signed-json-btn-wrapper {
    display: flex;
    flex-direction: column-reverse;
    justify-content: space-between;
    align-items: start;
  }

  @media (min-width: 768px) {
    .signed-json-btn-wrapper {
      flex-direction: row;
    }
  }

  .signed-json-btn-wrapper .error {
    line-height: 1;
    margin-top: 0;
    margin-bottom: 5px;
    margin-top: 5px;
  }

  @media (min-width: 768px) {
    .signed-json-btn-wrapper .error {
       margin-top: 0;
    }
  }

  .error {
    color:red;
    font-size: 16px;
    margin-top: 5px;
  }

  .send-btn {
    font-size: 14px;
    width: 100%;
    margin-top: 5px;
    cursor: pointer;
  }

  @media (min-width: 768px) {
    .send-btn {
      width: auto;
    }
  }

  .send-btn_signed-json {
    margin-top: 5px;
  }
</style>