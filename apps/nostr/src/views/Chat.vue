<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { SimplePool, utils, type SubCloser, type Filter } from "nostr-tools"
  import { TWO_DAYS, now } from '@/utils/chat-crypto'
  import { racePromises } from '@/utils'
  import {
    injectChatTitle,
    getChatRoomHash,
    getRumorFromWrap,
    getChatMessageFromRumor,
    getNewChatRoomHash,
    getNewChatTitle,
    isGroupChat
  } from '@/utils/chat'

  import { usePool } from '@/stores/Pool'
  import { useRelay } from '@/stores/Relay'
  import { useNsec } from '@/stores/Nsec'
  import { useChat } from '@/stores/Chat'

  import ChatsList from '@/components/ChatsList.vue'
  import ChatsConversation from '@/components/ChatsConversation.vue'
  import ChatCreateRoomForm from '@/components/ChatCreateRoomForm.vue'

  // import mock_chats from '@/views/temp.json'
  import type { Chat, ChatMessage, RawChat } from '@/types'
  import { EVENT_KIND } from '@/nostr'

  const { normalizeURL } = utils
  let chatSub: SubCloser;

  const relayStore = useRelay()
  const nsecStore = useNsec()
  const chatStore = useChat()

  const poolStore = usePool()
  const pool = poolStore.pool

  const currentChatId = ref('')
  const isLoadingNewChatProfile = ref(false)

  let debounceSearchTimeout: number | null = null
  const userChats = ref<Record<string, Chat>>({})
  const userChatsMessagesCache = ref<Record<string, ChatMessage[]>>({})
  const userPubkey = ref('')
  const isChatsLoading = ref(false)
  const chatsEmpty = computed(() => Object.keys(userChats.value).length === 0)

  const isConnectedLoggedInUser = computed(() => relayStore.isConnectedToReadWriteRelays && nsecStore.isNsecValidTemp)

  const sortedChats = computed(() => {
    return Object.entries(userChats.value).map(([key, value]) => value).sort((a, b) => b.created_at_last_message - a.created_at_last_message)
  })

  const showChatsList = ref(true)

  watch(
    () => nsecStore.nsec,
    async () => {
      if (!nsecStore.isNsecValidTemp) return
      userPubkey.value = nsecStore.getPubkey()
    },
    { immediate: true }
  )

  watch(
    () => relayStore.isConnectingToReadWriteRelays,
    (value) => {
      if (value) {
        isChatsLoading.value = true
      }
    }
  )

  watch(
    () => relayStore.isConnectedToReadWriteRelays,
    (value) => {
      if (value && nsecStore.isNsecValidTemp) {
        loadChats()
      }
    }
  )

  onMounted(() => {
    if (isConnectedLoggedInUser.value) {
      loadChats()
    }
  })

  const addChat = (chat: Chat) => {
    userChats.value[chat.id] = chat
    setTimeout(() => {
      if (userChatsMessagesCache.value[chat.id]) {
        const messages = [...userChatsMessagesCache.value[chat.id]]
        userChatsMessagesCache.value[chat.id] = []
        messages.forEach((message) => {
          userChats.value[chat.id].messages.push(message)
        })
      }
    }, 1)
    isChatsLoading.value = false
  }

  const handleChatTitleError = (error: any) => {
    console.error('Chats error:', error)
  }

  const loadChats = async () => {
    isChatsLoading.value = true
    let relays = relayStore.connectedUserReadWriteUrlsWithSelectedRelay
    const hostPubkey = nsecStore.getPubkey()

    // reset chats
    userChats.value = {}
    chatSub?.close()

    // get relays for private messages if presented
    const dmRelaysEvents = await pool.querySync(relays, { kinds: [EVENT_KIND.DM_RELAYS], authors: [hostPubkey] })
    if (dmRelaysEvents.length) {
      const dmRelaysUrlsSet = new Set()

      dmRelaysEvents.forEach((event) => {
        event.tags.forEach((tag) => {
          if ((tag[0] === 'r' || tag[0] === 'relay') && tag[1] && tag[1].length) {
            dmRelaysUrlsSet.add(normalizeURL(tag[1]))
          }
        })
      })

      if (dmRelaysUrlsSet.size) {
        relays = [...dmRelaysUrlsSet] as string[]
        relayStore.setUserDMRelaysUrls(relays) // save for future use (message posting)
      }
    }

    const hostMessages = await pool.querySync(relays, { kinds: [EVENT_KIND.GIFT_WRAP], "#p": [hostPubkey] })

    const privateKey = nsecStore.getPrivkeyBytes() as Uint8Array
    let chats: Record<string, RawChat> = {}
    let lastMessageDate = 0
    const initialMessagesIds = new Set<string>()
    hostMessages.forEach(giftWrap => {
      initialMessagesIds.add(giftWrap.id)
      const rumor = getRumorFromWrap(giftWrap, privateKey)
      if (!rumor) return // skip invalid rumors
      if (isGroupChat(rumor)) return // skip group chats (not implemented yet)

      const chatId = getChatRoomHash(rumor)
      const message = getChatMessageFromRumor(rumor)

      if (chats[chatId]) {
        chats[chatId].messages.push(message)
      } else {
        chats[chatId] = {
          'messages': [message]
        }
      }

      if (rumor.created_at > lastMessageDate) {
        lastMessageDate = rumor.created_at
      }
    });

    const chatsPromises = []
    for (const id in chats) {
      const chat = chats[id]
      chat.id = id
      chat.messages = chat.messages.sort((a, b) => a.event.created_at - b.event.created_at)
      chat.created_at_last_message = chat.messages[chat.messages.length - 1].event.created_at
      const chatPromise = injectChatTitle(chat, hostPubkey, pool as SimplePool, relayStore.connectedUserReadWriteUrlsWithSelectedRelay)
      chatsPromises.push(chatPromise)
    }

    if (chatsPromises.length) {
      racePromises(chatsPromises, addChat, handleChatTitleError)
    } else {
      isChatsLoading.value = false
    }

    const lastGiftWrapDate = hostMessages.length ? lastMessageDate - TWO_DAYS : null
    subscribeToMessages(relays, lastGiftWrapDate, initialMessagesIds)
  }

  const subscribeToMessages = (relays: string[], since: number | null = null, eventsToSkip: Set<string> | null = null) => {
    const hostPubkey = nsecStore.getPubkey()
    const privateKey = nsecStore.getPrivkeyBytes() as Uint8Array
    const filter: Filter = { kinds: [EVENT_KIND.GIFT_WRAP], "#p": [hostPubkey] }
    if (since) {
      filter.since = since
    }
    chatSub = pool.subscribeMany(
      relays,
      [filter],
      {
        onevent(giftWrap) {
          if (eventsToSkip && eventsToSkip.has(giftWrap.id)) return
          const rumor = getRumorFromWrap(giftWrap, privateKey)
          if (!rumor) return // skip invalid rumors
          if (isGroupChat(rumor)) return // skip group chats (not implemented yet)

          const chatId = getChatRoomHash(rumor)
          const message = getChatMessageFromRumor(rumor)

          if (userChats.value[chatId]) {
            // skip messages from ourself which was sent from own client
            if (chatStore.ownRumors.has(message.event.id)) return
            userChats.value[chatId].messages.push(message)
          } else {
            if (!userChatsMessagesCache.value[chatId]) {
              userChatsMessagesCache.value[chatId] = []
            }
            userChatsMessagesCache.value[chatId].push(message)
          }
        },
      }
    )
  }

  const handleSelectChat = (chatId: string) => {
    currentChatId.value = chatId
    showChatsList.value = false
  }

  const handleDeselectChat = () => {
    currentChatId.value = ''
    showChatsList.value = true
  }

  const setMessageStatusToPublished = (chatId: string, rumorId: string) => {
    const message = userChats.value[chatId].messages.find((m: ChatMessage) => m.event.id === rumorId)
    if (message) {
      message.isPublished = true
    }
  }

  const startChat = async (pubkey: string) => {
    const roomPubkeys = pubkey === userPubkey.value ? [pubkey] : [userPubkey.value, pubkey]
    const chatId = getNewChatRoomHash(roomPubkeys)

    if (userChats.value[chatId]) {
      return handleSelectChat(chatId)
    }

    isLoadingNewChatProfile.value = true
    const title = await getNewChatTitle(pubkey, pool as SimplePool, relayStore.connectedUserReadWriteUrlsWithSelectedRelay)
    isLoadingNewChatProfile.value = false

    const newChat = {
      id: chatId,
      messages: [],
      title: title,
      initialRoomTags: roomPubkeys.map(p => ['p', p]),
      created_at_last_message: now()
    }

    addChat(newChat)
    await nextTick()
    handleSelectChat(chatId)
  }

  /**
   * Extended user search, not implemented yet.
   *

  // watch(userSearchQuery, (newQuery) => {
  //   debouncedSearch(newQuery)
  // })

  const performExntededUserSearch = async (query: string, until: number, attempts = 100) => {
    query = query.replace('@', '')
    let result: null | Event = null
    const relays = relayStore.connectedUserReadRelayUrlsWithSelectedRelay

    const sub = pool.subscribeMany(relays, [{ kinds: [0], limit: 500, until }], {
      onevent(event: Event) {
        const metadata = JSON.parse(event.content);
        const { username, name } = metadata
        if (username === query || name === query) {
          console.log('User found:', metadata);
          result = metadata
          sub.close()
        }
        until = event.created_at
      },
      async oneose() {
        if (!result && --attempts > 0) {
          await performExntededUserSearch(query, until, attempts)
        }
        sub.close()
      }
    })
  }

  const debouncedSearch = (query: string) => {
    if (query === '@') return

    if (debounceSearchTimeout) {
      clearTimeout(debounceSearchTimeout)
    }

    debounceSearchTimeout = setTimeout(async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000)
      await performExntededUserSearch(query, currentTimestamp)
    }, 400)
  }

  */
