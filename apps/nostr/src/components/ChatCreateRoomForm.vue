<script setup lang="ts">
  import { ref } from 'vue'
  import { isSHA256Hex } from '@/utils'
  import { nip19 } from 'nostr-tools'
  import { useRelay } from '@/stores/Relay'

  defineProps<{
    isLoadingProfile: boolean
  }>()

  const emit = defineEmits(['startChat'])

  const relayStore = useRelay()

  const userSearchQuery = ref('')
  const pubkeyError = ref('')

  const startChat = () => {
    const search = userSearchQuery.value
    let pubkey = ''

    if (!relayStore.isConnectedToReadWriteRelays) {
      pubkeyError.value = 'Please connect to a relay first.'
      return
    }

    if (!search.length) {
      pubkeyError.value = 'Provide the public key of the person to chat with.'
      return
    }

    if (isSHA256Hex(search)) {
      pubkey = search
    } else {
      try {
        let { data, type } = nip19.decode(search)
        if (type !== 'npub') {
          pubkeyError.value = 'Public key is invalid. Please check it and try again.'
          return
        }
        pubkey = data.toString()
      } catch (e) {
        pubkeyError.value = 'Public key is invalid. Please check it and try again.'
        return
      }
    }

    pubkeyError.value = ''

    emit('startChat', pubkey)
  }
</script>

<template>
  <form @submit.prevent="startChat">
    <label for="start-chat-pubkey">
      <strong>Profile's public key</strong>
    </label>
    <div class="user-field">
      <input
        v-model.trim="userSearchQuery"
        class="find-user-input"
        id="start-chat-pubkey"
        type="text"
        placeholder="npub or hex of pubkey"
      />
      <button type="submit" class="start-chat-btn">Start chat</button>
    </div>
  </form>
  <div v-if="isLoadingProfile" class="notice">Loading profile info...</div>
  <div v-if="pubkeyError" class="error">
    {{ pubkeyError }}
  </div>
</template>

<style scoped>
  .user-field {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
  }

  .find-user-input {
    flex-grow: 1;
    font-size: 15px;
    margin-right: 5px;
  }

  .start-chat-btn {
    font-size: 14px;
    cursor: pointer;
  }

  .error {
    color: #ff4040;
    font-size: 16px;
    margin-top: 5px;
  }

  .notice {
    margin-top: 10px;
  }
</style>
