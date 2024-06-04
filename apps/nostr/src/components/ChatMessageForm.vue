<script setup lang="ts">
  import { ref } from 'vue'
  import { createRumor, createSeal, createWrap, type Rumor } from '@/utils/chat-crypto'
  import { useNsec } from '@/stores/Nsec'
  import type { Event } from 'nostr-tools'

  const emit = defineEmits(['preSendMessage'])

  const message = ref('')
  const nsecStore = useNsec()

  const props = defineProps<{
    roomTags: string[][],
    recipientsPubkeys: string[],
    userPubkey: string
  }>()

  const prepareMessage = () => {
    const content = message.value
    if (!content.length) return

    const privateKey = nsecStore.getPrivkeyBytes()
    if (!privateKey) return

    const tags = props.roomTags
    if (!tags.length) return

    const recipientsPubkeys = props.recipientsPubkeys
    if (!recipientsPubkeys.length) return

    const event = {
      content,
      tags
    }

    const wrapsBundle: Event[] = []
    let userRumor: Rumor | null = null
    recipientsPubkeys.forEach(recipientPubkey => {
      const rumor = createRumor(event, privateKey)
      const seal = createSeal(rumor, privateKey, recipientPubkey)
      const wrap = createWrap(seal, recipientPubkey)
      wrapsBundle.push(wrap)
      if (recipientPubkey === props.userPubkey) {
        userRumor = rumor
      }
    })

    message.value = ''
    emit('preSendMessage', userRumor, wrapsBundle)
  }
</script>

<template>
  <form @submit.prevent="prepareMessage">
    <div class="chats__text-field">
      <input v-model.trim="message" class="chats__input" type="text">
      <button type="submit" class="chats__send-btn">Send</button>
    </div>
  </form>
</template>

<style scoped>
  .chats__text-field {
    display: flex;
  }

  .chats__input {
    font-size: 15px;
    flex-grow: 1;
    margin-right: 5px;
  }

  .chats__send-btn {
    font-size: 14px;
    cursor: pointer;
  }
</style>