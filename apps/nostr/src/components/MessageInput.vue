<script setup lang="ts">
  import { ref, defineEmits } from 'vue'
  import { finalizeEvent } from 'nostr-tools'
  import { useNsec } from '@/stores/Nsec'
  import { useFeed } from '@/stores/Feed'

  const props = defineProps<{
    sentEventIds: Set<string>,
    isSendingMessage: boolean,
    broadcastNotice: string
  }>()

  const emit = defineEmits(['broadcastEvent'])

  const nsecStore = useNsec()
  const feedStore = useFeed()

  const msgErr = ref('')

  const handleSendMessage = async () => {
    const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : ''
    if (!nsecValue.length) {
      msgErr.value = 'Please provide your private key or generate random key.'
      return;
    }

    const messageValue = feedStore.messageToBroadcast.trim()
    if (!messageValue.length) {
      msgErr.value = 'Please provide message to broadcast.'
      return;
    }

    let privkey: Uint8Array | null;
    let pubkey: string
    try {
      privkey = nsecStore.getPrivkeyBytes()
      if (!privkey) {
        throw new Error()
      }
      pubkey = nsecStore.getPubkey()
      if (!pubkey.length) {
        throw new Error()
      }
    } catch (e) {
      msgErr.value = `Invalid private key. Please check it and try again.`
      return;
    }

    const event = {
      kind: 1,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: messageValue,
      tags: [],
      id: '',
      sig: ''
    }
    const signedEvent = finalizeEvent(event, privkey)

    if (props.sentEventIds.has(signedEvent.id)) {
      msgErr.value = 'The same event can\'t be sent twice (same id, signature).'
      return;
    }

    msgErr.value = ''

    emit('broadcastEvent', signedEvent, 'text')
  }

  const handleInput = (event: any) => {
    feedStore.updateMessageToBroadcast(event?.target?.value)
  }
</script>

<template>
  <div class="message-fields-wrapper">
    <div class="message-fields">
      <div class="message-fields__field">
        <label for="message">
          <strong>Message to broadcast</strong>
        </label>
        <div class="field-elements">
          <textarea
            class="message-input"
            name="message"
            id="message"
            cols="30"
            rows="3"
            :value="feedStore.messageToBroadcast"
            @input="handleInput"
            placeholder='Test message 👋'></textarea>
        </div>
        <div class="send-btn-wrapper">
          <button :disabled="isSendingMessage" class="send-btn" @click="handleSendMessage">
            {{ isSendingMessage ? 'Broadcasting...' : 'Broadcast' }}
          </button>
        </div>
      </div>
    </div>
    <div class="error">
      {{ msgErr }}
    </div>
    <div class="notice">
      {{ broadcastNotice }}
    </div>
  </div>
</template>

<style scoped>
  .message-fields-wrapper {
    margin-bottom: 20px;
  }

  .message-fields {
    display: flex;
    flex-wrap: wrap;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .message-fields {
      flex-direction: row;
    }
  }

  .message-fields__field {
    flex-grow: 1;
    margin-bottom: 10px
  }

  @media (min-width: 768px) {
    .message-fields__field {
      margin-bottom: 0;
    }
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

  .message-input {
    font-size: 16px;
    padding: 1px 3px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .message-input {
      font-size: 15px;
    }
  }

  .send-btn-wrapper {
    text-align: right;
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

  .error {
    color:red;
    font-size: 16px;
    margin-top: 5px;
  }

  .notice {
    font-size: 16px;
    margin-top: 5px;
  }
</style>