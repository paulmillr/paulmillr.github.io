<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    relayInit,
    nip10,
    SimplePool,
    type Sub,
    type Relay,
    type Event,
    type Filter
  } from 'nostr-tools'

  import type { EventExtended, LogContentPart } from './types'
  import { 
    isWsAvailable, 
    normalizeUrl,
    injectAuthorsToNotes,
    injectDataToNotes
  } from './utils'
  
  import HeaderFields from './components/HeaderFields.vue'

  import { DEFAULT_EVENTS_COUNT } from './app'
  import { 
    cachedUrlNpub, 
    isConnectingToRelay,
    connectedRelayUrl,
    connectedRelayUrls,
    selectedRelay,
    nsec,
    isRememberedUser,
    customRelayUrl,
    currentRelay,
    feedEvents,
    pubkeyFromPrivate,
    showNewEventsBadgeFeed,
    newEventsBadgeImageUrlsFeed,
    newEventsBadgeCountFeed,
    newEventsFeed,
    paginationEventsIdsFeed,
    relaysFeedPool,
    messageToBroadcastFeed,
    additionalRelaysUrlsSignedEvent,
    signedJsonFeed
  } from './store'

  let relaySub: Sub;
  let curInterval: number;

  const isRemembered = localStorage.getItem('rememberMe') === 'true'
  isRememberedUser.update(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsec.update(initialNsec || '')

  // events in feed
  const events = ref<EventExtended[]>([])
  const eventsIds = new Set()
  const sentEventIds = new Set()

  let newEvents = ref<{ id: string; pubkey: string; }[]>([]);

  let showNewEventsBadge = ref(false)
  let newEventsBadgeCount = ref(0)
  let newAuthorImg1 = ref('');
  let newAuthorImg2 = ref('');

  const eventsLog = ref<LogContentPart[][]>([]);

  const wsError = ref('')
  const jsonErr = ref('')
  const isSendingMessage = ref(false)

  const userTabLink = computed(() => cachedUrlNpub.value.length ? `/user/${cachedUrlNpub.value}` : '/user' )

  const logStr = (msg: string) => {
    const parts = [{ type: 'text', value: msg }]
    logHtmlParts(parts)
  }

  const logHtmlParts = (parts: LogContentPart[]) => {
    eventsLog.value.unshift(parts)
  }

  const updateNewEventsElement = async () => {
    const relay = currentRelay.value
    if (!relay) return;
    
    const eventsToShow = newEventsFeed.value
    if (eventsToShow.length < 2) return;
    
    const pub1 = eventsToShow[eventsToShow.length - 1].pubkey
    const pub2 = eventsToShow[eventsToShow.length - 2].pubkey
    
    const eventsListOptions1 = [{ kinds: [0], authors: [pub1], limit: 1 }]
    const eventsListOptions2 = [{ kinds: [0], authors: [pub2], limit: 1 }]
    
    const author1 = await relay.list(eventsListOptions1)
    const author2 = await relay.list(eventsListOptions2)

    if (!curInterval) return;

    newAuthorImg1.value = JSON.parse(author1[0].content).picture
    newAuthorImg2.value = JSON.parse(author2[0].content).picture
    newEventsBadgeImageUrlsFeed.update([newAuthorImg1.value, newAuthorImg2.value])

    newEventsBadgeCount.value = eventsToShow.length
    newEventsBadgeCountFeed.update(eventsToShow.length)

    showNewEventsBadge.value = true
    showNewEventsBadgeFeed.update(true)
  }

  const timeout = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const listRootEvents = (relay: Relay, filters: Filter[]) => {
    return new Promise(resolve => {
      const events: Event[] = []
      let filtersLimit:number
      let newFilters = filters
      if (filters && filters.length && filters[0].limit) {
        let { limit, ...restFilters } = filters[0]
        newFilters = [restFilters]
        filtersLimit = limit
      }
      const sub = relay.sub(newFilters)
      sub.on('event', (event: Event) => {
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) {
          return;
        }
        events.push(event)
        if (filtersLimit && events.length >= filtersLimit) {
          resolve(events)
          sub.unsub()
        }
      })
      sub.on('eose', () => {
        sub.unsub()
      })
    })
  }

  async function handleRelayConnect() {
    if (isConnectingToRelay.value) return

    let relayUrl = selectedRelay.value
    let isCustom = false
    if (relayUrl === 'custom') {
      relayUrl = normalizeUrl(customRelayUrl.value)
      isCustom = true
    }

    if (!relayUrl.length) return;

    // unsubscribe from previous list of relays and clear interval
    if (currentRelay.value.status) {
      currentRelay.value.close();
      logHtmlParts([
        { type: 'text', value: 'disconnected from ' },
        { type: 'bold', value: currentRelay.value.url }
      ])
    }
    if (relaySub) {
      relaySub.unsub()
    }
    if (curInterval) {
      clearInterval(curInterval)
      curInterval = 0;
    }

    let relay: Relay;
    try {
      isConnectingToRelay.update(true)
      relay = relayInit(relayUrl)
      // two attempts to connect
      try {
        await relay.connect()
      } catch (e) {
        await timeout(500)
        await relay.connect()
      }
      wsError.value = ''
    } catch (e) {
      let error = `WebSocket connection to "${relayUrl}" failed. You can try again. `
      if (!navigator.onLine) {
        error += `Or check your internet connection.`
      } else {
        error += `Also check WebSocket address. Relay address should be a correct WebSocket URL. Or relay is unavailable or you are offline.`
      }
      wsError.value = error
      isConnectingToRelay.update(false)
      return;
    }

    currentRelay.update(relay)

    relay.on('connect', async () => {
      logHtmlParts([
        { type: 'text', value: 'connected to ' },
        { type: 'bold', value: relay.url }
      ])

      // hide new events element and clear it's values
      showNewEventsBadge.value = false
      showNewEventsBadgeFeed.update(false)
      newEvents.value = []
      newEventsFeed.update([])

      const limit = DEFAULT_EVENTS_COUNT;
      const postsEvents = await listRootEvents(relay, [{ kinds: [1], limit }]) as Event[]

      const authors = postsEvents.map((e: Event) => e.pubkey)
      const authorsEvents = await relay.list([{ kinds: [0], authors }])
      let posts = injectAuthorsToNotes(postsEvents, authorsEvents)

      const relaysUrls = [relay.url]
      const pool = relaysFeedPool.value
      await injectDataToNotes(posts as EventExtended[], relaysUrls, pool as SimplePool)

      eventsIds.clear()
      paginationEventsIdsFeed.update([])
      posts.forEach((e: Event) => {
        eventsIds.add(e.id)
        paginationEventsIdsFeed.push(e.id)
      })
      events.value = posts as EventExtended[]
      feedEvents.update(posts as EventExtended[])

      connectedRelayUrl.update(isCustom ? 'custom' : relayUrl)
      connectedRelayUrls.update([relayUrl]) // further it can be an array of a few relays
      isConnectingToRelay.update(false)

      relaySub = relay.sub([{ kinds: [1], limit: 1 }])
      relaySub.on('event', (event: Event) => {
        if (eventsIds.has(event.id)) return;
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) return;
        newEvents.value.push({ id: event.id, pubkey: event.pubkey })
        newEventsFeed.push({ id: event.id, pubkey: event.pubkey })
      })
      curInterval = setInterval(updateNewEventsElement, 3000)
    })

    relay.on('error', () => {
      logHtmlParts([
        { type: 'text', value: 'failed to connect to ' },
        { type: 'bold', value: relay.url }
      ])
    })

    return relay
  }

  const loadNewRelayEvents = async () => {
    const relay = currentRelay.value
    if (!relay) return

    let eventsToShow = newEventsFeed.value;
    newEventsFeed.update(newEventsFeed.value.filter(item => !eventsToShow.includes(item)))

    const ids = eventsToShow.map(e => e.id)
    const limit = DEFAULT_EVENTS_COUNT;

    paginationEventsIdsFeed.update(paginationEventsIdsFeed.value.concat(ids))
    const firstPageIds = paginationEventsIdsFeed.value.slice(-limit)

    const postsEvents = await relay.list([{ ids: firstPageIds }]);

    const authors = postsEvents.map((e: Event) => e.pubkey)
    const authorsEvents = await relay.list([{ kinds: [0], authors }])
    let posts = injectAuthorsToNotes(postsEvents, authorsEvents)

    const relaysUrls = [relay.url]
    const pool = relaysFeedPool.value
    await injectDataToNotes(posts as EventExtended[], relaysUrls, pool as SimplePool)

    posts.forEach((e: Event) => eventsIds.add(e.id))

    // update view
    feedEvents.update(posts as EventExtended[])
    showNewEventsBadgeFeed.update(false)

    logHtmlParts([
      { type: 'text', value: `loaded ${eventsToShow.length}` },
      { type: 'text', value: ' new event(s) from ' },
      { type: 'bold', value: relay.url }
    ])
  }

  const broadcastEvent = async (event: Event, type: string) => {
    const relay = currentRelay.value
    if (!relay) return
    if (isSendingMessage.value) return

    isSendingMessage.value = true
    
    clearInterval(curInterval)

    const userNewEventOptions = [{ kinds: [1], authors: [pubkeyFromPrivate.value], limit: 1 }]
    const userSub = relay.sub(userNewEventOptions)
    const intervals: number[] = []
    userSub.on('event', (event: Event) => {
      // update feed only if new event is loaded
      // interval needed because of delay between publishing and loading new event
      const interval = setInterval(async () => {
        if (newEvents.value.some(e => e.id == event.id)) {
          await loadNewRelayEvents()
          curInterval = setInterval(updateNewEventsElement, 3000)
          userSub.unsub()
          intervals.forEach(i => clearInterval(i))
        }
      }, 100)
      intervals.push(interval)
    })

    const rawAdditionalUrls = additionalRelaysUrlsSignedEvent.value
    const extraUrls = []
    if (type === 'json' && rawAdditionalUrls.length) {
      let error = "Can't connect to these relays: "
      let isError = false
      for (const relayUrl of rawAdditionalUrls) {
        if (!relayUrl?.length) continue
        const url = normalizeUrl(relayUrl)
        if (!await isWsAvailable(url)) {
          isError = true
          error += `${url}, `
          continue
        }
        extraUrls.push(url)
      }
      if (isError) {
        if (!await isWsAvailable(relay.url)) {
          error += `${relay.url}, `
        }
        error = error.slice(0, -2);
        error += `. Relays are unavailable or you are offline.`
        jsonErr.value = error
        isSendingMessage.value = false
        return
      }
    }

    const relayUrls = [relay.url, ...extraUrls]

    const pool = relaysFeedPool.value
    const pub = pool.publish(relayUrls, event)
    let successCount = 0
    pub.on('ok', async function(relayUrl: string) {
      isSendingMessage.value = false
      sentEventIds.add(event.id)
      logHtmlParts([
        { type: 'text', value: '✅ new event broadcasted to ' },
        { type: 'bold', value: relayUrl }
      ])
      successCount++
      if (successCount === relayUrls.length) {
        if (type === 'text') messageToBroadcastFeed.update('')
        if (type === 'json') signedJsonFeed.update('')
      }
    })
    pub.on('failed', (relayUrl: string) => {
      isSendingMessage.value = false
      logHtmlParts([
        { type: 'text', value: '❌ failed to publish to ' },
        { type: 'bold', value: relayUrl }
      ])
    })
  }

  const handleRelayDisconnect = () => {
    const relay = currentRelay.value
    if (!relay) return

    clearInterval(curInterval)
    showNewEventsBadge.value = false
    showNewEventsBadgeFeed.update(false)
    newEvents.value = []
    newEventsFeed.update([])

    connectedRelayUrl.update('')
    connectedRelayUrls.update([])
    relaySub.unsub()
    relay.close()

    logHtmlParts([
      { type: 'text', value: 'disconnected from ' },
      { type: 'bold', value: relay.url }
    ])
  }
