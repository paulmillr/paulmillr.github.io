<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { SimplePool, nip10, type Filter, type Event } from 'nostr-tools'
  import RelayEventsList from './../components/RelayEventsList.vue'
  import Pagination from './../components/Pagination.vue'
  import MessageWrapper from '@/components/MessageWrapper.vue'
  import FeedHeader from '@/components/FeedHeader.vue'
  import { DEFAULT_EVENTS_COUNT } from './../app'
  import type { EventExtended, LogContentPart, ShortPubkeyEvent } from './../types'
  import { useRelay } from '@/stores/Relay'
  import { useImages } from '@/stores/Images'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'
  import { useNsec } from '@/stores/Nsec'
  import { useMetasCache } from '@/stores/MetasCache'
  import { getFollowsConnectedRelaysMap } from '@/utils/network'
  import { loadAndInjectDataToPosts, listRootEvents } from '@/utils'
  import { EVENT_KIND } from '@/nostr'

  defineProps<{
    eventsLog: LogContentPart[][]
  }>()

  const relayStore = useRelay()
  const imagesStore = useImages()
  const feedStore = useFeed()
  const nsecStore = useNsec()
  const poolStore = usePool()
  const metasCacheStore = useMetasCache()

  // loading new events
  const newAuthorImg1 = computed(() => feedStore.newEventsBadgeImageUrls[0])
  const newAuthorImg2 = computed(() => feedStore.newEventsBadgeImageUrls[1])

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
      if (relayStore.currentRelay.connected && nsecStore.isValidNsecPresented()) {
        await changeFeedSource()
      }
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
      remountFeed()
    }
  })

  const changeFeedSource = async () => {
    await remountFeed()
  }

  function disableSelect() {
    isDisabledSourceSelect.value = true
  }

  function enableSelect() {
    isDisabledSourceSelect.value = false
  }

  const remountFeed = async () => {
    disableSelect()

    feedStore.clearNewEventsBadgeUpdateInterval()
    feedStore.setShowNewEventsBadge(false)
    feedStore.updateNewEventsToShow([])
    feedStore.updatePaginationEventsIds([])
    feedStore.updateEvents([])

    await mountFeed()
  }

  /**
   * This function is used only to mount feed from scratch
   * For remounting feed use function remountFeed
   */
  async function mountFeed() {
    disableSelect()
    feedStore.setLoadingFeedSourceStatus(true)

    const pubkey = nsecStore.getPubkey()
    let feedRelays = relayStore.connectedUserReadRelayUrls.length
      ? relayStore.connectedUserReadRelayUrls
      : [relayStore.currentRelay.url]

    // get follows relays and pubkeys
    let followsRelaysMap: Record<string, string[]> = {}
    const folowsRelaysSet = new Set<string>()
    let followsPubkeys: string[] = []
    if (feedStore.isFollowsSource && pubkey.length) {
      const follows = await pool.get(feedRelays, {
        kinds: [EVENT_KIND.FOLLOW_LIST],
        limit: 1,
        authors: [pubkey],
      })
      if (follows) {
        followsPubkeys = follows.tags.map((f) => f[1])
        followsRelaysMap = await getFollowsConnectedRelaysMap(
          follows,
          feedRelays,
          pool as SimplePool,
        )
        for (const relays of Object.values(followsRelaysMap)) {
          relays.forEach((r) => folowsRelaysSet.add(r))
        }
      }
    }

    if (folowsRelaysSet.size) {
      feedRelays = Array.from(folowsRelaysSet)
    }
    relayStore.setConnectedFeedRelayUrls(feedRelays)

    // get posts
    let postsFilter: Filter = { kinds: [1], limit: DEFAULT_EVENTS_COUNT }
    if (followsPubkeys.length) {
      postsFilter.authors = followsPubkeys
    }

    feedStore.resetTimeToGetNewPostsToNow()

    let posts = (await listRootEvents(pool as SimplePool, feedRelays, [postsFilter])) as Event[]
    posts = posts.sort((a, b) => b.created_at - a.created_at)

    // in callback we receive posts one by one with injected data as soon as they were loaded
    // cache with metas also is being filled here inside
    // (all data for all posts is loaded in parallel)
    const isRootPosts = true
    await loadAndInjectDataToPosts(
      posts,
      null,
      followsRelaysMap,
      feedRelays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
      (post) => {
        feedStore.pushToEvents(post as EventExtended)
        if (feedStore.isLoadingFeedSource) {
          feedStore.setLoadingFeedSourceStatus(false)
          feedStore.setLoadingMoreStatus(true)
        }
        feedStore.pushToPaginationEventsIds(post.id)
      },
    )
    feedStore.setLoadingMoreStatus(false)

    // subscribe to new events
    let subscribePostsFilter: Filter = { kinds: [1] }
    if (followsPubkeys.length) {
      subscribePostsFilter.authors = followsPubkeys
    }

    feedStore.newEventsBadgeUpdateInterval = setInterval(async () => {
      const currentInterval = feedStore.newEventsBadgeUpdateInterval
      await getFeedUpdates(feedRelays, subscribePostsFilter, currentInterval)
    }, 3000)

    enableSelect()
  }

  const getFeedUpdates = async (
    feedRelays: string[],
    subscribePostsFilter: Filter,
    currentInterval: number,
  ) => {
    if (feedStore.isLoadingNewEvents) return

    subscribePostsFilter.since = feedStore.timeToGetNewPosts
    feedStore.resetTimeToGetNewPostsToNow()
    let newEvents = await pool.querySync(feedRelays, subscribePostsFilter)
    if (feedStore.newEventsBadgeUpdateInterval !== currentInterval) {
      return
    }

    newEvents = newEvents.sort((a, b) => a.created_at - b.created_at)
    newEvents.forEach((event) => {
      if (feedStore.eventsId.includes(event.id)) return
      if (feedStore.newEventsToShowIds.includes(event.id)) return
      if (feedStore.paginationEventsIds.includes(event.id)) return

      const nip10Data = nip10.parse(event)
      if (nip10Data.reply || nip10Data.root) return // filter non root events

      feedStore.pushToNewEventsToShow({
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
      })
    })

    await updateNewEventsElement(currentInterval)
  }

  async function updateNewEventsElement(currentInterval: number) {
    if (feedStore.newEventsBadgeUpdateInterval !== currentInterval) {
      return
    }

    const relays = relayStore.connectedFeedRelaysUrls
    if (!relays.length) return

    const eventsToShow = feedStore.newEventsToShow
    if (eventsToShow.length < 2) return

    feedStore.setNewEventsBadgeCount(eventsToShow.length)
    feedStore.setShowNewEventsBadge(true)

    const pub1 = eventsToShow[eventsToShow.length - 1].pubkey
    const pub2 = eventsToShow[eventsToShow.length - 2].pubkey

    const eventsListOptions1 = { kinds: [0], authors: [pub1], limit: 1 }
    const eventsListOptions2 = { kinds: [0], authors: [pub2], limit: 1 }

    const author1 = await pool.querySync(relays, eventsListOptions1)
    const author2 = await pool.querySync(relays, eventsListOptions2)

    if (feedStore.newEventsBadgeUpdateInterval !== currentInterval) {
      return
    }
    if (!author1[0]?.content || !author2[0]?.content) return

    const authorImg1 = JSON.parse(author1[0].content).picture
    const authorImg2 = JSON.parse(author2[0].content).picture

    feedStore.setNewEventsBadgeImageUrls([authorImg1, authorImg2])
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

    <div class="columns">
      <div :class="['events', { events_hidden: currPath === '/log' }]">
        <div v-if="feedStore.isLoadingFeedSource" class="connecting-notice">
          Loading feed from {{ feedStore.selectedFeedSource }}...
        </div>

        <div v-if="feedStore.isLoadingNewEvents" class="connecting-notice">
          Loading new notes...
        </div>

        <div
          v-if="feedStore.showNewEventsBadge"
          @click="loadNewRelayEvents"
          :class="['new-events', { 'new-events_top-shifted': feedStore.isLoadingNewEvents }]"
        >
          <div
            v-if="imagesStore.showImages && feedStore.newEventsBadgeImageUrls.length"
            class="new-events__imgs"
          >
            <img class="new-events__img" :src="newAuthorImg1" alt="user's avatar" />
            <img class="new-events__img" :src="newAuthorImg2" alt="user's avatar" />
          </div>
          <span class="new-events__text">{{ feedStore.newEventsBadgeCount }} new notes</span>
          <b class="new-events__arrow">↑</b>
        </div>

        <RelayEventsList
          :events="feedStore.events"
          :pubKey="nsecStore.getPubkey()"
          :showImages="imagesStore.showImages"
          :currentReadRelays="relayStore.connectedFeedRelaysUrls"
          @toggleRawData="feedStore.toggleEventRawData"
        />

        <div v-if="feedStore.isLoadingMore" class="loading-more">Loading more posts...</div>

        <Pagination :pagesCount="pagesCount" :currentPage="currentPage" @showPage="showFeedPage" />
      </div>

      <!-- <RelayLog :eventsLog="eventsLog" /> -->
    </div>
  </div>
</template>

<style scoped>
  .columns {
    display: flex;
    position: relative;
  }

  .events {
    position: relative;
    flex-grow: 1;
  }

  .events_hidden {
    display: none;
  }

  @media (min-width: 1200px) {
    .events_hidden {
      display: initial;
    }
  }

  .new-events {
    position: absolute;
    z-index: 1;
    padding: 4px 8px;
    top: 10px;
    left: 50%;
    transform: translate(-50%, 0);
    background: #0092bf;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    border-bottom-right-radius: 5px;
    border-bottom-left-radius: 5px;
  }

  .new-events_top-shifted {
    top: 60px;
  }

  @media (min-width: 768px) {
    .new-events {
      padding: 4px 14px;
      width: auto;
    }
  }

  .new-events__img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid white;
  }

  .new-events__text {
    margin-left: 5px;
    margin-right: 5px;
  }

  .new-events__imgs {
    display: flex;
  }
  .new-events__img:first-child {
    margin-right: -10px;
  }

  .connecting-notice {
    margin-top: 15px;
  }

  .loading-more {
    text-align: center;
  }
</style>
