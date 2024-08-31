<script setup lang="ts">
  import { onMounted, ref, computed, watch, onUnmounted } from 'vue'
  import { nip19, nip05, nip10, SimplePool, type Event } from 'nostr-tools'
  import { useRouter, useRoute } from 'vue-router'

  import { fallbackRelays, DEFAULT_EVENTS_COUNT } from '@/app'
  import {
    isSHA256Hex,
    loadAndInjectDataToPosts,
    getEventWithAuthorById,
    isReply,
    dedupByPubkeyAndSortEvents,
    getDisplayUsername,
    getNip19FromSearch,
  } from '@/utils'
  import type { Author, EventExtended } from '@/types'

  import { gettingUserInfoId } from '@/store'
  import { useUserNotes } from '@/stores/UserNotes'
  import { useNpub } from '@/stores/Npub'
  import { useUser } from '@/stores/User'
  import { useImages } from '@/stores/Images'
  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { usePool } from '@/stores/Pool'
  import { useMetasCache } from '@/stores/MetasCache'
  import { useOwnProfile } from '@/stores/OwnProfile'

  import UserEvent from '@/components/UserEvent.vue'
  import ParentEventView from '@/components/ParentEventView.vue'
  import Pagination from '@/components/Pagination.vue'
  import FollowBtn from '@/components/FollowBtn.vue'
  import DownloadIcon from '@/icons/DownloadIcon.vue'

  const poolStore = usePool()
  const pool = poolStore.pool

  const npubStore = useNpub()
  const userNotesStore = useUserNotes()
  const userStore = useUser()
  const imagesStore = useImages()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const metasCacheStore = useMetasCache()
  const ownProfileStore = useOwnProfile()

  const userEvent = ref(<Event>{})
  const userDetails = ref(<Author>{})
  const isUserHasValidNip05 = ref(false)
  const pubKeyError = ref('')
  const showNotFoundError = ref(false)
  const pubHex = ref('')
  const showLoadingUser = ref(false)
  const notFoundFallbackError = ref('')
  const isLoadingFallback = ref(false)
  const showLoadingTextNotes = ref(false)
  const isAutoConnectOnSearch = ref(false)
  const isOffline = ref(false)

  // subscribe btn
  const isFollowed = ref(false)
  const showFollowBtn = ref(false)
  const userActionError = ref('')

  // event search
  const isEventSearch = ref(false)
  const isRootEventSearch = ref(true)

  const currentPage = ref(1)
  const pagesCount = computed(() =>
    Math.ceil(userNotesStore.allNotesIds.length / DEFAULT_EVENTS_COUNT),
  )
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
      isOffline.value = true
      handleGetUserInfo()
      return
    }

    // if routing to user by link or from search
    if (userStore.isRoutingUser && npubStore.npubInput.length) {
      npubStore.updateCachedUrl(npubStore.npubInput)
      userStore.updateRoutingStatus(false)
      handleGetUserInfo()
      return
    }

    // if routing to user from login but search was cleared by user before leaving the user page
    // or used back/forward button in the browser
    // in that case we restore search value from the url
    if (!npubStore.npubInput.length && route.params?.id?.length) {
      npubStore.updateNpubInput(route.params.id as string)
      npubStore.updateCachedUrl(route.params.id as string)
      userStore.updateRoutingStatus(false)
      handleGetUserInfo()
      return
    }
  })

  onUnmounted(() => {
    flushData()
    // clear search input when user leaves the page if search was not user
    if (!userStore.isSearchUsed) {
      npubStore.updateNpubInput('')
    }
    userStore.updateSearchStatus(false)
  })

  watch(
    () => route.params,
    () => {
      if (userStore.isRoutingUser) {
        npubStore.updateCachedUrl(npubStore.npubInput)
        userStore.updateRoutingStatus(false)
        handleGetUserInfo()
      }
    },
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
    },
  )

  watch(
    () => relayStore.isConnectingToReadWriteRelays,
    (value) => {
      // run only when reconnect by changing secret key
      if (value && !isAutoConnectOnSearch.value) {
        flushData()
      }
    },
  )
  watch(
    () => relayStore.isConnectedToReadWriteRelays,
    (value) => {
      // run only when reconnect by changing secret key
      // user relays are ready to use on this stage
      if (value && !isAutoConnectOnSearch.value) {
        handleGetUserInfo()
      }
    },
  )

  // TODO: remove this, because fixed after flushData in onUnmounted
  // fix for case when user notes are shown but user not
  // onBeforeMount(() => {
  //   if (userNotesStore.notes.length) {
  //     handleGetUserInfo()
  //   }
  // })

  const showUserPage = async (page: number) => {
    const relays = currentReadRelays.value
    if (!relays.length) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const idsToShow = userNotesStore.allNotesIds.slice(start, end)
    const posts = (await pool.querySync(relays, { ids: idsToShow })) as EventExtended[]

    await loadAndInjectDataToRootPosts(posts, relays)

    userNotesStore.updateNotes(posts as EventExtended[])
    currentPage.value = page
  }

  const flushData = () => {
    userEvent.value = {} as Event
    userDetails.value = {} as Author
    userNotesStore.updateNotes([] as EventExtended[])
    userNotesStore.updateIds([])
    isFollowed.value = false
    showFollowBtn.value = false
    userActionError.value = ''
  }

  const handleGetUserInfo = async (isFallbackSearch: boolean = false) => {
    // start tracking that user is loading
    // increase tracker to stop previous function calls if they are still in process
    gettingUserInfoId.update(gettingUserInfoId.value + 1)
    const currentOperationId = gettingUserInfoId.value

    const searchVal = npubStore.npubInput
    let isHexSearch = false
    isEventSearch.value = false

    if (isSHA256Hex(searchVal)) {
      pubHex.value = searchVal
      isHexSearch = true
    } else {
      try {
        const { data, type } = getNip19FromSearch(searchVal)
        isEventSearch.value = type === 'note'
        pubHex.value = data.toString()
      } catch (e: any) {
        npubStore.setError(e.message)
        return
      }
    }

    flushData()
    if (isFallbackSearch) {
      isLoadingFallback.value = true
    }

    // if (isAutoConnectOnSearch.value) {
    //   await props.handleRelayConnect()
    // }
    if (currentOperationId !== gettingUserInfoId.value) return

    const relays = isFallbackSearch
      ? fallbackRelays
      : relayStore.connectedUserReadWriteUrlsWithSelectedRelay

    if (!relays.length) {
      // pubKeyError.value = isAutoConnectOnSearch.value
      //   ? 'Connection error, try to connect again or try to choose other relay.'
      //   : 'Please connect to relay first.'
      isOffline.value = true
      return
    }
    // isAutoConnectOnSearch.value = false

    if (npubStore.error.length) {
      npubStore.setError('')
    }
    if (!isFallbackSearch) {
      showLoadingUser.value = true
    }

    // in case of searching for one event, loading this event firstly to get user pubHex
    let notesEvents: EventExtended[] = []
    if (isEventSearch.value || isHexSearch) {
      const eventId = pubHex.value
      notesEvents = (await pool.querySync(relays, {
        kinds: [1],
        ids: [eventId],
      })) as EventExtended[]
      if (currentOperationId !== gettingUserInfoId.value) return

      if (notesEvents.length) {
        const event = notesEvents[0]
        pubHex.value = event.pubkey
        isEventSearch.value = event.kind === 1
      }
    }

    const authorMeta = await pool.get(relays, { kinds: [0], limit: 1, authors: [pubHex.value] })
    if (currentOperationId !== gettingUserInfoId.value) return
    if (!authorMeta) {
      if (isFallbackSearch) {
        isLoadingFallback.value = false
        notFoundFallbackError.value = 'User or event was not found on listed relays.'
      } else {
        showLoadingUser.value = false
        showNotFoundError.value = true
      }
      return
    }

    // update cache which will be used in loadAndInjectDataToPosts
    metasCacheStore.addMeta(authorMeta)
    currentReadRelays.value = relays

    const contactsPubkeys = [pubHex.value]
    const ownPubkey = nsecStore.getPubkey()
    if (ownPubkey.length && ownPubkey !== pubHex.value) {
      contactsPubkeys.push(ownPubkey)
    }

    let contacts = await pool.querySync(relays, { kinds: [3], authors: contactsPubkeys })
    if (currentOperationId !== gettingUserInfoId.value) return

    contacts = dedupByPubkeyAndSortEvents(contacts)
    const userContacts = contacts.find((event) => event.pubkey === pubHex.value)
    // if searching for own profile, don't show follow btn
    if (ownPubkey !== pubHex.value) {
      const ownContacts = contacts.find((event) => event.pubkey === ownPubkey)
      if (ownContacts) {
        isFollowed.value =
          ownContacts.tags.some((tag) => tag[0] === 'p' && tag[1] === pubHex.value) || false
        ownProfileStore.updateContactsEvent(ownContacts)
      }
      showFollowBtn.value = true
    }

    userEvent.value = authorMeta
    userDetails.value = JSON.parse(authorMeta.content)
    userDetails.value.followingCount = userContacts?.tags.length || 0

    if (isFallbackSearch) {
      notFoundFallbackError.value = ''
      isLoadingFallback.value = false
      isOffline.value = false
    } else {
      showLoadingUser.value = false
    }

    isUserHasValidNip05.value = false
    showNotFoundError.value = false

    routeSearch(searchVal, isEventSearch.value)

    showLoadingTextNotes.value = true
    checkAndShowNip05(currentOperationId)

    if (!isEventSearch.value) {
      try {
        const notes = await loadUserNotes(relays, currentOperationId)
        if (currentOperationId !== gettingUserInfoId.value) return
        notesEvents = notes.viewNotes
        // pagination
        userNotesStore.updateIds(notes.allNotes.map((event) => event.id))
        currentPage.value = 1
      } catch (e) {
        return
      }
    }

    // event was loaded before in case of searching for one event
    if (isEventSearch.value) {
      const event = notesEvents[0]
      await injectDataToUserEvent(notesEvents[0], relays)
      if (currentOperationId !== gettingUserInfoId.value) return
      userNotesStore.updateIds([event.id])
    }

    userNotesStore.updateNotes(notesEvents)
    showLoadingTextNotes.value = false
  }

  const routeSearch = (searchVal: string, isEventSearch: boolean) => {
    if (isEventSearch) {
      router.push({ path: `/event/${searchVal}` })
    } else {
      router.push({ path: `/user/${searchVal}` })
    }
    npubStore.updateCachedUrl(searchVal)
  }

  const loadUserNotes = async (relays: string[], currentOperationId: number = 0) => {
    let notes = (await pool.querySync(relays, {
      kinds: [1],
      authors: [pubHex.value],
    })) as EventExtended[]
    if (currentOperationId && currentOperationId !== gettingUserInfoId.value) {
      throw new Error('Operation was canceled')
    }

    notes = notes.filter((event) => !isReply(event))
    notes = notes.sort((a, b) => b.created_at - a.created_at)

    const allNotes = [...notes]
    const viewNotes = notes.slice(0, DEFAULT_EVENTS_COUNT)
    await loadAndInjectDataToRootPosts(viewNotes, relays)

    return { viewNotes, allNotes }
  }

  const injectDataToUserEvent = async (event: EventExtended, relays: string[]) => {
    const nip10Data = nip10.parse(event)
    const nip10ParentEvent = nip10Data.reply || nip10Data.root
    if (nip10ParentEvent) {
      isRootEventSearch.value = false
      const parentEvent = await getEventWithAuthorById(
        nip10ParentEvent.id,
        relays,
        pool as SimplePool,
      )
      await loadAndInjectDataToReplyPosts([event], parentEvent as EventExtended, relays)
    } else {
      await loadAndInjectDataToRootPosts([event], relays)
    }
  }

  const loadAndInjectDataToRootPosts = async (events: EventExtended[], relays: string[]) => {
    const isRootPosts = true
    const parentEvent = null
    const userRelaysMap = {}
    await loadAndInjectDataToPosts(
      events,
      parentEvent,
      userRelaysMap,
      relays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
    )
  }

  const loadAndInjectDataToReplyPosts = async (
    events: EventExtended[],
    parentEvent: EventExtended | null,
    relays: string[],
  ) => {
    const isRootPosts = false
    const userRelaysMap = {}
    await loadAndInjectDataToPosts(
      events,
      parentEvent,
      userRelaysMap,
      relays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
    )
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

  const handleSearchFallback = () => {
    const isFallbackSearch = true
    handleGetUserInfo(isFallbackSearch)
  }

  const handleLoadUserFollowers = async () => {
    const usedPubkeys = new Set<string>()
    userDetails.value.followersCount = 0
    const sub = pool.subscribeMany(
      currentReadRelays.value,
      [{ '#p': [pubHex.value], kinds: [3] }],
      {
        onevent(event: Event) {
          // prevent duplicates, because relays may store few events with subscriptions from the same user
          if (usedPubkeys.has(event.pubkey)) return
          usedPubkeys.add(event.pubkey)
          userDetails.value.followersCount = userDetails.value.followersCount + 1
        },
        oneose() {
          sub.close()
        },
      },
    )
  }

  const handleToggleRawData = (eventId: string) => {
    userNotesStore.toggleRawData(eventId)
  }

  const toggleFollow = () => {
    isFollowed.value = !isFollowed.value
  }

  const handleUserActionError = (error: string) => {
    userActionError.value = error
    setTimeout(() => {
      userActionError.value = ''
    }, 10000)
  }

  const showDisplayName = (author: Author) => {
    const { username, name, display_name } = author
    // if username or name is not presented, we use display_name as a main name,
    // so we just return empty string in this case
    return username?.length || name?.length ? display_name || '' : ''
  }
</script>

<template>
  <div class="loading-notice" v-if="showLoadingUser">Loading profile info...</div>

  <UserEvent
    v-if="userEvent.id"
    :author="userDetails"
    :event="(userEvent as EventExtended)"
    :key="userEvent.id"
  >
    <div class="user">
      <div v-if="imagesStore.showImages" class="user__avatar-wrapper">
        <img alt="user's avatar" class="user__avatar" :src="userDetails.picture" />
      </div>
      <div class="user__info">
        <div class="user__info__content">
          <div class="user__nickname-wrapper">
            <span class="user__nickname">
              {{ getDisplayUsername(userDetails, pubHex) }}
            </span>
            <FollowBtn
              v-if="showFollowBtn"
              :pubkeyToFollow="pubHex"
              :isFollowed="isFollowed"
              @toggleFollow="toggleFollow"
              @handleFollowError="handleUserActionError"
            />
          </div>
          <div class="user-action-error warning">
            {{ userActionError }}
          </div>
          <div class="user__name">
            {{ showDisplayName(userDetails) }}
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
              <span class="user__contacts-followers-word"> Followers </span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div class="user__desc">
      {{ userDetails.about || '' }}
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

  <div class="not-found" v-if="showNotFoundError || isOffline">
    <div class="not-found__desc">
      <span v-if="showNotFoundError">
        Data was not found on selected relay. Please try to connect to another one or you can try to
        load info from the list of popular relays.
      </span>
      <span v-if="isOffline">Please connect first or search in the list of popular relays.</span>
    </div>
    <div>
      <button @click="handleSearchFallback" class="fallback-search-btn">
        Search in the listed relays
      </button>
      <div :class="['not-found__status', { warning: notFoundFallbackError.length }]">
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
    min-width: 150px;
    height: 150px;
    overflow: hidden;
  }

  @media (min-width: 576px) {
    .user__avatar-wrapper {
      margin-right: 15px;
      margin-bottom: 0;
      justify-content: left;
    }
  }

  .user__avatar {
    width: 150px;
  }

  .user__info {
    display: flex;
    align-items: center;
    text-align: center;
    justify-content: center;
    word-break: break-word;
    width: 100%;
  }

  @media (min-width: 576px) {
    .user__info {
      text-align: left;
      justify-content: left;
    }
  }

  .user__info__content {
    width: 100%;
  }

  .user__nickname-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-weight: bold;
    font-size: 1.3rem;
    margin-bottom: 5px;
  }

  .user__nickname {
    flex: 1;
    margin-right: 5px;
    text-align: left;
  }

  .user__name {
    font-size: 1.05rem;
  }

  .user__desc {
    margin-top: 7px;
    font-style: italic;
    word-wrap: break-word;
  }

  .user__nip05 {
    display: inline-block;
    padding: 1px 0;
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
    color: #ff4040;
    font-size: 16px;
    margin-top: 5px;
  }

  .warning {
    color: #ffda6a;
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
    background: transparent;
    color: #0092bf;
    border: 1px solid #0092bf;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .fallback-search-btn:hover {
    background: #0092bf;
    color: white;
  }

  .user-action-error {
    word-break: break-word;
    margin-top: -5px;
    text-align: center;
  }

  @media (min-width: 576px) {
    .user-action-error {
      text-align: right;
    }
  }
</style>
