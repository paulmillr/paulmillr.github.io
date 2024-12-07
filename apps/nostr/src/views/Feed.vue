<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import type { SimplePool, Filter, Event } from 'nostr-tools'
  import RelayEventsList from './../components/RelayEventsList.vue'
  import Pagination from './../components/Pagination.vue'
  import MessageWrapper from '@/components/MessageWrapper.vue'
  import FeedHeader from '@/components/FeedHeader.vue'
  import NewEventsBadge from '@/components/NewEventsBadge.vue'
  import { DEFAULT_EVENTS_COUNT } from './../app'
  import type { EventExtended, LogContentPart, ShortPubkeyEvent } from './../types'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'
  import { useNsec } from '@/stores/Nsec'
  import { useMetasCache } from '@/stores/MetasCache'
  import { getFollowsConnectedRelaysMap, getUserFollows } from '@/utils/network'
  import { loadAndInjectDataToPosts, listRootEvents } from '@/utils/utils'
  import { EVENT_KIND } from '@/nostr'

  defineProps<{
    eventsLog: LogContentPart[][]
  }>()

  const relayStore = useRelay()
  const feedStore = useFeed()
  const nsecStore = useNsec()
  const poolStore = usePool()
  const metasCacheStore = useMetasCache()

  // pagination
  const route = useRoute()
  const router = useRouter()
  const currentPage = ref(1)
  const pagesCount = computed(() =>
    Math.ceil(feedStore.paginationEventsIds.length / DEFAULT_EVENTS_COUNT),
  )
  const currPath = computed(() => route.path)

  const pool = poolStore.pool
  const isDisabledSourceSelect = ref(false)

  watch(
    () => route.path,
    () => {
      if (currentPage.value > 1) {
        showFeedPage(1)
      }
    },
  )

  watch(
    () => feedStore.selectedFeedSource,
    async () => {
      // remounting feed when feed source is changed
      await mountFeed()
    },
  )

  watch(
    () => feedStore.isMountAfterLogin,
    () => {
      if (!feedStore.isMountAfterLogin) return
      feedStore.setMountAfterLogin(false)
      mountFeed()
    },
    { immediate: true },
  )

  onMounted(() => {
    // TODO: keep page and return to the page
    // when switching between tabs, when come back to feed, we return to the first page
    if (pagesCount.value > 1) {
      showFeedPage(1)
    }

    if (feedStore.toRemountFeed) {
      feedStore.setToRemountFeed(false)
      mountFeed()
    }
  })

  function disableSelect() {
    isDisabledSourceSelect.value = true
  }

  function enableSelect() {
    isDisabledSourceSelect.value = false
  }

  function getInitialFeedRelays() {
    return relayStore.connectedUserReadRelayUrls.length
      ? relayStore.connectedUserReadRelayUrls
      : [relayStore.currentRelay.url]
  }

  async function mountFeed() {
    disableSelect()
    feedStore.sourceSelectDataRefresh()
    feedStore.setLoadingFeedSourceStatus(true)

    const pubkey = nsecStore.getPubkey()
    let initialFeedRelays = getInitialFeedRelays()

    let followsPubkeys: string[] = []
    let folowsConnectedRelays: string[] = []
    let followsConnectedRelaysMap: Record<string, string[]> = {}
    if (feedStore.isFollowsSource && pubkey.length) {
      ;({ followsPubkeys, followsConnectedRelaysMap, folowsConnectedRelays } =
        await getMountFollowsData(pubkey, initialFeedRelays))
    }

    const feedRelays = folowsConnectedRelays.length ? folowsConnectedRelays : initialFeedRelays
    relayStore.setConnectedFeedRelayUrls(feedRelays)

    const posts = await getMountFeedEvents(followsPubkeys, feedRelays)

    // in callback we receive posts one by one with injected data as soon as they were loaded
    // cache with metas also is being filled here inside (all data for all posts is loaded in parallel)
    const isRootPosts = true
    await loadAndInjectDataToPosts(
      posts,
      null,
      followsConnectedRelaysMap,
      feedRelays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
      (post) => {
        feedStore.pushToEvents(post as EventExtended)
        feedStore.pushToPaginationEventsIds(post.id)
        if (feedStore.isLoadingFeedSource) {
          feedStore.setLoadingFeedSourceStatus(false)
          feedStore.setLoadingMoreStatus(true)
        }
      },
    )
    feedStore.setLoadingMoreStatus(false)

    await subscribeFeedForUpdates(followsPubkeys, feedRelays)

    enableSelect()
  }

  async function getMountFollowsData(pubkey: string, relays: string[]) {
    const folowsRelaysSet = new Set<string>()
    let followsConnectedRelaysMap: Record<string, string[]> = {}
    let followsPubkeys: string[] = []

    const follows = await getUserFollows(pubkey, relays, pool as SimplePool)
    if (follows) {
      followsPubkeys = follows.tags.map((f) => f[1])
      followsConnectedRelaysMap = await getFollowsConnectedRelaysMap(
        follows,
        relays,
        pool as SimplePool,
      )
      for (const relays of Object.values(followsConnectedRelaysMap)) {
        relays.forEach((r) => folowsRelaysSet.add(r))
      }
    }

    return {
      followsPubkeys,
      followsConnectedRelaysMap,
      folowsConnectedRelays: Array.from(folowsRelaysSet),
    }
  }

  async function getMountFeedEvents(pubkeys: string[], relays: string[]) {
    let postsFilter: Filter = { kinds: [EVENT_KIND.TEXT_NOTE], limit: DEFAULT_EVENTS_COUNT }
    if (pubkeys.length) {
      postsFilter.authors = pubkeys
    }

    feedStore.refreshPostsFetchTime()
    const posts = (await listRootEvents(pool as SimplePool, relays, [postsFilter])) as Event[]
    return posts.sort((a, b) => b.created_at - a.created_at)
  }

  const subscribeFeedForUpdates = async (pubkeys: string[], relays: string[]) => {
    let filter: Filter = { kinds: [EVENT_KIND.TEXT_NOTE] }
    if (pubkeys.length) {
      filter.authors = pubkeys
    }

    feedStore.updateInterval = setInterval(async () => {
      await getFeedUpdates(relays, filter, feedStore.updateInterval)
    }, 3000) as unknown as number
  }

  const getFeedUpdates = async (
    feedRelays: string[],
    subscribePostsFilter: Filter,
    currentInterval: number,
  ) => {
    if (feedStore.isLoadingNewEvents) return

    subscribePostsFilter.since = feedStore.timeToGetNewPosts
    feedStore.refreshPostsFetchTime()

    const newEvents = await pool.querySync(feedRelays, subscribePostsFilter)
    if (!isFeedUpdateIntervalValid(currentInterval)) return

    feedStore.filterAndUpdateNewEventsToShow(newEvents)
    if (!feedStore.newEventsToShow.length) return
    feedStore.setShowNewEventsBadge(true)

    const newBadgeImages = await getNewEventsBadgeImages(feedRelays)
    if (!isFeedUpdateIntervalValid(currentInterval)) return

    if (!newBadgeImages.length) return
    feedStore.setNewEventsBadgeImageUrls(newBadgeImages)
  }

  const isFeedUpdateIntervalValid = (interval: Number) => {
    return feedStore.updateInterval === interval
  }

  const getNewEventsBadgeImages = async (feedRelays: string[]) => {
    const eventsToShow = feedStore.newEventsToShow
    if (eventsToShow.length < 2) return []

    const pub1 = eventsToShow[eventsToShow.length - 1].pubkey
    const pub2 = eventsToShow[eventsToShow.length - 2].pubkey

    const eventsListOptions1 = { kinds: [0], authors: [pub1], limit: 1 }
    const eventsListOptions2 = { kinds: [0], authors: [pub2], limit: 1 }

    const [author1, author2] = await Promise.all([
      pool.get(feedRelays, eventsListOptions1),
      pool.get(feedRelays, eventsListOptions2),
    ])

    if (!author1?.content || !author2?.content) return []

    const authorImg1 = JSON.parse(author1.content).picture
    const authorImg2 = JSON.parse(author2.content).picture

    return [authorImg1, authorImg2]
  }

  const showFeedPage = async (page: number, ignoreLoadingStatus: boolean = false) => {
    if (!ignoreLoadingStatus && feedStore.isLoadingNewEvents) return
    feedStore.setLoadingNewEventsStatus(true)
    disableSelect()

    const relays = relayStore.connectedFeedRelaysUrls
    if (!relays.length) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const idsToShow = feedStore.paginationEventsIds.slice(start, end)

    const postsEvents = await pool.querySync(relays, { ids: idsToShow })
    let posts = postsEvents.sort((a, b) => b.created_at - a.created_at)

    const isRootPosts = true
    await loadAndInjectDataToPosts(
      posts,
      null,
      {},
      relays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
    )

    feedStore.updateEvents(posts as EventExtended[])
    feedStore.setLoadingNewEventsStatus(false)
    currentPage.value = page
    enableSelect()
  }

  const loadNewRelayEvents = async () => {
    if (feedStore.isLoadingNewEvents) return
    disableSelect()

    feedStore.setLoadingNewEventsStatus(true)
    feedStore.setShowNewEventsBadge(false)

    const relays = relayStore.connectedFeedRelaysUrls
    if (!relays.length) return

    router.push({ path: `${route.path}` })

    let eventsToShow = [...feedStore.newEventsToShow]
    feedStore.updateNewEventsToShow([])
    feedStore.setNewEventsBadgeImageUrls([])

    const ids = eventsToShow.map((e: ShortPubkeyEvent) => e.id).reverse() // make the last event to go first

    // prepend new events ids to the list of pagination events ids
    const newPaginationEventsIds = [...feedStore.paginationEventsIds]
    newPaginationEventsIds.unshift(...ids)
    feedStore.updatePaginationEventsIds(newPaginationEventsIds)

    const ignoreLoadingStatus = true
    await showFeedPage(1, ignoreLoadingStatus)

    // logHtmlParts([
    //   { type: 'text', value: `loaded ${eventsToShow.length}` },
    //   { type: 'text', value: ' new event(s) from ' },
    //   { type: 'bold', value: relayStore.connectedFeedRelaysPrettyStr },
    // ])

    feedStore.setLoadingNewEventsStatus(false)
    enableSelect()
  }