</script>

<template>
  <div class="chats-desc">
    <p>
      Chats use the new Nostr <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/44.md">NIP-44</a> encryption standard.
      Make sure the person you are chatting with uses a Nostr client that supports this NIP.
      <!-- <a href="/apps/nostr/#/help">More info</a> about messages and used relays. -->
    </p>
  </div>

  <div class="user-field-wrapper">
    <ChatCreateRoomForm
      @startChat="startChat"
      :isLoadingProfile="isLoadingNewChatProfile"
    />
  </div>

  <h3 class="chats-title">
    Chats
  </h3>

  <div v-if="!isConnectedLoggedInUser && !isChatsLoading" class="no-chats">
    Please connect and login to see you chats.
  </div>

  <div v-if="isChatsLoading">
    Loading chats...
  </div>

  <div v-if="isConnectedLoggedInUser && !isChatsLoading" class="chats">
    <ChatsList
      :chats="sortedChats"
      :currentChatId="currentChatId"
      :handleSelectChat="handleSelectChat"
      :showChatsList="showChatsList"
    />
    <ChatsConversation
      v-if="!chatsEmpty"
      @setMessageStatusToPublished="setMessageStatusToPublished"
      @handleDeselectChat="handleDeselectChat"
      :chat="userChats[currentChatId]"
      :userPubkey="userPubkey"
      :showChatsList="showChatsList"
    />
  </div>
</template>

<style scoped>
  .chats-title {
    margin-top: 25px;
    margin-bottom: 10px;
  }

  .user-field-wrapper {
    margin: 15px 0;
  }

  .chats {
    display: flex;
    justify-content: space-between;
    height: 600px;
  }
</style>
