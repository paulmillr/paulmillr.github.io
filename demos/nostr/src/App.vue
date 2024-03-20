<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    nip10,
    SimplePool,
    Relay,
    utils,
    type Event,
    type Filter,
    type SubCloser
  } from 'nostr-tools'
  import { useRouter, useRoute } from 'vue-router'
  import type { EventExtended, LogContentPart, ShortPubkeyEvent } from './types'
  import { 
    isWsAvailable, 
    injectAuthorsToNotes,
    injectDataToRootNotes,
    relayGet,
    parseRelaysNip65
  } from './utils'
  import HeaderFields from './components/HeaderFields.vue'
  import { DEFAULT_EVENTS_COUNT } from './app'
  import { publishEventToRelays } from './utils'

  import { useNpub } from '@/stores/Npub'
  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'

  const router = useRouter()
  const route = useRoute()
  const npubStore = useNpub()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const feedStore = useFeed()
  const poolStore = usePool()

  let relaysSub: SubCloser;
  let curInterval: number;

  const isRemembered = localStorage.getItem('rememberMe') === 'true'
  nsecStore.setRememberMe(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsecStore.updateNsec(initialNsec || '')

  // events in feed
  const events = ref<EventExtended[]>([])
  const eventsIds = new Set()
  const sentEventIds = new Set()

  let newEvents = ref<{ id: string; pubkey: string; }[]>([]);

  let newEventsBadgeCount = ref(0)
  let newAuthorImg1 = ref('');
  let newAuthorImg2 = ref('');

  const eventsLog = ref<LogContentPart[][]>([]);

  const wsError = ref('')
  const jsonErr = ref('')
  const broadcastNotice = ref('')
  const isSendingMessage = ref(false)

  const userTabLink = computed(() => npubStore.cachedUrlNpub.length ? `/user/${npubStore.cachedUrlNpub}` : '/user' )

  const logStr = (msg: string) => {
    const parts = [{ type: 'text', value: msg }]
    logHtmlParts(parts)
  }

  const logHtmlParts = (parts: LogContentPart[]) => {
    eventsLog.value.unshift(parts)
  }

  const updateNewEventsElement = async () => {
    const pool = poolStore.feedPool
    const relays = relayStore.connectedReedRelayUrls
    if (!relays.length) return;
    
    const eventsToShow = feedStore.newEventsToShow
    if (eventsToShow.length < 2) return;
    
    const pub1 = eventsToShow[eventsToShow.length - 1].pubkey
    const pub2 = eventsToShow[eventsToShow.length - 2].pubkey
    
    const eventsListOptions1 = { kinds: [0], authors: [pub1], limit: 1 }
    const eventsListOptions2 = { kinds: [0], authors: [pub2], limit: 1 }
    
    const author1 = await pool.querySync(relays, eventsListOptions1)
    const author2 = await pool.querySync(relays, eventsListOptions2)

    if (!curInterval) return;
    if (!author1[0]?.content || !author2[0]?.content) return;

    newAuthorImg1.value = JSON.parse(author1[0].content).picture
    newAuthorImg2.value = JSON.parse(author2[0].content).picture
    feedStore.setNewEventsBadgeImageUrls([newAuthorImg1.value, newAuthorImg2.value])

    newEventsBadgeCount.value = eventsToShow.length
    feedStore.setNewEventsBadgeCount(eventsToShow.length)

    feedStore.setShowNewEventsBadge(true)
  }

  const timeout = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const listRootEvents = (pool: SimplePool, relays: string[], filters: Filter[]) => {
    return new Promise(resolve => {
      const events: Event[] = []
      let filtersLimit:number
      let newFilters = filters
      if (filters && filters.length && filters[0].limit) {
        let { limit, ...restFilters } = filters[0]
        newFilters = [restFilters]
        filtersLimit = limit
      }

      const sub = pool.subscribeMany(
        relays, 
        newFilters,
        {
          onevent(event: Event) {
            const nip10Data = nip10.parse(event)
            if (nip10Data.reply || nip10Data.root) {
              return;
            }
            events.push(event)
            if (filtersLimit && events.length >= filtersLimit) {
              resolve(events.slice(0, filtersLimit))
              sub.close()
            }
          },
          oneose() {
            sub.close()
          }
        },
      )
    })
  }

  async function handleRelayConnect(useProvidedRelaysList: boolean = false) {
    if (relayStore.isConnectingToRelay) return

    let relayUrl = relayStore.selectedRelay
    let isCustom = false
    if (relayUrl === 'custom') {
      relayUrl = utils.normalizeURL(relayStore.customRelayUrl)
      isCustom = true
    }

    if (!relayUrl.length) return;

    if (nsecStore.isNotValidNsecPresented()) {
      wsError.value = 'Private key is invalid. Please check it and try again.'
      return;
    } else {
      nsecStore.updateCachedNsec(nsecStore.nsec)
    }

    // unsubscribe from previous list of relays and clear interval
    if (!useProvidedRelaysList && relayStore.currentRelay.connected) {
      relayStore.currentRelay.close();
      logHtmlParts([
        { type: 'text', value: 'disconnected from ' },
        { type: 'bold', value: relayStore.currentRelay.url }
      ])
    }

    if (relaysSub) {
      relaysSub.close() 
      // TODO: write to log about closing to previous relays from pool
    }
    if (curInterval) {
      clearInterval(curInterval)
      curInterval = 0;
    }

    let relay: Relay;

    if (!useProvidedRelaysList) {
      try {
        relayStore.setConnectionToRelayStatus(true)
        // two attempts to connect
        try {
          relay = await Relay.connect(relayUrl)
        } catch (e) {
          await timeout(500)
          relay = await Relay.connect(relayUrl)
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
        relayStore.setConnectionToRelayStatus(false)
        return;
      }

      relayStore.updateCurrentRelay(relay)

      logHtmlParts([
        { type: 'text', value: 'connected to ' },
        { type: 'bold', value: relay.url }
      ])

      // get user default relays if exists
      if (nsecStore.isNotValidNsecPresented()) {
        wsError.value = 'Private key is invalid. Please check it and try again.'
      }

      if (nsecStore.isValidNsecPresented()) {
        const pubkey = nsecStore.getPubkey()
        const timeout = 3000
        const authorMeta = await relayGet(relay, [{ kinds: [10002], limit: 1, authors: [pubkey] }], timeout) as Event
        // console.log('authorMeta', authorMeta)
        if (authorMeta && authorMeta.tags.length) {
          const { read, write } = parseRelaysNip65(authorMeta)
          relayStore.setReedRelays(read)
          relayStore.setWriteRelays(write)
        }
      }
    }

    // temp
    // userReadRelays = ['wss://nos.lol', 'wss://relay.nostr123.ai']

    // hide new events element and clear it's values
    feedStore.setShowNewEventsBadge(false)
    newEvents.value = []
    feedStore.updateNewEventsToShow([])

    poolStore.feedPool = new SimplePool()
    const pool = poolStore.feedPool

    const userConnectedReadRelays = <string[]>[]
    if (relayStore.reedRelays.length) {
      const result = await Promise.all(
        relayStore.reedRelays.map(async (relay) => {
          const isConnected = await isWsAvailable(relay)
          return { url: relay, connected: isConnected }
        })
      )
      
      result.forEach((r) => {
        // TODO: reset pool relays somehow to avoid this check
        if (useProvidedRelaysList && !relayStore.reedRelays.includes(r.url)){
          return
        }

        if (r.connected) {
          userConnectedReadRelays.push(r.url)
        }

        // do not show log for the same relay again
        if (relay?.url === r.url) return
        const mesasge = r.connected ? 'connected to ' : 'failed to connect to '
        logHtmlParts([
          { type: 'text', value: mesasge },
          { type: 'bold', value: r.url }
        ])
      })
    }

    // if no user default relays from nsec, use current relay
    const readRelays = userConnectedReadRelays.length ? userConnectedReadRelays : [relayUrl]

    const limit = DEFAULT_EVENTS_COUNT;
    // @ts-ignore
    const postsEvents = await listRootEvents(pool, readRelays, [{ kinds: [1], limit }]) as Event[]
    
    const authors = postsEvents.map((e: Event) => e.pubkey)
    const authorsEvents = await pool.querySync(readRelays, { kinds: [0], authors })
    
    let posts = injectAuthorsToNotes(postsEvents, authorsEvents)
    
    await injectDataToRootNotes(posts as EventExtended[], readRelays, pool as SimplePool)

    eventsIds.clear()
    feedStore.updatePaginationEventsIds([])
    posts.forEach((e: Event) => {
      eventsIds.add(e.id)
      feedStore.pushToPaginationEventsIds(e.id)
    })
    events.value = posts as EventExtended[]
    feedStore.updateEvents(posts as EventExtended[])

    relayStore.setConnectedRelayUrl(isCustom ? 'custom' : relayUrl)
    relayStore.setConnectedReedRelayUrls(readRelays)
    relayStore.setConnectionToRelayStatus(false)

    relaysSub = pool.subscribeMany(
      readRelays, 
      [{ kinds: [1], limit: 1 }], 
      {
        onevent(event: Event) {
          if (eventsIds.has(event.id)) return;
          const nip10Data = nip10.parse(event)
          if (nip10Data.reply || nip10Data.root) return;
          newEvents.value.push({ id: event.id, pubkey: event.pubkey })
          feedStore.pushToNewEventsToShow({ id: event.id, pubkey: event.pubkey })
        }
      }
    )
    curInterval = setInterval(updateNewEventsElement, 3000)
  }

  const loadNewRelayEvents = async () => {
    const pool = poolStore.feedPool
    const relays = relayStore.connectedReedRelayUrls
    if (!relays.length) return;

    router.push({ path: `${route.path}` })

    let eventsToShow = feedStore.newEventsToShow
    feedStore.updateNewEventsToShow(feedStore.newEventsToShow.filter((item: ShortPubkeyEvent) => !eventsToShow.includes(item)))

    const ids = eventsToShow.map((e: ShortPubkeyEvent) => e.id)
    const limit = DEFAULT_EVENTS_COUNT;

    feedStore.updatePaginationEventsIds(feedStore.paginationEventsIds.concat(ids))
    const firstPageIds = feedStore.paginationEventsIds.slice(-limit)

    const postsEvents = await pool.querySync(relays, { ids: firstPageIds })

    const authors = postsEvents.map((e: Event) => e.pubkey)
    const authorsEvents = await pool.querySync(relays, { kinds: [0], authors })
    let posts = injectAuthorsToNotes(postsEvents, authorsEvents)

    await injectDataToRootNotes(posts as EventExtended[], relays, pool as SimplePool)

    posts.forEach((e: Event) => eventsIds.add(e.id))

    // update view
    feedStore.updateEvents(posts as EventExtended[])
    feedStore.setShowNewEventsBadge(false)

    logHtmlParts([
      { type: 'text', value: `loaded ${eventsToShow.length}` },
      { type: 'text', value: ' new event(s) from ' },
      { type: 'bold', value: relayStore.connectedRelaysPrettyStr }
    ])
  }

  const broadcastEvent = async (event: Event, type: string) => {
    const pool = poolStore.feedPool
    let writeRelays = relayStore.writeRelays

    // for debugging json events
    // if (type !== 'json') {
    //   console.log(JSON.stringify(event))
    //   return
    // }

    if (type === 'json') {
      const rawAdditionalUrls = relayStore.additionalRelaysUrlsForSignedEvent
      let connectedJsonRelays: string[] = []

      if (rawAdditionalUrls.length) {
        let error = "Can't connect to these relays: "
        let isError = false
        for (const url of rawAdditionalUrls) {
          if (!url?.length) continue
          if (!await isWsAvailable(url)) {
            isError = true
            error += `${url}, `
            continue
          }
          connectedJsonRelays.push(url)
        }

        if (isError) {
          const connectedRelayUrl = relayStore.connectedRelayUrl
          if (!await isWsAvailable(connectedRelayUrl)) {
            error += `${connectedRelayUrl}, `
          }
          error = error.slice(0, -2);
          error += `. Relays are unavailable or you are offline.`
          jsonErr.value = error
          isSendingMessage.value = false
          return
        }
      }

      writeRelays = [relayStore.connectedRelayUrl, ...connectedJsonRelays]
    }

    if (isSendingMessage.value) return
    isSendingMessage.value = true

    const relaysToWatch = relayStore.connectedReedRelayUrls
    let userSub: SubCloser | null = null;
    if (relaysToWatch.length) {
      const userNewEventOptions = [{ kinds: [1], ids: [event.id], limit: 1 }]
      userSub = pool.subscribeMany(
        relaysToWatch, 
        userNewEventOptions,
        {
          async onevent(event: Event) {
            // update feed only if new event is loaded
            // interval needed because of delay between publishing and loading new event
            const interval = setInterval(async () => {
              if (newEvents.value.some(e => e.id == event.id)) {
                clearInterval(interval)
                await loadNewRelayEvents()
                userSub?.close()
              }
            }, 100)
          }
        }
      )
    }

    const result = await publishEventToRelays(writeRelays, pool, event)
    result.forEach((data: any) => {
      if (data.success) {
        logHtmlParts([
          { type: 'text', value: '✅ new event broadcasted to ' },
          { type: 'bold', value: data.relay }
        ])
      } else {
        logHtmlParts([
          { type: 'text', value: '❌ failed to publish to ' },
          { type: 'bold', value: data.relay }
        ])
      }
    })

    const isAllError = result.every((r: any) => r.success === false)
    if (isAllError && type === 'json' && relaysToWatch.length)  {
      userSub?.close()
    }
    
    const isError = result.some((r: any) => r.success === false)
    if (!isError) {
      if (type === 'text') {
        feedStore.updateMessageToBroadcast('')
      }
      if (type === 'json') {
        feedStore.updateSignedJson('')
      }
    }
    
    isSendingMessage.value = false
  }

  const handleRelayDisconnect = () => {
    if (!relayStore.isConnectedToRelay) return
    
    clearInterval(curInterval)
    feedStore.setShowNewEventsBadge(false)
    newEvents.value = []
    feedStore.updateNewEventsToShow([])
    
    const relay = relayStore.currentRelay
    relayStore.setConnectedRelayUrl('')
    relayStore.setConnectedReedRelayUrls([])
    relaysSub.close()
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
    <router-link class="tab-link" to="/settings">Settings</router-link>
  </div>

  <router-view 
    name="messageInput"
    @broadcastEvent="broadcastEvent" 
    :isSendingMessage="isSendingMessage"
    :sentEventIds="sentEventIds" 
    :broadcastNotice="broadcastNotice"
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
