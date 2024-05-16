<script setup lang="ts">
  import { onMounted, ref, onBeforeMount, computed, watch } from 'vue'
  import {
    nip19,
    nip05,
    nip10,
    SimplePool,
    type Event,
  } from 'nostr-tools'
  // @ts-ignore
  import { useRouter, useRoute } from 'vue-router'

  import { fallbackRelays, DEFAULT_EVENTS_COUNT } from './../app'
  import { 
    isSHA256Hex,
    injectDataToRootNotes,
    injectDataToReplyNotes
  } from './../utils'
  import type { Author, EventExtended } from './../types'

  import { gettingUserInfoId } from './../store'
  import { useUserNotes } from '@/stores/UserNotes'
  import { useNpub } from '@/stores/Npub'
  import { useUser } from '@/stores/User'
  import { useImages } from '@/stores/Images'
  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { usePool } from '@/stores/Pool'

  import UserEvent from './UserEvent.vue'
  import DownloadIcon from './../icons/DownloadIcon.vue'
  import ParentEventView from './ParentEventView.vue'
  import Pagination from "./Pagination.vue";

  const poolStore = usePool()
  const pool = poolStore.pool

  const npubStore = useNpub()
  const userNotesStore = useUserNotes()
  const userStore = useUser()
  const imagesStore = useImages()
  const nsecStore = useNsec()
  const relayStore = useRelay()

  const props = defineProps<{
    handleRelayConnect: Function
  }>()

  const userEvent = ref(<Event>{})
  const userDetails = ref(<Author>{})
  const isUserHasValidNip05 = ref(false)
  const isUsingFallbackSearch = ref(false)
  const pubKeyError = ref('')
  const showNotFoundError = ref(false)
  const pubHex = ref('')
  const showLoadingUser = ref(false)
  const notFoundFallbackError = ref('')
  const isLoadingFallback = ref(false)
  const showLoadingTextNotes = ref(false)
  const isAutoConnectOnSearch = ref(false)

  // event search
  const isEventSearch = ref(false)
  const isRootEventSearch = ref(true)

  const currentPage = ref(1);
  const pagesCount = computed(() => Math.ceil(userNotesStore.allNotesIds.length / DEFAULT_EVENTS_COUNT))
  const router = useRouter()
  const route = useRoute()
  
  const nip05toURL = (identifier: string) => {
    const [name, domain] = identifier.split('@')
    return `https://${domain}/.well-known/nostr.json?name=${name}`
  }

  const currentReadRelays = ref<string[]>([])

  onMounted(() => {
    // first mount when npub presented in url, run only once 
    if (route.params?.id?.length && !relayStore.currentRelay.connected) {
      npubStore.updateNpubInput(route.params.id as string)
      npubStore.updateCachedUrl(route.params.id as string)
      if (!relayStore.currentRelay.connected) {
        isAutoConnectOnSearch.value = true
      }
      return
    }

    if (userStore.isRoutingUser && npubStore.npubInput.length) {
      npubStore.updateCachedUrl(npubStore.npubInput)
      userStore.updateRoutingStatus(false)
      handleGetUserInfo()
      return
    }
  })

  watch(
    () => route.params,
    () => {
      if (userStore.isRoutingUser) {
        npubStore.updateCachedUrl(npubStore.npubInput)
        userStore.updateRoutingStatus(false)
        handleGetUserInfo()
      }
    }
  )

  /* 
    Redirect.
    This is for case when pasing new url to the browser search field and type enter.
    In the case application is not being recreated by scratch, 
    so we handle updating of npub search field and clearing previous data by our own. 
  */
  watch(
    () => route.redirectedFrom,
    () => {
      npubStore.updateNpubInput(route.params.id as string)
      npubStore.updateCachedUrl(route.params.id as string)
      flushData()
    }
  )

  onBeforeMount(() => {
    if (userNotesStore.notes.length) {
      handleGetUserInfo()
    }
  })

  const handleInputNpub = () => {
    notFoundFallbackError.value = ''
    showNotFoundError.value = false
  }

  const showUserPage = async (page: number) => {
    const relays = relayStore.connectedUserReadRelayUrlsWithSelectedRelay
    if (!relays.length) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const idsToShow = userNotesStore.allNotesIds.slice(start, end) 
    const postsEvents = await pool.querySync(relays, { ids: idsToShow }) as EventExtended[]

    let posts = injectAuthorToUserNotes(postsEvents, userDetails.value)
    await injectDataToRootNotes(posts, relays, pool as SimplePool)

    userNotesStore.updateNotes(posts as EventExtended[])
    currentPage.value = page
  }

  const flushData = () => {
    userEvent.value = {} as Event
    userDetails.value = {} as Author
    userNotesStore.updateNotes([] as EventExtended[])
    userNotesStore.updateIds([])
  }

  const handleGetUserInfo = async () => {
    // start tracking that user is loading
    // increase tracker to stop previous function calls if they are still in process
    gettingUserInfoId.update(gettingUserInfoId.value + 1)
    const currentOperationId = gettingUserInfoId.value

    const searchVal = npubStore.npubInput.trim()
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

    if (isAutoConnectOnSearch.value) {
      await props.handleRelayConnect()
    }
    const relays = relayStore.connectedUserReadRelayUrlsWithSelectedRelay

    if (currentOperationId !== gettingUserInfoId.value) return
    
    if (!relays.length) {
      pubKeyError.value = isAutoConnectOnSearch.value
        ? 'Connection error, try to connect again or try to choose other relay.' 
        : 'Please connect to relay first.'
      return;
    }
    isAutoConnectOnSearch.value = false

    flushData()
    isUsingFallbackSearch.value = false

    pubKeyError.value = ''
    showLoadingUser.value = true

    // in case of searching for one event, loading this event firstly to get user pubHex
    let notesEvents: EventExtended[] = []
    if (isEventSearch.value || isHexSearch) {
      const eventId = pubHex.value

      notesEvents = await pool.querySync(relays, { ids: [eventId] }) as EventExtended[]
      if (currentOperationId !== gettingUserInfoId.value) return

      if (notesEvents.length) {
        userNotesStore.updateIds(notesEvents.map((event) => event.id))
        pubHex.value = notesEvents[0].pubkey
        isEventSearch.value = true
      }
    }

    const authorMeta = await pool.get(relays, { kinds: [0], limit: 1, authors: [pubHex.value] })

    if (currentOperationId !== gettingUserInfoId.value) return
    if (!authorMeta) {
      showLoadingUser.value = false
      showNotFoundError.value = true
      return
    }

    currentReadRelays.value = relays
    
    const authorContacts = await pool.get(relays, { kinds: [3], limit: 1, authors: [pubHex.value] })
    if (currentOperationId !== gettingUserInfoId.value) return
    
    userEvent.value = authorMeta
    userDetails.value = JSON.parse(authorMeta.content)
    userDetails.value.followingCount = authorContacts?.tags.length || 0

    isUserHasValidNip05.value = false
    showLoadingUser.value = false
    showNotFoundError.value = false

    // routing
    if (isEventSearch.value) {
      router.push({ path: `/event/${searchVal}` })
    } else {
      router.push({ path: `/user/${searchVal}` })
    }
    npubStore.updateCachedUrl(searchVal)

    showLoadingTextNotes.value = true

    checkAndShowNip05(currentOperationId)

    // event was loaded before in case of searching for one event
    // filtering for replies only when searching for user, otherwise we show the post even if it is a reply
    if (!isEventSearch.value) {
      notesEvents = await pool.querySync(relays, { kinds: [1], authors: [pubHex.value] }) as EventExtended[]
      if (currentOperationId !== gettingUserInfoId.value) return

      const repliesIds = new Set()
      notesEvents.forEach((event) => {
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) {
          repliesIds.add(event.id)
        }
      })
      notesEvents = notesEvents.filter((event) => !repliesIds.has(event.id))
      userNotesStore.updateIds(notesEvents.map((event) => event.id))

      const limit = DEFAULT_EVENTS_COUNT
      currentPage.value = 1

      notesEvents = notesEvents.slice(0, limit)
    }

    notesEvents = injectAuthorToUserNotes(notesEvents, userDetails.value)
    
    if (isEventSearch.value) {
      const event = notesEvents[0]
      const nip10Data = nip10.parse(event)
      const nip10ParentEvent = nip10Data.reply || nip10Data.root 
      if (nip10ParentEvent) {
        isRootEventSearch.value = false

        let parentEvent = await pool.get(currentReadRelays.value, { kinds: [1], ids: [nip10ParentEvent.id] }) as EventExtended
        if (parentEvent) {
          const authorMeta = await pool.get(currentReadRelays.value, { kinds: [0], authors: [parentEvent.pubkey] })
          if (authorMeta) {
            parentEvent.author = JSON.parse(authorMeta.content)
          }
        }
        // our event passed as a reply note here in a second parametr, so parent event data will be injected to it too
        await injectDataToReplyNotes(parentEvent as EventExtended, notesEvents as EventExtended[], currentReadRelays.value, pool as SimplePool)
      } else {
        await injectDataToRootNotes(notesEvents, relays, pool as SimplePool)
      }
    } else {
      await injectDataToRootNotes(notesEvents, relays, pool as SimplePool)
    }

    if (currentOperationId !== gettingUserInfoId.value) return

    userNotesStore.updateNotes(notesEvents as EventExtended[])
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
      isUserHasValidNip05.value = validNip
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

  const handleGeneratePublicFromPrivate = () => {
    const nsecVal = nsecStore.nsec.trim()
    if (!nsecVal.length) {
      pubKeyError.value = 'Please provide private key first.'
      return
    }

    try {
      const pubkey = nsecStore.getPubkey()
      if (!pubkey.length) {
        throw new Error()
      }

      npubStore.updateNpubInput(nip19.npubEncode(pubkey))
      pubKeyError.value = ''
    } catch (e) {
      pubKeyError.value = 'Private key is invalid. Please check it and try again.'
      return
    }
  }

  const handleSearchFallback = async () => {
    const searchVal = npubStore.npubInput.trim()
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
    userNotesStore.updateIds([])

    // in case of searching for one event, loading this event firstly to get user pubHex
    let notesEvents: EventExtended[] = []
    if (isEventSearch.value || isHexSearch) {
      const eventId = pubHex.value
      notesEvents = await pool.querySync(fallbackRelays, { ids: [eventId] }) as EventExtended[]
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

    currentReadRelays.value = fallbackRelays

    const authorContacts = await pool.get(fallbackRelays, { kinds: [3], limit: 1, authors: [pubHex.value] })
    
    userEvent.value = authorMeta
    userDetails.value = JSON.parse(authorMeta.content)
    userDetails.value.followingCount = authorContacts?.tags.length || 0
    
    notFoundFallbackError.value = ''
    isLoadingFallback.value = false
    showNotFoundError.value = false

    isUsingFallbackSearch.value = true
    isUserHasValidNip05.value = false

    // routing
    if (isEventSearch.value) {
      router.push({ path: `/event/${searchVal}` })
    } else {
      router.push({ path: `/user/${searchVal}` })
    }
    npubStore.updateCachedUrl(searchVal)

    showLoadingTextNotes.value = true

    checkAndShowNip05()

    if (!isEventSearch.value) {
      notesEvents = await pool.querySync(fallbackRelays, { kinds: [1], authors: [pubHex.value] }) as EventExtended[]

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
    await injectDataToRootNotes(notesEvents, fallbackRelays, pool as SimplePool)

    userNotesStore.updateNotes(notesEvents)
    showLoadingTextNotes.value = false
  }
  
  const handleLoadUserFollowers = async () => {   
    userDetails.value.followersCount = 0
    const sub = pool.subscribeMany(
      currentReadRelays.value, 
      [{ "#p": [pubHex.value], kinds: [3] }], 
      {
        onevent(event: Event) {
          userDetails.value.followersCount = userDetails.value.followersCount + 1
        },
        oneose() {
          sub.close()
        }
      }
    )
  }

  const handleToggleRawData = (eventId: string) => {
    userNotesStore.toggleRawData(eventId)
  }
</script>

<template>
  <div class="field">
    <label class="field-label" for="user_public_key">
      <strong>Profile's public key or event id</strong>
      <button v-if="nsecStore.nsec.length" @click="handleGeneratePublicFromPrivate" class="random-key-btn">Use mine</button>
    </label>
    <div class="field-elements">
      <input @input="handleInputNpub" v-model="npubStore.npubInput" class="pubkey-input" id="user_public_key" type="text" placeholder="npub, note, hex of pubkey or note id..." />
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
    v-if="userEvent.id"
    :author="userDetails"
    :event="(userEvent as EventExtended)"
    :key="userEvent.id"
  >
    <div class="user">
      <div v-if="imagesStore.showImages" class="user__avatar-wrapper">
        <img class="user__avatar" :src="userDetails.picture">
      </div>
      <div class="user__info">
        <div>
          <div class="user__nickname">
            {{ userDetails.username || userDetails.name }}
          </div>
          <div class="user__name">
            {{ userDetails.display_name || '' }}
          </div>
          <div class="user__desc">
            {{ userDetails.about || '' }}
          </div>
          <div v-if="isUserHasValidNip05" class="user__nip05">
            <a target="_blank" :href="nip05toURL(userDetails.nip05)">
              <strong>nip05</strong>: {{ userDetails.nip05 }}
            </a>
          </div>
          <div v-if="userDetails.followingCount >= 0" class="user__contacts">
            <span class="user__contacts-col user__following-cnt">
              <b>{{ userDetails.followingCount }}</b> Following
            </span>
            <span class="user__contacts-col user__followers-cnt">
              <b v-if="userDetails.followersCount">
                {{ userDetails.followersCount }}
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
  <h3 id="user-posts" v-if="userNotesStore.notes.length > 0 && !showLoadingTextNotes">
    <span v-if="isEventSearch">Event info</span>
    <span v-else>User notes</span>
  </h3>

  <template :key="event.id" v-for="(event, i) in userNotesStore.notes">
    <ParentEventView 
      :hasReplyBtn="true" 
      :showReplies="true" 
      :showRootReplies="isRootEventSearch"
      :currentReadRelays="currentReadRelays"
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
    margin: 10px 0;
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