</script>

<template>
  <HeaderFields 
    @relayConnect="handleRelayConnect" 
    @relayDisconnect="handleRelayDisconnect" 
    :wsError="wsError"
  />

  <div class="tabs">
    <router-link class="tab-link" to="/feed">Feed</router-link>
    <router-link class="tab-link" :to="userTabLink">User</router-link>
    <router-link class="tab-link" to="/message">Message</router-link>
    <router-link class="tab-link" to="/help">Help</router-link>
    <router-link class="tab-link" to="/log">Log</router-link>
  </div>

  <router-view 
    name="messageInput"
    @broadcastEvent="broadcastEvent" 
    :isSendingMessage="isSendingMessage"
    :sentEventIds="sentEventIds" 
  ></router-view>
  <router-view 
    name="signedEventInput"
    @broadcastEvent="broadcastEvent" 
    :isSendingMessage="isSendingMessage"
    :broadcastError="jsonErr"
  ></router-view>
  <router-view 
    @loadNewRelayEvents="loadNewRelayEvents"
    :handleRelayConnect="handleRelayConnect"
    :eventsLog="eventsLog"
  ></router-view>
</template>

<style scoped>

  .tabs {
    margin-top: 15px;
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 576px) {
    .tabs {
      display: block;
    }
  }

  .tab-link {
    display: inline-block;
    margin-right: 15px;
    color: #0092bf;
    text-decoration: none;
    cursor: pointer;
  }
  
  .tab-link:hover {
    text-decoration: underline;
  }

  .tab-link.router-link-active {
    text-decoration: underline;
  }
</style>
