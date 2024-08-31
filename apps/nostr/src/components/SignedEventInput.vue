<script setup lang="ts">
  import { ref, defineEmits } from 'vue'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'

  defineProps<{
    isSendingMessage: boolean
    sentEventIds: Set<string>
  }>()

  const emit = defineEmits(['broadcastEvent', 'toggleMessageType', 'clearBroadcastError'])
  const relayStore = useRelay()
  const feedStore = useFeed()
  const jsonErr = ref('')
  const msgNotice = ref('')
  const addRelayNotice = ref('')
  const isFocused = ref(false)

  const handleSendSignedEvent = () => {
    emit('clearBroadcastError')

    if (!feedStore.signedJson.length) {
      jsonErr.value = 'Please provide a signed event.'
      return
    }

    let event
    try {
      event = JSON.parse(feedStore.signedJson)
    } catch (e) {
      jsonErr.value = 'Invalid JSON. Please check it and try again.'
      return
    }

    if (!relayStore.isConnectedToRelay) {
      jsonErr.value = 'Please connect to broadcast the message.'
      return
    }

    jsonErr.value = ''

    emit('broadcastEvent', event, 'json')
  }

  const handleClickAddNewField = () => {
    if (!relayStore.isConnectedToRelay) {
      addRelayNotice.value = 'Please connect first to add relays and broadcast the message.'
      setTimeout(() => {
        addRelayNotice.value = ''
      }, 5000)
      return
    }
    const newCount = relayStore.additionalRelaysCountForSignedEvent + 1
    relayStore.updateAdditionalRelaysCountForSignedEvent(newCount)
  }

  const handleRelayInput = (event: any, index: number) => {
    const value = event?.target?.value.trim()
    relayStore.updateRelayAdditionalRelaysUrlsForSignedEvent(index, value)
  }

  const toggleMessageType = () => {
    emit('toggleMessageType')
  }

  const handleFocus = () => {
    isFocused.value = true
  }

  const handleBlur = () => {
    isFocused.value = false
    msgNotice.value = ''
  }
</script>

<template>
  <div class="signed-message-desc">
    <p class="signed-message-desc_p">
      Event should be signed with your private key in advance. More details about events and
      signatures are
      <a
        target="_blank"
        href="https://github.com/nostr-protocol/nips/blob/master/01.md#events-and-signatures"
        >here</a
      >.
    </p>
    <p class="signed-message-desc_p">
      Event will be broadcasted to a selected relay(<em>{{
        relayStore.isConnectedToRelay ? relayStore.currentRelay.url : 'available after connect'
      }}</em
      >). You can add more relays to retransmit the event.
      <br />
    </p>
    <p class="signed-message-desc_p">
      <button class="additional-relay-btn button" @click="handleClickAddNewField">Add relay</button>
    </p>
    <div class="warning">
      {{ addRelayNotice }}
    </div>
    <div v-if="relayStore.additionalRelaysCountForSignedEvent > 0" class="additional-relays">
      <div class="additional-relay-field">
        <span class="aditinal-relay-num">1.</span>
        <input
          class="additional-relay-input"
          readonly
          :value="
            relayStore.currentRelay?.url
              ? `${relayStore.currentRelay?.url} (selected)`
              : 'Firstly connect to default relay'
          "
          type="text"
        />
      </div>
      <div v-for="i in relayStore.additionalRelaysCountForSignedEvent" :key="i">
        <div class="additional-relay-field">
          <span class="aditinal-relay-num">{{ i + 1 }}.</span>
          <input
            class="additional-relay-input"
            @input="(event) => handleRelayInput(event, i)"
            placeholder="[wss://]relay.example.com"
            type="text"
          />
        </div>
      </div>
    </div>
  </div>

  <div class="message-field-label">
    <label for="signed_json"><strong>JSON of a signed event</strong></label>
  </div>
  <div :class="['message-field', { active: isFocused }]">
    <textarea
      :disabled="!relayStore.isConnectedToRelay"
      class="message-input"
      name="signed_json"
      id="signed_json"
      cols="30"
      rows="5"
      @focus="handleFocus"
      @blur="handleBlur"
      v-model.trim="feedStore.signedJson"
      placeholder='{"kind":1,"pubkey":"5486dbb083512982669fa180aa02d722ce35054233cea724061fbc5f39f81aa3","created_at":1685664152,"content":"Test message 👋","tags":[],"id":"89adae408121ba6d721203365becff4d312292a9dd9b7a35ffa230a1483b09a2","sig":"b2592ae88ba1040c928e458dd6822413f148c8cc4f478d992e024e8c9d9648b96e6ce6dc564ab5815675007f824d9e9f634f8dbde554afeb6e594bcaac4389dd"}'
    ></textarea>
    <div class="message-footer">
      <button @click="toggleMessageType" class="send-presigned-btn">
        <i class="bi bi-pencil-square post-icon"></i>
        <span>New post within your profile</span>
      </button>
      <button
        :disabled="isSendingMessage || !relayStore.isConnectedToRelay"
        :class="['button send-btn', { disabled: !relayStore.isConnectedToRelay }]"
        @click="handleSendSignedEvent"
      >
        {{ isSendingMessage ? 'Posting...' : 'Post' }}
      </button>
    </div>
  </div>

  <div class="error">
    {{ jsonErr }}
  </div>
  <div class="warning">
    {{ msgNotice }}
  </div>
