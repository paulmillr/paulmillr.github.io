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
    parseRelaysNip65,
    injectRootLikesRepostsRepliesCount,
    getNoteReferences,
    injectReferencesToNote,
    filterMetas
  } from './utils'
  import HeaderFields from './components/HeaderFields.vue'
  import { DEFAULT_EVENTS_COUNT } from './app'
  import { publishEventToRelays } from './utils'

  import { useNpub } from '@/stores/Npub'
  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'

  import { PURPLEPAG_RELAY_URL } from '@/nostr'

  const router = useRouter()
  const route = useRoute()
  const npubStore = useNpub()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const feedStore = useFeed()
  const poolStore = usePool()
  const pool = poolStore.pool

  let relaysSub: SubCloser;
  let curInterval: number;

  const isRemembered = localStorage.getItem('rememberMe') === 'true'
  nsecStore.setRememberMe(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsecStore.updateNsec(initialNsec || '')

  // events in feed
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
    const relays = relayStore.connectedFeedRelaysUrls
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
      let filtersLimit:number | undefined;
      let newFilters = filters
      if (filters && filters.length && filters[0].limit) {
        let { limit, ...restFilters } = filters[0]
        newFilters = [restFilters]
        filtersLimit = limit
      }
      
      let subClosed = false
      const sub = pool.subscribeMany(
        relays, 
        newFilters,
        {
          onevent(event: Event) {
            if (subClosed) return

            const nip10Data = nip10.parse(event)
            if (nip10Data.reply || nip10Data.root) return
            
            events.push(event)
            if (filtersLimit && events.length >= filtersLimit) {
              sub.close()
              subClosed = true
              resolve(events.slice(0, filtersLimit))
            }
          },
          oneose() {
            sub.close()
            const result = filtersLimit ? events.slice(0, filtersLimit) : events
            resolve(result)
          }
        },
      )
    })
  }

  async function handleRelayConnect(useProvidedRelaysList: boolean = false, changeFeedSource: boolean = false) {
    if (relayStore.isConnectingToRelay) return

    let relayUrl = relayStore.selectInputRelayUrl
    if (relayUrl === 'custom') {
      const customUrl = relayStore.selectInputCustomRelayUrl
      relayUrl = customUrl.length ? utils.normalizeURL(customUrl) : ''
    }

    if (!relayUrl.length) return

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
    if (!useProvidedRelaysList) {
      relayStore.setReedRelays([])
      relayStore.setWriteRelays([])
    }

    let relay: Relay;

    if (!useProvidedRelaysList) {
      try {
        relayStore.setConnectionToRelayStatus(true)
        feedStore.setLoadingFeedSourceStatus(true)
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

    if (changeFeedSource || useProvidedRelaysList) {
      feedStore.setLoadingFeedSourceStatus(true)
    }

    const userConnectedReadRelays: string[] = []
    if (relayStore.reedRelays.length) {
      const result = await Promise.all(
        relayStore.reedRelays.map(async (relay) => {
          const isConnected = await isWsAvailable(relay)
          return { url: relay, connected: isConnected }
        })
      )

      result.forEach((r) => {
        // reset pool relays somehow to avoid this check
        // it is for the case when new url added and the previous handleRelayConnect was not finished yet
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
    let feedRelays = userConnectedReadRelays.length ? userConnectedReadRelays : [relayUrl]

    const pubkey = nsecStore.getPubkey()
    const followsRelaysMap: Record<string, string[]> = {}
    let followsPubkeys: string[] = [];
    if (feedStore.isFollowsSource && nsecStore.isValidNsecPresented()) {
      const follows = await pool.get(feedRelays, { kinds: [3], limit: 1, authors: [pubkey] })

      if (follows && follows.tags.length) {
        followsPubkeys = follows.tags.map(f => f[1])
        const followsMeta = await pool.querySync(feedRelays, { kinds: [10002], authors: followsPubkeys })
        const followsRelaysUrlsExceptUserRelays = new Set()

        followsMeta.forEach((event: Event) => {
          event.tags.forEach((tag) => {
            if (tag[0] !== 'r') return
            const relayUrl = utils.normalizeURL(tag[1])
            if (feedRelays.includes(relayUrl)) return
            followsRelaysUrlsExceptUserRelays.add(relayUrl)
          })
        })

        const followsSortedRelays = await Promise.all(
          Array.from(followsRelaysUrlsExceptUserRelays).map(async (relay: any) => {
            const isConnected = await isWsAvailable(relay, 1000)
            return { url: relay, connected: isConnected }
          })
        )

        const isSuccess = followsSortedRelays.some((r: any) => r.connected)
        if (isSuccess) {
          logHtmlParts([
            { type: 'text', value: 'Connected to follows relays' }
          ])
        } else {
          logHtmlParts([
            { type: 'text', value: 'Failed to connect to follows relays' }
          ])
        }

        const followsConnectedRelaysUrls = followsSortedRelays
          .filter(r => r.connected)
          .map(r => r.url)

        // creating map of relays for each follow (person which user follow)
        // this map will be used further for loading metas of authors of posts and references inside posts
        // because laoding from the bunch of all follows relays is too slow,
        // so we will load only from relays of the author of the post
        followsMeta.forEach((event: Event) => {
          const normalizedUrls: string[] = []
          event.tags.forEach((tag) => {
            if (tag[0] !== 'r') return
            const relayUrl = utils.normalizeURL(tag[1])
            if (followsConnectedRelaysUrls.includes(relayUrl) || feedRelays.includes(relayUrl)) {
              normalizedUrls.push(relayUrl)
            }
          })
          followsRelaysMap[event.pubkey] = normalizedUrls
        })

        feedRelays = [...new Set([...feedRelays, ...followsConnectedRelaysUrls])]
      }
    }

    let postsFilter: Filter = { kinds: [1], limit: DEFAULT_EVENTS_COUNT }
    // list follows pubkeys except own, to prevent loading own events in feed
    followsPubkeys = followsPubkeys.filter(f => f !== pubkey)
    if (followsPubkeys.length) {
      postsFilter.authors = followsPubkeys
    }

    relayStore.setConnectedUserReadRelayUrls(userConnectedReadRelays)
    relayStore.setConnectedFeedRelayUrls(feedRelays)
    
    const postsEvents = await listRootEvents(pool as SimplePool, feedRelays, [postsFilter]) as Event[]
    const posts = postsEvents.sort((a, b) => b.created_at - a.created_at)

    // collect promises for all posts
    const postPromises = []
    const cachedMetasPubkeys: string[] = []
    const cachedMetas: { [key: string]: Event | null } = {}

    for (const post of posts) {
      const author = post.pubkey
      const relays = feedStore.isFollowsSource && followsRelaysMap[author]?.length ? followsRelaysMap[author] : feedRelays

      let usePurple = feedStore.isFollowsSource && followsRelaysMap[author]?.length && relays.includes(PURPLEPAG_RELAY_URL)
      let metasPromise = null
      let metaAuthorPromise = null

      const allPubkeysToGet = getNoteReferences(post)
      if (!usePurple && !allPubkeysToGet.includes(author)) {
        allPubkeysToGet.push(author)
      }

      if (usePurple && !cachedMetasPubkeys.includes(author)) {
        cachedMetasPubkeys.push(author)
        metaAuthorPromise = pool.get([PURPLEPAG_RELAY_URL], { kinds: [0], authors: [author] })
      }

      // cache used later for already downloaded authors
      const pubkeysForRequest: string[] = []
      allPubkeysToGet.forEach(pubkey => {
        if (!cachedMetasPubkeys.includes(pubkey)) {
          cachedMetasPubkeys.push(pubkey)
          pubkeysForRequest.push(pubkey)
        }
      })

      if (pubkeysForRequest.length) {
        metasPromise = pool.querySync(relays, { kinds: [0], authors: pubkeysForRequest })
      }

      const likesRepostsRepliesPromise = pool.querySync(relays, { kinds: [1, 6, 7], "#e": [post.id] })
      const postPromise = Promise.all([post, metasPromise, likesRepostsRepliesPromise, metaAuthorPromise])

      postPromises.push(postPromise)
    }
    
    eventsIds.clear()
    feedStore.updatePaginationEventsIds([])
    feedStore.updateEvents([])

    for (const promise of postPromises) {
      const result = await promise;
      const post = result[0]
      const metas = result[1] || []
      const likesRepostsReplies = result[2] || []
      let authorMeta = result[3]

      const referencesMetas: (Event | null)[] = []
      const refsPubkeys: string[] = []

      // cache author from purplepag too, if presented
      if (authorMeta) {
        cachedMetas[authorMeta.pubkey] = authorMeta
        referencesMetas.push(authorMeta)
        refsPubkeys.push(authorMeta.pubkey)
      }

      const filteredMetas = filterMetas(metas)
      filteredMetas.forEach((meta) => {
        const ref: Event = meta
        cachedMetas[meta.pubkey] = meta
        referencesMetas.push(ref)
        refsPubkeys.push(ref.pubkey)
        if (meta.pubkey === post.pubkey) {
          authorMeta = meta
        }
      })

      cachedMetasPubkeys.forEach((pubkey) => {
        if (refsPubkeys.includes(pubkey)) return
        if (!cachedMetas.hasOwnProperty(pubkey)) {
          cachedMetas[pubkey] = null
        }
        const ref = cachedMetas[pubkey]
        referencesMetas.push(ref)
        if (pubkey === post.pubkey) {
          authorMeta = ref
        }
      })

      // inject references to notes here
      injectReferencesToNote(post as EventExtended, referencesMetas)
      injectAuthorsToNotes([post], [authorMeta])
      injectRootLikesRepostsRepliesCount(post, likesRepostsReplies)

      feedStore.pushToEvents(post as EventExtended)
      
      if (feedStore.isLoadingFeedSource) {
        feedStore.setLoadingFeedSourceStatus(false)
        feedStore.setLoadingMoreStatus(true)
      }
    }

    feedStore.setLoadingMoreStatus(false)
    
    posts.forEach((e: Event) => {
      eventsIds.add(e.id)
      feedStore.pushToPaginationEventsIds(e.id)
    })

    relayStore.setConnectionToRelayStatus(false)
    // if (changeFeedSource) {
    //   feedStore.setLoadingFeedSourceStatus(false)
    // }

    let subscribePostsFilter: Filter = { kinds: [1], limit: 1 }
    if (followsPubkeys.length) {
      subscribePostsFilter.authors = followsPubkeys
    }
    relaysSub = pool.subscribeMany(
      feedRelays, 
      [subscribePostsFilter], 
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
    if (feedStore.isLoadingNewEvents) return
    feedStore.setLoadingNewEventsStatus(true)

    const relays = relayStore.connectedFeedRelaysUrls
    if (!relays.length) return;

    router.push({ path: `${route.path}` })

    let eventsToShow = feedStore.newEventsToShow
    feedStore.updateNewEventsToShow(feedStore.newEventsToShow.filter((item: ShortPubkeyEvent) => !eventsToShow.includes(item)))

    const ids = eventsToShow.map((e: ShortPubkeyEvent) => e.id)
    const limit = DEFAULT_EVENTS_COUNT;

    feedStore.updatePaginationEventsIds(feedStore.paginationEventsIds.concat(ids))
    const firstPageIds = feedStore.paginationEventsIds.slice(-limit)

    const postsEvents = await pool.querySync(relays, { ids: firstPageIds })
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

    posts.forEach((e: Event) => eventsIds.add(e.id))
    posts = posts.sort((a, b) => b.created_at - a.created_at)

    // update view
    feedStore.updateEvents(posts as EventExtended[])
    feedStore.setShowNewEventsBadge(false)
    feedStore.setLoadingNewEventsStatus(false)

    logHtmlParts([
      { type: 'text', value: `loaded ${eventsToShow.length}` },
      { type: 'text', value: ' new event(s) from ' },
      { type: 'bold', value: relayStore.connectedFeedRelaysPrettyStr }
    ])
  }

  const broadcastEvent = async (event: Event, type: string) => {
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

        const connectedRelayUrl = relayStore.currentRelay.url
        if (!await isWsAvailable(connectedRelayUrl)) {
          isError = true
          error += `${connectedRelayUrl}`
        }

        if (isError) {
          error += `. Relays are unavailable or you are offline.`
          jsonErr.value = error
          isSendingMessage.value = false
          return
        }
      }

      writeRelays = [relayStore.currentRelay.url, ...connectedJsonRelays]
      writeRelays = [...new Set(writeRelays)] // make unique
    }

    if (isSendingMessage.value) return
    isSendingMessage.value = true

    const relaysToWatch = relayStore.connectedUserReadRelayUrls
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
      // @ts-ignore
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
    relay.close()
    relaysSub?.close()
    // pool.close(relayStore.userReadWriteRelaysUrls)
    
    relayStore.setConnectedUserReadRelayUrls([])
    relayStore.setConnectedFeedRelayUrls([])
    relayStore.setReedRelays([])
    relayStore.setWriteRelays([])

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
    @handleRelayConnect="handleRelayConnect"
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

  @media (min-width: 375px) {
    .tabs {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  @media (min-width: 450px) {
    .tabs {
      display: block;
    }
  }

  .tab-link {
    display: inline-block;
    color: #0092bf;
    text-decoration: none;
    cursor: pointer;
  }

  @media (min-width: 450px) {
    .tab-link {
      margin-right: 15px;
    }
  }
  
  .tab-link:hover {
    text-decoration: underline;
  }

  .tab-link.router-link-active {
    text-decoration: underline;
  }
</style>
