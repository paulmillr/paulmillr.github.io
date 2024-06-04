<script setup lang="ts">
  import { type Ref, ref, onUpdated, defineProps, computed, nextTick } from 'vue'
  import type { Event } from 'nostr-tools'
  import type { Chat } from '@/types'
  import ChatMessagesList from '@/components/ChatMessagesList.vue'
  import ChatMessageForm from '@/components/ChatMessageForm.vue'
  import ChevronLeft from '@/icons/ChevronLeft.vue'
  import type { Rumor } from '@/utils/chat-crypto'

  import { useChat } from '@/stores/Chat' 
  import { usePool } from '@/stores/Pool'
  import { useRelay } from '@/stores/Relay'
  import { useChatsRelaysCache } from '@/stores/ChatsRelaysCache'
  import { EVENT_KIND } from '@/nostr'

  const emit = defineEmits(['setMessageStatusToPublished', 'handleDeselectChat'])

  const chatStore = useChat()
  const chatsRelaysCacheStore = useChatsRelaysCache()
  const relayStore = useRelay()
  const poolStore = usePool()
  const pool = poolStore.pool

  // each chat has its own queue
  const messagesQueue: Ref<Record<string, { 
    rumorId: string, 
    relays: string[], 
    wrapsBundle: Event[] 
  }[]>> = ref({});
  // each chat has its own loading state
  const loadingRoomRelaysQueue = ref<Record<string, boolean>>({})

  const props = defineProps<{
    chat: Chat
    userPubkey: string
    showChatsList: boolean
  }>()

  const messagesContainer = ref<HTMLElement | null>(null)
  const roomTags = computed(() => 
    props?.chat?.messages.length 
      ? props.chat.messages[props.chat.messages.length - 1]?.event.tags 
      : props?.chat?.initialRoomTags ? props.chat.initialRoomTags : []
  )
  const roomPubkeys = computed(() => roomTags.value.length ? [... new Set(roomTags.value.map(t => t[1]))] : [])
  const roomPubkeysWihoutUser = computed(() => roomPubkeys.value.filter(pubkey => pubkey !== props.userPubkey))
  
  onUpdated(async () => {
    scrollChatToBottom()

    let pubkeysToDownload: string[] = []
    roomPubkeysWihoutUser.value.forEach((pubkey) => {
      if (!chatsRelaysCacheStore.hasMeta(pubkey)) {
        pubkeysToDownload.push(pubkey)
      }
    })
    
    const { chat } = props
    if (!pubkeysToDownload.length || loadingRoomRelaysQueue.value[chat.id]) {
      return
    }

    loadingRoomRelaysQueue.value[chat.id] = true
    const relays = relayStore.connectedUserReadWriteUrlsWithSelectedRelay
    const metasDM = await pool.querySync(relays, { kinds: [EVENT_KIND.DM_RELAYS], authors: pubkeysToDownload })
    
    // first load DM specific relays
    const loadedPubkeys = new Set<string>()
    metasDM.forEach((event: Event) => {
      const hasRelay = event.tags.some((tag) => ((tag[0] === 'r' || tag[0] === 'relay') && tag[1] && tag[1].length))
      if (hasRelay) {
        loadedPubkeys.add(event.pubkey)
      }
    })
    chatsRelaysCacheStore.addMetas(metasDM)

    // second load general relays
    pubkeysToDownload = pubkeysToDownload.filter(pubkey => !loadedPubkeys.has(pubkey))
    if (pubkeysToDownload.length) {
      const metas = await pool.querySync(relays, { kinds: [EVENT_KIND.RELAY_LIST_META], authors: pubkeysToDownload })
      chatsRelaysCacheStore.addMetas(metas)
    }
    loadingRoomRelaysQueue.value[chat.id] = false

    // just in case, to ensure that queue has all messages
    await nextTick()
    setTimeout(() => {
      if (!messagesQueue.value[chat.id]?.length) return
      const queue = [...messagesQueue.value[chat.id]].reverse()
      messagesQueue.value[chat.id] = []
  
      queue.forEach(async (q) => {
        await sendMessage(q.relays, q.wrapsBundle)
        emit('setMessageStatusToPublished', chat.id, q.rumorId)
      })
    }, 1)
  })

  const scrollChatToBottom = async () => {
    await nextTick() // wait for DOM update
    const container = messagesContainer.value as HTMLElement
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  const preSendMessage = async (rumor: Rumor, wrapsBundle: Event[]) => {
    const { chat } = props
    const message = {
      event: rumor,
      isPublished: false,
    }

    chatStore.addOwnRumor(rumor.id)
    chat.messages.push(message)
    scrollChatToBottom()

    const relays = getMessagePublishRelays()
    if (loadingRoomRelaysQueue.value[chat.id]) {
      if (!messagesQueue.value[chat.id]) {
        messagesQueue.value[chat.id] = []
      }
      messagesQueue.value[chat.id].push({
        rumorId: rumor.id,
        relays,
        wrapsBundle
      })
      return
    }

    await sendMessage(relays, wrapsBundle)
    const msgIndex = chat.messages.findIndex(m => m.event.id === rumor.id)
    chat.messages[msgIndex].isPublished = true
  }

  const getMessagePublishRelays = () => {
    const ownRelays = relayStore.userChatRelaysUrls
    const chatPartnersRelays = chatsRelaysCacheStore.getRelaysByPubkeys(roomPubkeysWihoutUser.value)
    return [... new Set([...ownRelays, ...chatPartnersRelays])] as string[]
  }

  const sendMessage = async (relays: string[], wrapsBundle: Event[]) => {
    const promises: Promise<any>[] = []
    wrapsBundle.forEach(wrap => {
      promises.push(...pool.publish(relays, wrap))
    })
    return await Promise.allSettled(promises)
  }
</script>

<template>
  <div :class="['conversation', {'conversation_mobile-hidden': showChatsList} ]">
    <div class="chat-header">
      <span @click="emit('handleDeselectChat')" class="chats-link">
        <ChevronLeft />
        <span>Chats</span>
      </span>
      <span class="chat-title">
        {{ chat ? chat.title : 'Select chat' }}
      </span>
    </div>
    <div v-if="chat" class="chats__messages" ref="messagesContainer">
      <ChatMessagesList 
        :messages="chat.messages" 
        :userPubkey="userPubkey" 
      />
    </div>
    <div class="chats__chat-footer">
      <ChatMessageForm 
        :roomTags="roomTags" 
        :recipientsPubkeys="roomPubkeys" 
        :userPubkey="userPubkey"
        @preSendMessage="preSendMessage"
      />
    </div>
  </div>
</template>

<style scoped>
  .conversation {
    flex-grow: 1;
    margin-left: 15px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 5px;
  }

  .conversation_mobile-hidden {
    display: none;
  }

  @media screen and (min-width: 500px) {
    .conversation_mobile-hidden {
      display: flex;
    }
  }

  .chats-link {
    display: inline-flex;
    align-items: center;
    color: #0092bf;
    cursor: pointer;
    margin-right: 10px;
  }

  @media screen and (min-width: 500px) {
    .chats-link {
      display: none;
    }
  }

  .chat-header {
    border-bottom: 1px dashed #bbb;
    padding-bottom: 10px;
    margin-right: 20px;
    display: flex;
    align-items: center;
  }

  .chat-title {
    font-weight: bold;
  }

  .chats__messages {
    flex-grow: 1;
    margin: 10px 0;
    overflow-y: scroll;
    padding-right: 20px;
  }

  .chats__chat-footer {
    border-top: 1px dashed #bbb;
    margin-right: 20px;
    padding-top: 10px;
  }
</style>