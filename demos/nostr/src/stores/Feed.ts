import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { EventExtended, ShortPubkeyEvent } from '@/types'

export const useFeed = defineStore('feed', () => {
  const events = ref<EventExtended[]>([])
  const showNewEventsBadge = ref(false)
  const newEventsBadgeImageUrls = ref<string[]>([])
  const newEventsBadgeCount = ref(0)
  const newEventsToShow = ref<ShortPubkeyEvent[]>([])
  const paginationEventsIds = ref<string[]>([])
  const messageToBroadcast = ref('')
  const signedJson = ref('')

  const selectedFeedSource = ref('network')

  const isFollowsSource = computed(() => selectedFeedSource.value === 'follows')
  const isNetworkSource = computed(() => selectedFeedSource.value === 'network')
  const isLoadingFeedSource = ref(false)
  const isLoadingNewEvents = ref(false)
  const isLoadingMore = ref(false)

  function updateEvents(value: EventExtended[]) {
    events.value = value
  }

  function pushToEvents(value: EventExtended) {
    events.value.push(value)
  }

  function toggleEventRawData(id: string) {
    const event = events.value.find(e => e.id === id)
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

  function setNewEventsBadgeCount(value: number) {
    newEventsBadgeCount.value = value
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

  return {
    events, 
    updateEvents, 
    toggleEventRawData, 
    showNewEventsBadge, 
    setShowNewEventsBadge,
    newEventsBadgeImageUrls,
    setNewEventsBadgeImageUrls,
    newEventsBadgeCount,
    setNewEventsBadgeCount,
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
    isLoadingMore
  }
})