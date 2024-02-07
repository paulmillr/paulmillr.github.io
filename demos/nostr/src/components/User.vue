<script setup lang="ts">
  import { onMounted, ref, onBeforeMount, onBeforeUpdate, computed, watch } from 'vue'
  import {
    nip19,
    getPublicKey,
    nip05,
    nip10,
    type SimplePool,
    type Relay,
    type Event,
  } from 'nostr-tools'
  import { useRouter, useRoute } from 'vue-router'

  import { fallbackRelays, DEFAULT_EVENTS_COUNT } from './../app'
  import { 
    isSHA256Hex,
    injectDataToNotes
  } from './../utils'
  import type { Author, EventExtended } from './../types'
  import {
    userEvent,
    userDetails,
    cachedNpub,
    cachedUrlNpub,
    nsec,
    isUserHasValidNip05,
    isUsingFallbackSearch,
    npub,
    isRoutingUser,
    gettingUserInfoId,
    userNotesEvents,
    userNotesEventsIds,
    showImages,
    currentRelay,
    userPool
  } from './../store'
  import UserEvent from './UserEvent.vue'
  import DownloadIcon from './../icons/DownloadIcon.vue'
  import EventView from './EventView.vue'
  import Pagination from "./Pagination.vue";

  const pool = userPool.value

  const props = defineProps<{
    handleRelayConnect: Function
  }>()

  const pubKeyError = ref('')
  const showNotFoundError = ref(false)
  const pubHex = ref('')
  const showLoadingUser = ref(false)
  const notFoundFallbackError = ref('')
  const isLoadingFallback = ref(false)
  const showLoadingTextNotes = ref(false)
  const isAutoConnectOnSearch = ref(false)
  const isEventSearch = ref(false)

  const currentPage = ref(1);
  const pagesCount = computed(() => Math.ceil(userNotesEventsIds.value.length / DEFAULT_EVENTS_COUNT))
  const router = useRouter()
  const route = useRoute()
  
  const nip05toURL = (identifier: string) => {
    const [name, domain] = identifier.split('@')
    return `https://${domain}/.well-known/nostr.json?name=${name}`
  }

  const currentRelays = ref<string[]>([])

  onMounted(() => {
    // first mount when npub presented in url, run only once 
    if (route.params?.id?.length && !cachedNpub.value.length && !currentRelay.value.status) {
      npub.update(route.params.id as string)
      cachedUrlNpub.update(npub.value)
      if (!currentRelay.value.status) {
        isAutoConnectOnSearch.value = true
      }
      return
    }

    if (isRoutingUser.value && npub.value?.length) {
      cachedUrlNpub.update(npub.value)
      isRoutingUser.update(false)
      handleGetUserInfo()
      return
    }

    if (cachedNpub.value.length) {
      npub.update(cachedNpub.value)
      return
    }
  })

  watch(
    () => route.params,
    (newVal, prevVal) => {
      if (newVal.id !== prevVal.id) {
        cachedUrlNpub.update(npub.value)
        isRoutingUser.update(false)
        handleGetUserInfo()
      }
    },
  )

  onBeforeMount(() => {
    if (userNotesEvents.value.length) {
      handleGetUserInfo()
    }
  })

  const handleInputNpub = () => {
    notFoundFallbackError.value = ''
    showNotFoundError.value = false
  }

  const showUserPage = async (page: number) => {
    const relay = currentRelay.value
    if (!relay) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const idsToShow = userNotesEventsIds.value.slice(start, end) 

    const postsEvents = await relay.list([{ ids: idsToShow }]) as EventExtended[]

    let posts = injectAuthorToUserNotes(postsEvents, userDetails.value)

    const relaysUrls = [relay.url]
    await injectDataToNotes(posts, relaysUrls, pool as SimplePool)

    userNotesEvents.update(posts as EventExtended[])
    currentPage.value = page
  }

  const handleGetUserInfo = async () => {
    // start tracking that user is loading
    // increase tracker to stop previous function calls if they are still in process
    gettingUserInfoId.update(gettingUserInfoId.value + 1)
    const currentOperationId = gettingUserInfoId.value

    const searchVal = npub.value.trim()
    let isHexSearch = false

    if (!searchVal.length) {
      pubKeyError.value = 'Public key or event id is required.'
      return
    }

    if (isSHA256Hex(searchVal)) {
      pubHex.value = searchVal
      isHexSearch = true
    } else {
      try {
        let { data, type } = nip19.decode(searchVal)
        if (type !== 'npub' && type !== 'note') {
          pubKeyError.value = 'Public key or event id should be in npub or note format, or hex.'
          return
        }
        isEventSearch.value = type === 'note'
        pubHex.value = data.toString()
      } catch (e) {
        pubKeyError.value = 'Public key or event id is invalid. Please check it and try again.'
        return
      }
    }

    let relay: Relay
    if (isAutoConnectOnSearch.value) {
      relay = await props.handleRelayConnect()
    } else {
      relay = currentRelay.value
    }
    if (currentOperationId !== gettingUserInfoId.value) return
    
    if (!relay || relay.status !== 1) {
      pubKeyError.value = isAutoConnectOnSearch.value
        ? 'Connection error, try to connect again or try to choose other relay.' 
        : 'Please connect to relay first.'
      return;
    }
    isAutoConnectOnSearch.value = false

    userEvent.update({} as Event)
    userDetails.update({} as Author)
    userNotesEvents.update([] as EventExtended[])
    userNotesEventsIds.update([])
    isUsingFallbackSearch.update(false)

    pubKeyError.value = ''
    showLoadingUser.value = true

    // in case of searching for one event, loading this event firstly to get user pubHex
    let notesEvents: EventExtended[] = []
    if (isEventSearch.value || isHexSearch) {
      const eventId = pubHex.value

      // notesEvents = await relayList(relay, [{ ids: [eventId] }]) as EventExtended[]
      notesEvents = await relay.list([{ ids: [eventId] }]) as EventExtended[]
      if (currentOperationId !== gettingUserInfoId.value) return

      if (notesEvents.length) {
        userNotesEventsIds.update(notesEvents.map((event) => event.id))
        pubHex.value = notesEvents[0].pubkey
        isEventSearch.value = true
      }
    }

    // const authorMeta = await relayGet(relay, { kinds: [0], limit: 1, authors: [pubHex.value] }) as Event
    const authorMeta = await relay.get({ kinds: [0], limit: 1, authors: [pubHex.value] })
    if (currentOperationId !== gettingUserInfoId.value) return
    if (!authorMeta) {
      showLoadingUser.value = false
      showNotFoundError.value = true
      return
    }

    currentRelays.value = [relay.url]
    
    // const authorContacts = await relayGet(relay, { kinds: [3], limit: 1, authors: [pubHex.value] }) as Event
    const authorContacts = await relay.get({ kinds: [3], limit: 1, authors: [pubHex.value] })
    if (currentOperationId !== gettingUserInfoId.value) return
    
    userEvent.update(authorMeta)
    userDetails.update(JSON.parse(authorMeta.content))
    userDetails.updateFollowingCount(authorContacts?.tags.length || 0)

    isUserHasValidNip05.update(false)
    showLoadingUser.value = false
    showNotFoundError.value = false

    // routing
    if (isEventSearch.value) {
      router.push({ path: `/event/${searchVal}` })
    } else {
      router.push({ path: `/user/${searchVal}` })
    }
    cachedUrlNpub.update(searchVal)

    showLoadingTextNotes.value = true

    checkAndShowNip05(currentOperationId)

    // event was loaded before in case of searching for one event
    // filtering for replies only when searching for user, otherwise we show the post even if it is a reply
    if (!isEventSearch.value) {
      // notesEvents = await relayList(relay, [{ kinds: [1], authors: [pubHex.value] }]) as EventExtended[]
      notesEvents = await relay.list([{ kinds: [1], authors: [pubHex.value] }]) as EventExtended[]
      if (currentOperationId !== gettingUserInfoId.value) return

      const repliesIds = new Set()
      notesEvents.forEach((event) => {
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) {
          repliesIds.add(event.id)
        }
      })
      notesEvents = notesEvents.filter((event) => !repliesIds.has(event.id))
      userNotesEventsIds.update(notesEvents.map((event) => event.id))

      const limit = DEFAULT_EVENTS_COUNT
      currentPage.value = 1

      notesEvents = notesEvents.slice(0, limit)
    }

    notesEvents = injectAuthorToUserNotes(notesEvents, userDetails.value)
    
    const relaysUrls = currentRelays.value
    await injectDataToNotes(notesEvents, relaysUrls, pool as SimplePool)
    if (currentOperationId !== gettingUserInfoId.value) return

    userNotesEvents.update(notesEvents as EventExtended[])
    showLoadingTextNotes.value = false
  }

  const injectAuthorToUserNotes = (notes: EventExtended[], details: Author) => {
    return notes.map(note => {
      note.author = details
      return note
    })
  }

  const checkAndShowNip05 = async (currentOperationId: number = 0) => {
    const nip05Identifier = userDetails.value.nip05
    const userPubkey = userEvent.value.pubkey
    if (!nip05Identifier || !userPubkey) return
    try {
      const validNip = await isValidNip05(nip05Identifier, userPubkey)
      if (currentOperationId && currentOperationId !== gettingUserInfoId.value) {
        return
      }
      isUserHasValidNip05.update(validNip)
    } catch (e) {
      console.log('Failed to check nip05')
    }
  }

  const isValidNip05 = async (identifier: string, metaEventPubkey: string) => {
    const profile = await nip05.queryProfile(identifier)
    return metaEventPubkey === profile?.pubkey
  }

  // not used yet
  const getNip05Relays = async (identifier: string, metaEventPubkey: string) => {
    const profile = await nip05.queryProfile(identifier)
    if (metaEventPubkey !== profile?.pubkey) return []
    return profile.relays
  }

  // WIP (not used yet)
  const getNip65Relays = async () => {
    const relay = currentRelay.value
    const events = await relay.list([{ kinds: [10002], authors: [pubHex.value], limit: 1 }])
    if (!events.length) return []
    const event = events[0]
    // TDOD: extract relays from event
  }

  const handleGeneratePublicFromPrivate = () => {
    const nsecVal = nsec.value.trim()
    if (!nsecVal.length) {
      pubKeyError.value = 'Please provide private key first.'
      return
    }

    const isHex = nsecVal.indexOf('nsec') === -1

    try {
      const privKeyHex = isHex ? nsecVal : nip19.decode(nsecVal).data.toString()
      const pubKey = getPublicKey(privKeyHex)
      npub.update(nip19.npubEncode(pubKey))
      pubKeyError.value = ''
    } catch (e) {
      pubKeyError.value = 'Private key is invalid. Please check it and try again.'
      return
    }
  }

  const handleSearchFallback = async () => {
    const searchVal = npub.value.trim()
    let isHexSearch = false

    if (!searchVal.length) {
      notFoundFallbackError.value = 'Public key or event id is required.'
      return
    }

    if (isSHA256Hex(searchVal)) {
      pubHex.value = searchVal
      isHexSearch = true
    } else {
      try {
        let { data, type } = nip19.decode(searchVal)
        if (type !== 'npub' && type !== 'note') {
          notFoundFallbackError.value = 'Public key or event id should be in npub or note format, or hex.'
          return
        }
        isEventSearch.value = type === 'note'
        pubHex.value = data.toString()
      } catch (e) {
        notFoundFallbackError.value = 'Public key or event id is invalid. Please check it and try again.'
        return
      }
    }

    isLoadingFallback.value = true
    userNotesEventsIds.update([])

    // in case of searching for one event, loading this event firstly to get user pubHex
    let notesEvents: EventExtended[] = []
    if (isEventSearch.value || isHexSearch) {
      const eventId = pubHex.value
      notesEvents = await pool.list(fallbackRelays, [{ ids: [eventId] }]) as EventExtended[]
      if (notesEvents.length) {
        pubHex.value = notesEvents[0].pubkey
        isEventSearch.value = true
      }
    }

    const authorMeta = await pool.get(fallbackRelays, { kinds: [0], limit: 1, authors: [pubHex.value] })
    if (!authorMeta) {
      isLoadingFallback.value = false
      notFoundFallbackError.value = 'User was not found on listed relays.'
      return
    }

    currentRelays.value = fallbackRelays

    const authorContacts = await pool.get(fallbackRelays, { kinds: [3], limit: 1, authors: [pubHex.value] })
    
    userEvent.update(authorMeta)
    userDetails.update(JSON.parse(authorMeta.content))
    userDetails.updateFollowingCount(authorContacts?.tags.length || 0)
    
    notFoundFallbackError.value = ''
    isLoadingFallback.value = false
    showNotFoundError.value = false

    isUsingFallbackSearch.update(true)
    isUserHasValidNip05.update(false)

    // routing
    if (isEventSearch.value) {
      router.push({ path: `/event/${searchVal}` })
    } else {
      router.push({ path: `/user/${searchVal}` })
    }
    cachedUrlNpub.update(searchVal)

    showLoadingTextNotes.value = true

    checkAndShowNip05()

    if (!isEventSearch.value) {
      notesEvents = await pool.list(fallbackRelays, [{ kinds: [1], authors: [pubHex.value] }]) as EventExtended[]

      const repliesIds = new Set()
      notesEvents.forEach((event) => {
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) {
          repliesIds.add(event.id)
        }
      })
      notesEvents = notesEvents.filter((event) => !repliesIds.has(event.id))
    }

    notesEvents = injectAuthorToUserNotes(notesEvents, userDetails.value)
    await injectDataToNotes(notesEvents, fallbackRelays, pool as SimplePool)

    userNotesEvents.update(notesEvents)
    showLoadingTextNotes.value = false
  }
  
  const handleLoadUserFollowers = async () => {   
    const isFallback = isUsingFallbackSearch.value
    const relays = isFallback ? fallbackRelays : [currentRelay.value.url]

    const sub = await pool.sub(relays, [{ 
      "#p": [pubHex.value],
      kinds: [3], 
    }])

    userDetails.updateFollowersCount(0)
    sub.on('event', () => {
      userDetails.updateFollowersCount(userDetails.value.followersCount + 1)
    })
  }

  const handleToggleRawData = (eventId: string) => {
    userNotesEvents.toggleRawData(eventId)
  }