</template>

<style scoped>
  .signed-message-desc {
    margin-bottom: 15px;
  }

  .signed-message-desc_p {
    margin-top: 15px;
    margin-bottom: 0;
  }

  .additional-relays {
    margin-top: 15px;
  }

  .additional-relay-field {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
  }

  .additional-relay-input {
    background: transparent;
    color: inherit;
    border: 1px solid #2a2f3b;
    outline: none;
    border-radius: 5px;
    padding: 6px 12px;
    box-sizing: border-box;
    width: 100%;
    font-size: 16px;
  }

  .additional-relay-input:focus {
    border: 1px solid #0092bf;
  }

  .aditinal-relay-num {
    min-width: 18px;
    margin-right: 6px;
  }

  .message-field-label {
    margin-bottom: 8px;
  }

  .message-field {
    border: 1px solid #2a2f3b;
    border-radius: 5px;
  }

  .message-field.active {
    border: 1px solid #0092bf;
  }

  .message-input {
    font-size: 15px;
    padding: 10px 12px;
    width: 100%;
    box-sizing: border-box;
    background: transparent;
    border: none;
    color: inherit;
    outline: none;
    line-height: 1.3;
    resize: none;
    display: block;
    border-bottom: none;
  }

  .message-input:focus {
    border-bottom: none;
  }

  .message-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #2a2f3b;
    padding: 12px;
  }

  .send-presigned-btn {
    display: flex;
    align-items: center;
    font-size: 14px;
    cursor: pointer;
    background: transparent;
    border: none;
    outline: none;
    color: #0092bf;
    font-weight: bold;
    padding: 0;
  }

  .send-presigned-btn .icon {
    font-size: 16px;
  }

  .post-icon {
    margin-right: 5px;
  }

  .button {
    cursor: pointer;
    background: #0092bf;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    width: auto;
  }

  .button:hover {
    background: #0077a3;
  }

  .button:active {
    opacity: 0.9;
  }

  .button.disabled {
    opacity: 0.6;
    cursor: default;
  }

  .button.disabled:hover {
    background: #0092bf;
  }

  .additional-relay-btn {
    width: auto;
    font-size: 16px;
  }

  .error {
    color: #ff4040;
    font-size: 16px;
    margin-top: 5px;
  }

  .warning {
    color: #ffda6a;
    font-size: 16px;
    margin-top: 5px;
  }
</style>