</script>

<template>
  <div id="feed">
    <MessageWrapper
      @loadNewRelayEvents="loadNewRelayEvents"
      :newEvents="feedStore.newEventsToShow"
    />

    <FeedHeader :isDisabledSourceSelect="isDisabledSourceSelect" />

    <div :class="['events', { events_hidden: currPath === '/log' }]">
      <div v-if="feedStore.isLoadingFeedSource" class="connecting-notice">
        Loading feed from {{ feedStore.selectedFeedSource }}...
      </div>

      <div v-if="feedStore.isLoadingNewEvents" class="connecting-notice">Loading new notes...</div>

      <NewEventsBadge
        v-if="feedStore.showNewEventsBadge"
        @loadNewRelayEvents="loadNewRelayEvents"
      />

      <RelayEventsList
        :events="feedStore.events"
        :currentReadRelays="relayStore.connectedFeedRelaysUrls"
        @toggleRawData="feedStore.toggleEventRawData"
      />

      <div v-if="feedStore.isLoadingMore" class="loading-more">Loading more posts...</div>

      <Pagination :pagesCount="pagesCount" :currentPage="currentPage" @showPage="showFeedPage" />
    </div>

    <!-- <RelayLog :eventsLog="eventsLog" /> -->
  </div>
</template>

<style scoped>
  .events {
    position: relative;
  }

  .events_hidden {
    display: none;
  }

  @media (min-width: 1200px) {
    .events_hidden {
      display: initial;
    }
  }

  .connecting-notice {
    margin-top: 15px;
  }

  .loading-more {
    text-align: center;
  }
</style>