</script>

<template>
  <div class="field">
    <label class="field-label" for="user_public_key">
      <strong>Profile's public key or event id</strong>
      <button v-if="nsec.value.length" @click="handleGeneratePublicFromPrivate" class="random-key-btn">Use mine</button>
    </label>
    <div class="field-elements">
      <input @input="handleInputNpub" v-model="npub.value" class="pubkey-input" id="user_public_key" type="text" placeholder="npub, note, hex of pubkey or note id..." />
      <button @click="handleGetUserInfo" class="get-user-btn">
        {{ isAutoConnectOnSearch ? 'Connect & Search' : 'Search' }}
      </button>
    </div>
    <div class="error">
      {{ pubKeyError }}
    </div>
  </div>

  <div class="loading-notice" v-if="showLoadingUser">
    Loading event info...
  </div>

  <UserEvent
    v-if="userEvent.value.id"
    :authorEvent="userEvent.value"
    :author="userDetails.value"
    :isUserProfile="true"
    :event="(userEvent.value as EventExtended)"
    :key="userEvent.value.id"
  >
    <div class="user">
      <div v-if="showImages.value" class="user__avatar-wrapper">
        <img class="user__avatar" :src="userDetails.value.picture">
      </div>
      <div class="user__info">
        <div>
          <div class="user__nickname">
            {{ userDetails.value.nickname || userDetails.value.name }}
          </div>
          <div class="user__name">
            {{ userDetails.value.display_name || '' }}
          </div>
          <div class="user__desc">
            {{ userDetails.value.about || '' }}
          </div>
          <div v-if="isUserHasValidNip05.value" class="user__nip05">
            <a target="_blank" :href="nip05toURL(userDetails.value.nip05)">
              <strong>nip05</strong>: {{ userDetails.value.nip05 }}
            </a>
          </div>
          <div v-if="userDetails.value.followingCount >= 0" class="user__contacts">
            <span class="user__contacts-col user__following-cnt">
              <b>{{ userDetails.value.followingCount }}</b> Following
            </span>
            <span class="user__contacts-col user__followers-cnt">
              <b v-if="userDetails.value.followersCount">
                {{ userDetails.value.followersCount }}
              </b>
              <span v-else class="user__contacts-download-icon">
                <DownloadIcon @click="handleLoadUserFollowers" />
              </span>
              <span class="user__contacts-followers-word">
                Followers
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </UserEvent>

  <div v-if="showLoadingTextNotes">Loading notes...</div>
  <h3 id="user-posts" v-if="userNotesEvents.value.length > 0 && !showLoadingTextNotes">
    <span v-if="isEventSearch">Event info</span>
    <span v-else>User notes</span>
  </h3>

  <template :key="event.id" v-for="(event, i) in userNotesEvents.value">
    <EventView 
      :hasReplyBtn="true" 
      :showReplies="true" 
      :currentRelays="currentRelays" 
      :index="i" 
      @toggleRawData="handleToggleRawData" 
      :event="(event as EventExtended)" 
    />
  </template>

  <Pagination
    v-if="!showLoadingTextNotes && !showLoadingUser" 
    :pagesCount="pagesCount"
    :currentPage="currentPage"
    @showPage="showUserPage"
  />

  <div class="not-found" v-if="showNotFoundError">
    <div class="not-found__desc">
      Data was not found on selected relay.
      Please try to connect to another one or you can try to load info from the list of popular relays:
    </div>
    <div>
      <button @click="handleSearchFallback" class="fallback-search-btn">
        Search in all listed relays
      </button>
      <div :class="['not-found__status', {'error': notFoundFallbackError.length}]">
        {{ notFoundFallbackError }}
        {{ isLoadingFallback ? 'Searching...' : '' }}
      </div>
      <ul>
        <li v-for="relay in fallbackRelays">
          {{ relay }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
  .user {
    display: flex;
    margin: 18px 0;
    flex-direction: column;
  }

  @media (min-width: 576px) {
    .user {
      flex-direction: row;
    }
  }

  .user__avatar-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
    justify-content: center;
  }

  @media (min-width: 576px) {
    .user__avatar-wrapper {
      margin-right: 15px;
      margin-bottom: 0;
      justify-content: left;
    }
  }

  .user__avatar {
    width: 120px;
    height: 120px;
  }

  @media (min-width: 576px) {
    .user__avatar {
      width: 150px;
      height: 150px;
    }
  }

  .user__info {
    display: flex;
    align-items: center;
    text-align: center;
    justify-content: center;
    word-break: break-all;
  }

  @media (min-width: 576px) {
    .user__info {
      text-align: left;
      justify-content: left;
    }
  }
  .user__nickname {
    font-weight: bold;
    font-size: 1.3rem;
  }
  .user__name {
    font-size: 1.05rem;
  }

  .user__desc {
    margin-top: 7px;
    font-style: italic;
  }

  .user__nip05 {
    display: inline-block;
    border: 1px solid #bbb;
    padding: 1px 5px;
    margin: 5px 0;
  }

  .user__contacts {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 10px;
  }

  @media (min-width: 576px) {
    .user__contacts {
      justify-content: left;
    }
  }

  .user__contacts-col {
    word-break: break-word;
  }

  .user__followers-cnt {
    display: flex;
  }

  .user__contacts-download-icon {
    cursor: pointer;
    margin-top: 1px;
  }

  .user__contacts-followers-word {
    margin-left: 6px;
  }

  .get-user-btn {
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    margin-top: 5px;
  }

  @media (min-width: 768px) {
    .get-user-btn {
      margin-top: 0px;
      width: auto;
    }
  }

  .pubkey-input {
    font-size: 16px;
    padding: 1px 3px;
    flex-grow: 1;
  }

  @media (min-width: 768px) {
    .pubkey-input {
      font-size: 15px;
      margin-right: 5px;
    }
  }

  .not-found {
    margin-top: 25px;
    margin-bottom: 5px;
  }

  .loading-notice {
    margin-top: 20px;
  }

  /* common styles, to refactor */

  .field {
    margin-bottom: 15px;
  }
  
  .random-key-btn {
    margin-left: 7px;
    font-size: 14px;
    cursor: pointer;
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

  button {
    cursor: pointer;
  }

  .error {
    color:red;
    font-size: 16px;
    margin-top: 5px;
  }

  .not-found__desc {
    margin-bottom: 10px;
  }
  .not-found__status {
    margin-top: 5px;
  }

  .fallback-search-btn {
    font-size: 14px;
  }
</style>