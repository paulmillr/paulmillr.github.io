import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { nip10, type Event } from 'nostr-tools'
import type { EventExtended, ShortPubkeyEvent } from '@/types'

export const useFeed = defineStore('feed', () => {
  const events = ref<EventExtended[]>([]) // which are shown on the page in feed (by default 20)
  const showNewEventsBadge = ref(false)
  const newEventsBadgeImageUrls = ref<string[]>([])
  const newEventsToShow = ref<ShortPubkeyEvent[]>([])
  const paginationEventsIds = ref<string[]>([])
  const messageToBroadcast = ref('')
  const signedJson = ref('')

  // used to update new events badge
  const updateInterval = ref(0)
  const timeToGetNewPosts = ref(0)

  const selectedFeedSource = ref('network')
  const isLoadingFeedSource = ref(false)
  const isLoadingNewEvents = ref(false)
  const isLoadingMore = ref(false)

  // used for initial load after login
  const isMountAfterLogin = ref(false)
  // used after change in settings
  const toRemountFeed = ref(false)

  const eventsId = computed(() => events.value.map((e) => e.id))
  const newEventsToShowIds = computed(() => newEventsToShow.value.map((e) => e.id))
  const newEventsBadgeCount = computed(() => newEventsToShow.value.length)
  const isFollowsSource = computed(() => selectedFeedSource.value === 'follows')
  const isNetworkSource = computed(() => selectedFeedSource.value === 'network')

  function clear() {
    sourceSelectDataRefresh()
    selectedFeedSource.value = 'network'
    isLoadingFeedSource.value = false
    isLoadingNewEvents.value = false
    isLoadingMore.value = false
  }

  function sourceSelectDataRefresh() {
    clearUpdateInterval()
    events.value = []
    showNewEventsBadge.value = false
    newEventsBadgeImageUrls.value = []
    newEventsToShow.value = []
    paginationEventsIds.value = []
  }

  function updateEvents(value: EventExtended[]) {
    events.value = value
  }

  function pushToEvents(value: EventExtended) {
    events.value.push(value)
  }

  function toggleEventRawData(id: string) {
    const event = events.value.find((e) => e.id === id)
    if (event) {
      event.showRawData = !event.showRawData
    }
  }

  function setShowNewEventsBadge(value: boolean) {
    showNewEventsBadge.value = value
  }

  function setNewEventsBadgeImageUrls(value: string[]) {
    newEventsBadgeImageUrls.value = value
  }

  function updateNewEventsToShow(value: ShortPubkeyEvent[]) {
    newEventsToShow.value = value
  }

  function pushToNewEventsToShow(value: ShortPubkeyEvent) {
    newEventsToShow.value.push(value)
  }

  function updatePaginationEventsIds(value: string[]) {
    paginationEventsIds.value = value
  }

  function pushToPaginationEventsIds(value: string) {
    paginationEventsIds.value.push(value)
  }

  function updateMessageToBroadcast(value: string) {
    messageToBroadcast.value = value
  }

  function updateSignedJson(value: string) {
    signedJson.value = value
  }

  function setLoadingFeedSourceStatus(value: boolean) {
    isLoadingFeedSource.value = value
  }

  function setLoadingMoreStatus(value: boolean) {
    isLoadingMore.value = value
  }

  function setLoadingNewEventsStatus(value: boolean) {
    isLoadingNewEvents.value = value
  }

  function setSelectedFeedSource(value: string) {
    selectedFeedSource.value = value === 'follows' ? value : 'network'
  }

  function setMountAfterLogin(value: boolean) {
    isMountAfterLogin.value = value
  }

  function clearUpdateInterval() {
    clearInterval(updateInterval.value)
    updateInterval.value = 0
  }

  function setToRemountFeed(value: boolean) {
    toRemountFeed.value = value
  }

  function refreshPostsFetchTime() {
    timeToGetNewPosts.value = Math.floor(Date.now() / 1000)
  }

  function filterAndUpdateNewEventsToShow(events: Event[]) {
    const filteredEvents: ShortPubkeyEvent[] = []
    events
      .sort((a, b) => a.created_at - b.created_at)
      .forEach((e) => {
        if (eventsId.value.includes(e.id)) return
        if (newEventsToShowIds.value.includes(e.id)) return
        if (paginationEventsIds.value.includes(e.id)) return

        const nip10Data = nip10.parse(e)
        if (nip10Data.reply || nip10Data.root) return // filter non root events

        filteredEvents.push({
          id: e.id,
          pubkey: e.pubkey,
          created_at: e.created_at,
        })
      })
    newEventsToShow.value = [...newEventsToShow.value, ...filteredEvents]
  }

  return {
    events,
    updateEvents,
    toggleEventRawData,
    showNewEventsBadge,
    setShowNewEventsBadge,
    newEventsBadgeImageUrls,
    setNewEventsBadgeImageUrls,
    newEventsBadgeCount,
    newEventsToShow,
    updateNewEventsToShow,
    pushToNewEventsToShow,
    paginationEventsIds,
    updatePaginationEventsIds,
    pushToPaginationEventsIds,
    messageToBroadcast,
    updateMessageToBroadcast,
    signedJson,
    updateSignedJson,
    selectedFeedSource,
    setSelectedFeedSource,
    isFollowsSource,
    isNetworkSource,
    isLoadingFeedSource,
    setLoadingFeedSourceStatus,
    setLoadingNewEventsStatus,
    isLoadingNewEvents,
    pushToEvents,
    setLoadingMoreStatus,
    isLoadingMore,
    isMountAfterLogin,
    setMountAfterLogin,
    eventsId,
    updateInterval,
    clearUpdateInterval,
    clear,
    toRemountFeed,
    setToRemountFeed,
    newEventsToShowIds,
    timeToGetNewPosts,
    refreshPostsFetchTime,
    filterAndUpdateNewEventsToShow,
    sourceSelectDataRefresh,
  }
})
