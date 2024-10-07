<script setup lang="ts">
  import { ref, defineEmits, watch } from 'vue'
  import { finalizeEvent } from 'nostr-tools'
  import { useNsec } from '@/stores/Nsec'
  import { useFeed } from '@/stores/Feed'
  import { useRelay } from '@/stores/Relay'
  import Textarea from '@/components/Textarea.vue'

  const props = defineProps<{
    sentEventIds: Set<string>
    isSendingMessage: boolean
  }>()

  const emit = defineEmits(['broadcastEvent', 'toggleMessageType', 'clearBroadcastError'])

  const nsecStore = useNsec()
  const feedStore = useFeed()
  const relayStore = useRelay()

  const msgErr = ref('')
  const msgNotice = ref('')
  const isFocused = ref(false)
  const rows = ref(3)

  watch(
    () => msgErr.value,
    (newValue) => {
      if (newValue.length) {
        setTimeout(() => {
          msgErr.value = ''
        }, 5000)
      }
    },
  )

  const handleSendMessage = async () => {
    emit('clearBroadcastError')

    msgNotice.value = ''

    if (!nsecStore.isValidNsecPresented()) {
      msgErr.value = 'Please login with your private key or generate random key in settings.'
      return
    }

    // trim here instead of "v-model.trim" because the size of textarea is flexible according to the content
    const messageValue = feedStore.messageToBroadcast.trim()
    if (!messageValue.length) {
      msgErr.value = 'Please provide message to broadcast.'
      return
    }

    let privkey: Uint8Array | null
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
      return
    }

    const event = {
      kind: 1,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: messageValue,
      tags: [],
      id: '',
      sig: '',
    }
    const signedEvent = finalizeEvent(event, privkey)

    if (props.sentEventIds.has(signedEvent.id)) {
      msgErr.value = "The same event can't be sent twice (same id, signature)."
      return
    }

    msgErr.value = ''

    emit('broadcastEvent', signedEvent, 'text')
  }

  const handleInput = (value: string) => {
    feedStore.updateMessageToBroadcast(value)
  }

  const handleFocus = () => {
    isFocused.value = true
    if (!msgErr.value.length && !nsecStore.isValidNsecPresented()) {
      msgNotice.value = 'Please login to broadcast the message. Or send a presigned message.'
    }
  }

  const handleBlur = () => {
    isFocused.value = false
    msgNotice.value = ''
  }

  const toggleMessageType = () => {
    emit('toggleMessageType')
  }
</script>

<template>
  <div :class="['message-field', { active: isFocused }]">
    <Textarea
      name="message"
      placeholder="What do you want to say?"
      :disabled="!relayStore.isConnectedToRelay"
      :rows="rows"
      :noBorder="true"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />
    <div class="message-footer">
      <button @click="toggleMessageType" class="send-presigned-btn">
        <i class="bi bi-braces presigned-icon"></i>
        <span>Send presigned message</span>
      </button>
      <button
        :disabled="isSendingMessage || !relayStore.isConnectedToRelay"
        :class="['send-btn', { disabled: isSendingMessage || !relayStore.isConnectedToRelay }]"
        @click="handleSendMessage"
      >
        {{ isSendingMessage ? 'Posting...' : 'Post' }}
      </button>
    </div>
  </div>
  <div class="error">
    {{ msgErr }}
  </div>
  <div class="warning">
    {{ msgNotice }}
  </div>
</template>

<style scoped>
  .message-field {
    border: 1px solid #2a2f3b;
    border-radius: 5px;
  }

  .message-field.active {
    border: 1px solid #0092bf;
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

  .presigned-icon {
    margin-right: 3px;
  }

  .post-icon {
    margin-right: 5px;
  }

  .send-btn {
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

  .send-btn:hover {
    background: #0077a3;
  }

  .send-btn:active {
    opacity: 0.9;
  }

  .send-btn.disabled {
    opacity: 0.6;
    cursor: default;
  }

  .send-btn.disabled:hover {
    background: #0092bf;
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
