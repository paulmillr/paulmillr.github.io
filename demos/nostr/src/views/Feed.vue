<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute } from "vue-router";
  import type { SimplePool, Event } from "nostr-tools";
  import RelayEventsList from './../components/RelayEventsList.vue'
  import Pagination from './../components/Pagination.vue'
  import RelayLog from './../components/RelayLog.vue'
  import LoadFromFeedSelect from '@/components/LoadFromFeedSelect.vue';
  import {
    injectAuthorsToNotes,
    injectDataToRootNotes
  } from './../utils'
  import { DEFAULT_EVENTS_COUNT } from './../app'
  import type { EventExtended, LogContentPart } from './../types';
  import { useRelay } from '@/stores/Relay'
  import { useImages } from '@/stores/Images'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'
  import { useNsec } from '@/stores/Nsec';

  defineProps<{
    eventsLog: LogContentPart[][]
  }>()

  const relayStore = useRelay()
  const imagesStore = useImages()
  const feedStore = useFeed()
  const nsecStore = useNsec()
  const poolStore = usePool()
  
  const pool = poolStore.pool

  const emit = defineEmits(['loadNewRelayEvents', 'handleRelayConnect'])

  // loading new events
  const newAuthorImg1 = computed(() => feedStore.newEventsBadgeImageUrls[0])
  const newAuthorImg2 = computed(() => feedStore.newEventsBadgeImageUrls[1])

  // pagination
  const currentPage = ref(1)
  const pagesCount = computed(() => Math.ceil(feedStore.paginationEventsIds.length / DEFAULT_EVENTS_COUNT))
  const route = useRoute()
  const currPath = computed(() => route.path)

  watch(
    () => route.path,
    async () => {
      if (currentPage.value > 1) {
        showFeedPage(1)
      }
    }
  )

  watch(
    () => feedStore.selectedFeedSource,
    async (source) => {
      if (relayStore.currentRelay.connected && nsecStore.isValidNsecPresented()) {
        await emit('handleRelayConnect', true, true)
      }
    }
  )

  onMounted(() => {
    if (pagesCount.value > 1) {
      showFeedPage(1)
    }
  })

  const showFeedPage = async (page: number) => {
    if (feedStore.isLoadingNewEvents) return
    feedStore.setLoadingNewEventsStatus(true)

    const relays = relayStore.connectedFeedRelaysUrls
    if (!relays.length) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const reversedIds = feedStore.paginationEventsIds.slice().reverse()
    const idsToShow = reversedIds.slice(start, end)

    const postsEvents = await pool.querySync(relays, { ids: idsToShow });
    const authors = Array.from(new Set([...postsEvents.map((e: Event) => e.pubkey)]))

    const authorsAndData = await Promise.all([
      Promise.all(
        authors.map(async (author) => {
          return pool.get(relays, { kinds: [0], authors: [author] })
        })
      ),
      injectDataToRootNotes(postsEvents as EventExtended[], relays, pool as SimplePool)
    ])

    const authorsEvents = authorsAndData[0] as Event[]
    let posts = injectAuthorsToNotes(postsEvents, authorsEvents)

    posts = posts.sort((a, b) => b.created_at - a.created_at)

    feedStore.updateEvents(posts as EventExtended[])
    feedStore.setLoadingNewEventsStatus(false)
    currentPage.value = page
  }

  const loadNewRelayEvents = async () => {
    await emit('loadNewRelayEvents')
    currentPage.value = 1
  }
</script>

<template>
  <div id="feed">
    <LoadFromFeedSelect />

    <div class="columns">
      <div :class="['events', { 'events_hidden': currPath === '/log' }]">
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
          <div v-if="imagesStore.showImages" class="new-events__imgs">
            <img class="new-events__img" :src="newAuthorImg1" alt="user's avatar">
            <img class="new-events__img" :src="newAuthorImg2" alt="user's avatar">
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

        <div v-if="feedStore.isLoadingMore" class="loading-more">
          Loading more posts...
        </div>

        <Pagination 
          :pagesCount="pagesCount"
          :currentPage="currentPage"
          @showPage="showFeedPage"
        />
      </div>

      <div :class="['log-wrapper', { 'log-wrapper_hidden': currPath !== '/log' }]">
        <RelayLog :eventsLog="eventsLog" />
      </div>
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
    top: 17px;
    left: 50%;
    transform: translate(-50%, 0);
    background: #0092bf;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
  }

  .new-events_top-shifted {
    top: 60px
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

  .log-wrapper {
    flex-grow: 1;
  }

  .log-wrapper_hidden {
    display: none;
  }

  @media (min-width: 1200px) {
    .log-wrapper {
      position: absolute;
      right: -255px;
      width: 240px;
    }

    .log-wrapper_hidden {
      display: initial;
    }
  }

  @media (min-width: 1280px) {
    .log-wrapper {
      right: -265px;
      width: 250px;
    }
  }

  .connecting-notice {
    margin-top: 15px
  }

  .loading-more {
    text-align: center
  }
</style>