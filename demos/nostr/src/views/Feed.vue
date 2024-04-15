<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute } from "vue-router";
  import type { SimplePool, Event } from "nostr-tools";
  import RelayEventsList from './../components/RelayEventsList.vue'
  import Pagination from './../components/Pagination.vue'
  import RelayLog from './../components/RelayLog.vue';
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

  const emit = defineEmits(['loadNewRelayEvents'])

  // loading new events
  const newAuthorImg1 = computed(() => feedStore.newEventsBadgeImageUrls[0])
  const newAuthorImg2 = computed(() => feedStore.newEventsBadgeImageUrls[1])

  // pagination
  const currentPage = ref(1);
  const pagesCount = computed(() => Math.ceil(feedStore.paginationEventsIds.length / DEFAULT_EVENTS_COUNT));
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

  onMounted(() => {
    if (pagesCount.value > 1) {
      showFeedPage(1)
    }
  })

  const showFeedPage = async (page: number) => {
    const pool = poolStore.feedPool
    const relays = relayStore.connectedReedRelayUrls
    if (!relays.length) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const reversedIds = feedStore.paginationEventsIds.slice().reverse()
    const idsToShow = reversedIds.slice(start, end)

    const postsEvents = await pool.querySync(relays, { ids: idsToShow });
    const authors = postsEvents.map((e: Event) => e.pubkey)
    const authorsEvents = await pool.querySync(relays, { kinds: [0], authors })
    let posts = injectAuthorsToNotes(postsEvents, authorsEvents)

    await injectDataToRootNotes(posts as EventExtended[], relays, pool as SimplePool)

    feedStore.updateEvents(posts as EventExtended[])
    currentPage.value = page
  }

  const loadNewRelayEvents = async () => {
    await emit('loadNewRelayEvents')
    currentPage.value = 1
  }
</script>

<template>
  <div id="feed">
    <div class="columns">
      <div :class="['events', { 'events_hidden': currPath === '/log' }]">
        <div class="connecting-notice" v-if="relayStore.isConnectingToRelay">
          Loading {{ relayStore.currentRelay ? 'new' : '' }} relay feed...
        </div>

        <div @click="loadNewRelayEvents" v-if="feedStore.showNewEventsBadge" class="new-events">
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
          :currentReadRelays="relayStore.connectedReedRelayUrls"
          @toggleRawData="feedStore.toggleEventRawData"
        />

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
</style>