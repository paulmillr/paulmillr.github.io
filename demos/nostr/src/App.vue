<script setup lang="ts">
  import { onBeforeMount, ref } from 'vue'
  import {
    relayInit,
    getPublicKey,
    getEventHash,
    signEvent,
    nip19,
    nip10,
    SimplePool,
    parseReferences,
    type Sub,
    type Relay,
    type Event,
    type Filter
  } from 'nostr-tools'

  import type { EventExtended, LogContentPart } from './types'
  import { updateUrlHash, isWsAvailable, normalizeUrl } from './utils'
  import User from './components/User.vue'
  import RelayEventsList from './components/RelayEventsList.vue'
  import HeaderFields from './components/HeaderFields.vue'
  import Help from './components/Help.vue'
  import RelayLog from './components/RelayLog.vue'
  import TabLink from './components/TabLink.vue'

  import { DEFAULT_EVENTS_COUNT } from './app'
  import { 
    initialUrlNpub, 
    cachedUrlNpub, 
    isConnectingToRelay,
    connectedRelayUrl,
    connectedRelayUrls,
    selectedRelay,
    showImages,
    nsec,
    isRememberedUser,
    customRelayUrl,
    currentTab
  } from './store'

  const currentPath = ref(window.location.hash)

  let relaySub: Sub;
  let curInterval: number;

  const currentRelay = ref<Relay>()

  const isRemembered = localStorage.getItem('rememberMe') === 'true'
  isRememberedUser.update(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsec.update(initialNsec || '')

  // events in feed
  const events = ref<EventExtended[]>([])
  const eventsIds = new Set()
  const sentEventIds = new Set()

  const message = ref('')
  const pubKey = ref('')
  const signedJson = ref('')

  let newEvents = ref<{ id: string; pubkey: string; }[]>([]);
  const paginationEventsIds = ref<string[]>([]);
  const currentPage = ref(1);
  const pagesCount = ref(1);

  let showNewEventsBadge = ref(false)
  let newEventsBadgeCount = ref(0)
  let newAuthorImg1 = ref('');
  let newAuthorImg2 = ref('');

  const eventsLog = ref<LogContentPart[][]>([]);

  const tabs = ['feed', 'user', 'message', 'log', 'help']

  const wsError = ref('')
  const msgErr = ref('')
  const jsonErr = ref('')
  const isSendingMessage = ref(false)

  const additionalRelaysUrls = ref<string[]>([])
  const additionalRelaysCount = ref(0) 

  // it's a counter to always trigger updating of Help component for scrolling to privacy section
  const showPrivacySection = ref(0)

  // runs once on app start
  onBeforeMount(async () => {
    if (isEmptyHash()) return

    for (const tab of tabs) {
      if (hashContains(tab)) {
        return await initializeTab(tab)
      }
    }
  })

  const hashContains = (str: string) => {
    return currentPath.value.indexOf(str) > -1
  }

  const isEmptyHash = () => {
    return currentPath.value.length === 0
  }

  const handlePrivacyClick = async () => {
    currentTab.update('help')
    showPrivacySection.value = showPrivacySection.value + 1
  }

  const initializeTab = async (tab: string) => {
    if (tab === 'log') {
      return route('feed')
    }

    currentTab.update(tab)
    
    if (!['help', 'user'].includes(tab)) return

    const hash = currentPath.value.slice(2)
    if (!hash?.length) return
    const hashValue = hash.split('=')[1]
    if (!hashValue?.length) return

    if (tab === 'user') {
      initialUrlNpub.update(hashValue)
    }
    
    if (tab === 'help' && hashValue === 'privacy') {
      await handlePrivacyClick()
    }
  }

  const route = (tab: string) => {
    currentTab.update(tab)
    if (tab === 'user' && cachedUrlNpub.value.length) {
      updateUrlHash(`#?user=${cachedUrlNpub.value}`)
    } else if (tab === 'log') {
      // only on mobile devices log is a separate tab
      updateUrlHash('feed')
    } else if (tab == 'help') {
      showPrivacySection.value = 0
      updateUrlHash(tab)
    } else {
      updateUrlHash(tab)
    }
  }

  const showFeedPage = async (page: number) => {
    const relay = currentRelay.value
    if (!relay) return

    const limit = DEFAULT_EVENTS_COUNT
    const start = (page - 1) * limit
    const end = start + limit

    const reversedIds = paginationEventsIds.value.slice().reverse()
    const idsToShow = reversedIds.slice(start, end)

    const postsEvents = await relay.list([{ ids: idsToShow }]);
    let posts = await injectAuthorsToNotes(postsEvents)
    posts = await injectLikesToNotes(posts)
    posts = await injectRepostsToNotes(posts)
    posts = await injectReferencesToNotes(posts)

    events.value = posts as EventExtended[]
    currentPage.value = page
  }

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
    
    const eventsToShow = newEvents.value
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

    newEventsBadgeCount.value = eventsToShow.length
    showNewEventsBadge.value = true
  }

  const injectAuthorsToNotes = async (postsEvents: Event[]) => {
    const relay = currentRelay.value
    if (!relay) return postsEvents;

    const authors = postsEvents.map((e: Event) => e.pubkey)
    const authorsEvents = await relay.list([{ kinds: [0], authors }])

    if (!authorsEvents.length) return postsEvents;

    const postsWithAuthor: Event[] = [];
    postsEvents.forEach(pe => {
      let isAuthoAddedToPost = false;
      authorsEvents.forEach(ae => {
        if (pe.pubkey === ae.pubkey) {
          const tempEventWithAuthor = pe as EventExtended
          tempEventWithAuthor.author = JSON.parse(ae.content)
          tempEventWithAuthor.authorEvent = ae
          postsWithAuthor.push(pe)
          isAuthoAddedToPost = true
        }
      })
      // keep post in the list of posts even if author is not found
      if (!isAuthoAddedToPost) {
        postsWithAuthor.push(pe)
      }
    })

    return postsWithAuthor;
  }

  const isLike = (content: string) => {
    if (["-", "👎"].includes(content)) {
      return false
    }
    return true
  }

  const injectLikesToNotes = async (postsEvents: Event[], fallbackRelays: string[] = []) => {
    const relay = currentRelay.value
    if (!relay) return postsEvents
    
    const postsIds = postsEvents.map((e: Event) => e.id)

    let likeEvents: Event[] = []
    if (fallbackRelays.length) {
      const pool = new SimplePool({ getTimeout: 5600 })
      likeEvents = await pool.list(fallbackRelays, [{ kinds: [7], "#e": postsIds }])
    } else {
      likeEvents = await relay.list([{ kinds: [7], '#e': postsIds }])
    }

    const postsWithLikes: Event[] = [];
    postsEvents.forEach(postEvent => {
      let likes = 0
      likeEvents.forEach(likedEvent => {
        const likedEventId = likedEvent.tags.reverse().find((tag: Array<string>) => tag[0] === 'e')?.[1]
        if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
          likes++
        }
      })
      const tempEvent = postEvent as EventExtended
      tempEvent.likes = likes
      postsWithLikes.push(tempEvent)
    })

    return postsWithLikes
  }

  const injectRepostsToNotes = async (postsEvents: Event[], fallbackRelays: string[] = []) => {
    const relay = currentRelay.value
    if (!relay) return postsEvents

    const postsIds = postsEvents.map((e: Event) => e.id)

    let repostEvents: Event[] = []
    if (fallbackRelays.length) {
      const pool = new SimplePool({ getTimeout: 5600 })
      repostEvents = await pool.list(fallbackRelays, [{ kinds: [6], "#e": postsIds }])
    } else {
      repostEvents = await relay.list([{ kinds: [6], '#e': postsIds }])
    }

    const postsWithReposts: Event[] = [];
    postsEvents.forEach(postEvent => {
      let reposts = 0
      repostEvents.forEach(repostEvent => {
        const repostEventId = repostEvent.tags.find((tag: Array<string>) => tag[0] === 'e')?.[1]
        if (repostEventId && repostEventId === postEvent.id) {
          reposts++
        }
      })
      const tempEvent = postEvent as EventExtended
      tempEvent.reposts = reposts
      postsWithReposts.push(tempEvent)
    })

    return postsWithReposts
  }

  const injectReferencesToNotes = async (postsEvents: Event[], fallbackRelays: string[] = []) => {
    const eventsWithReferences: EventExtended[] = [];
    const relay = currentRelay.value
    if (!relay) return postsEvents

    let isFallback = false
    let pool: SimplePool | undefined
    if (fallbackRelays.length) {
      pool = new SimplePool({ getTimeout: 5600 })
      isFallback = true
    }

    for (const event of postsEvents) {
      const extendedEvent = event as EventExtended

      if (!contentHasMentions(event.content)) {
        extendedEvent.references = []
        eventsWithReferences.push(extendedEvent)
        continue
      }

      let references = parseReferences(event)

      const referencesToInject = []
      for (let i = 0; i < references.length; i++) {
        let { profile } = references[i]
        if (!profile) continue
        
        let meta;
        if (isFallback && pool) {
          meta = await pool.get(fallbackRelays, { kinds: [0], limit: 1, authors: [profile.pubkey] })
        } else {
          meta = await relay.get({ kinds: [0], limit: 1, authors: [profile.pubkey] })
        }

        const referencesWithProfile = references[i] as any
        referencesWithProfile.profile_details = JSON.parse(meta?.content || '{}');
        referencesToInject.push(referencesWithProfile)
      }

      extendedEvent.references = referencesToInject
      eventsWithReferences.push(extendedEvent)
    }

    return eventsWithReferences
  }

  const contentHasMentions = (content: string) => {
    return content.indexOf('nostr:npub') !== -1 || content.indexOf('nostr:nprofile1') !== -1
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
    if (currentRelay.value) {
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

    // open the feed while connecting from help tab
    if (currentTab.value === 'help') {
      route('feed')
    }

    currentRelay.value = relay;

    relay.on('connect', async () => {
      logHtmlParts([
        { type: 'text', value: 'connected to ' },
        { type: 'bold', value: relay.url }
      ])

      // hide new events element and clear it's values
      showNewEventsBadge.value = false
      newEvents.value = []

      const limit = DEFAULT_EVENTS_COUNT;
      // const postsEvents = await relay.list([{ kinds: [1], limit }])
      const postsEvents = await listRootEvents(relay, [{ kinds: [1], limit }]) as Event[]

      let posts = await injectAuthorsToNotes(postsEvents)
      posts = await injectLikesToNotes(posts)
      posts = await injectRepostsToNotes(posts)
      posts = await injectReferencesToNotes(posts)

      eventsIds.clear()
      posts.forEach((e: Event) => {
        eventsIds.add(e.id);
        paginationEventsIds.value.push(e.id);
      })
      events.value = posts as EventExtended[]

      connectedRelayUrl.update(isCustom ? 'custom' : relayUrl)
      connectedRelayUrls.update([relayUrl]) // further it can be an array of a few relays
      isConnectingToRelay.update(false)

      relaySub = relay.sub([{ kinds: [1], limit: 1 }])
      relaySub.on('event', (event: Event) => {
        if (eventsIds.has(event.id)) return;
        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) return;
        newEvents.value.push({ id: event.id, pubkey: event.pubkey })
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

    let eventsToShow = newEvents.value;
    newEvents.value = newEvents.value.filter(item => !eventsToShow.includes(item));

    const ids = eventsToShow.map(e => e.id)
    const limit = DEFAULT_EVENTS_COUNT;

    paginationEventsIds.value = paginationEventsIds.value.concat(ids)
    const firstPageIds = paginationEventsIds.value.slice(-limit)

    pagesCount.value = Math.ceil(paginationEventsIds.value.length / limit)
    currentPage.value = 1

    const postsEvents = await relay.list([{ ids: firstPageIds }]);
    let posts = await injectAuthorsToNotes(postsEvents)
    posts = await injectLikesToNotes(posts)
    posts = await injectRepostsToNotes(posts)
    posts = await injectReferencesToNotes(posts)

    // update view
    posts.forEach((e: Event) => eventsIds.add(e.id))
    events.value = posts as EventExtended[]

    showNewEventsBadge.value = false

    logHtmlParts([
      { type: 'text', value: `loaded ${eventsToShow.length}` },
      { type: 'text', value: ' new event(s) from ' },
      { type: 'bold', value: relay.url }
    ])
  }

  const handleSendMessage = async () => {
    const nsecValue = nsec.value ? nsec.value.trim() : ''
    if (!nsecValue.length) {
      msgErr.value = 'Please provide your private key or generate random key.'
      return;
    }

    const messageValue = message.value.trim()
    if (!messageValue.length) {
      msgErr.value = 'Please provide message to broadcast.'
      return;
    }

    let privKey: string;
    try {
      const { data } = nip19.decode(nsecValue)
      privKey = data as string
      pubKey.value = getPublicKey(privKey)
    } catch (e) {
      msgErr.value = `Invalid private key. Please check it and try again.`
      return;
    }

    const relay = currentRelay.value
    if (!relay || relay.status !== 1) {
      msgErr.value = 'Please connect to relay first.'
      return;
    }

    const event = {
      kind: 1,
      pubkey: pubKey.value,
      created_at: Math.floor(Date.now() / 1000),
      content: messageValue,
      tags: [],
      id: '',
      sig: ''
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, privKey)

    if (sentEventIds.has(event.id)) {
      msgErr.value = 'The same event can\'t be sent twice (same id, signature).'
      return;
    }

    msgErr.value = ''

    await broadcastEvent(event, 'text')
  }

  const handleSendSignedEvent  = async () => {
    if (!signedJson.value.length) {
      jsonErr.value = 'Provide signed event.'
      return;
    }

    let event;
    try {
      event = JSON.parse(signedJson.value)
    } catch (e) {
      jsonErr.value = 'Invalid JSON. Please check it and try again.'
      return;
    }

    const relay = currentRelay.value
    if (!relay || relay.status !== 1) {
      jsonErr.value = 'Please connect to relay first.'
      return;
    }

    jsonErr.value = ''

    await broadcastEvent(event, 'json')
  }

  const broadcastEvent = async (event: Event, type: string) => {
    const relay = currentRelay.value
    if (!relay) return
    if (isSendingMessage.value) return

    isSendingMessage.value = true
    
    clearInterval(curInterval)

    const userNewEventOptions = [{ kinds: [1], authors: [pubKey.value], limit: 1 }]
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

    const rawAdditionalUrls = additionalRelaysUrls.value
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

    const pool = new SimplePool({ getTimeout: 5600 })
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
        if (type === 'text') message.value = ''
        if (type === 'json') signedJson.value = ''
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
    newEvents.value = []

    connectedRelayUrl.update('')
    connectedRelayUrls.update([])
    relaySub.unsub()
    relay.close()

    logHtmlParts([
      { type: 'text', value: 'disconnected from ' },
      { type: 'bold', value: relay.url }
    ])
  }

  const handleToggleRawData = (eventId: string) => {
    const event = events.value.find(e => e.id === eventId)
    if (event) {
      event.showRawData = !event.showRawData
    }
  }

  const handleClickAddNewField = () => {
    additionalRelaysCount.value++
  }
</script>

<template>
  <HeaderFields 
    @relayConnect="handleRelayConnect" 
    @relayDisconnect="handleRelayDisconnect" 
    @handlePrivacyClick="handlePrivacyClick"
    :wsError="wsError"
  />

  <div class="tabs">
    <TabLink @click="route('feed')" :isActive="currentTab.value === 'feed'">
      Feed
    </TabLink>
    <TabLink @click="route('user')" :isActive="currentTab.value === 'user'">
      Search
    </TabLink>
    <TabLink @click="route('message')" :isActive="currentTab.value === 'message'">
      Broadcast
    </TabLink>
    <TabLink @click="route('help')" :isActive="currentTab.value === 'help'">
      Help
    </TabLink>
    <TabLink @click="route('log')" :isActive="currentTab.value === 'log'">
      Log
    </TabLink>
  </div>

  <!-- Message input -->
  <div v-if="currentTab.value === 'feed'" class="message-fields-wrapper">
    <div class="message-fields">
      <div class="message-fields__field">
        <label for="message">
          <strong>Message to broadcast</strong>
        </label>
        <div class="field-elements">
          <textarea
            class="message-input"
            name="message"
            id="message"
            cols="30"
            rows="3"
            v-model="message"
            placeholder='Test message 👋'></textarea>
        </div>
        <div class="send-btn-wrapper">
          <button class="send-btn" @click="handleSendMessage">
            {{ isSendingMessage ? 'Broadcasting...' : 'Broadcast' }}
          </button>
        </div>
      </div>
    </div>
    <div class="error">
      {{ msgErr }}
    </div>
  </div>

  <!-- Signed event -->
  <div v-if="currentTab.value === 'message'" class="message-fields-wrapper">
    <div class="signed-message-desc">
      <p class="signed-message-desc_p">
        Event should be signed with your private key in advance. Event will be broadcasted to a selected relay.
        More details about events and signatures are <a target="_blank" href="https://github.com/nostr-protocol/nips/blob/master/01.md#events-and-signatures">here</a>.
      </p>
      <p class="signed-message-desc_p">
        Event will be broadcasted to a selected relay. 
        You can add more relays to retransmit the event.
        <br>
  
        <button class="additional-relay-btn" @click="handleClickAddNewField">
          Add relay
        </button>

        <div v-if="additionalRelaysCount > 0" class="additional-relays">
          <div class="additional-relay-field">
            <span>1.</span>
            <input 
              readonly 
              :value="currentRelay?.url ? `${currentRelay?.url} (already selected)` : 'Firstly connect to default relay'" 
              type="text"
            >
          </div>
          <div v-for="i in additionalRelaysCount">
            <div class="additional-relay-field">
              <span>{{ i + 1 }}.</span>
              <input v-model="additionalRelaysUrls[i]" placeholder="[wss://]relay.example.com" type="text">
            </div>
          </div>
        </div>
      </p>
    </div> 

    <div class="message-fields__field_sig">
      <label class="message-fields__label" for="signed_json">
        <strong>JSON of a signed event</strong>
      </label>
      <div class="field-elements">
        <textarea
        class="signed-json-textarea"
        name="signed_json"
        id="signed_json"
        cols="30"
        rows="5"
        v-model="signedJson"
        placeholder='{"kind":1,"pubkey":"5486dbb083512982669fa180aa02d722ce35054233cea724061fbc5f39f81aa3","created_at":1685664152,"content":"Test message 👋","tags":[],"id":"89adae408121ba6d721203365becff4d312292a9dd9b7a35ffa230a1483b09a2","sig":"b2592ae88ba1040c928e458dd6822413f148c8cc4f478d992e024e8c9d9648b96e6ce6dc564ab5815675007f824d9e9f634f8dbde554afeb6e594bcaac4389dd"}'></textarea>
      </div>
    </div>
    <div class="signed-json-btn-wrapper">
      <div class="error">
        {{ jsonErr }}
      </div>
      <button class="send-btn send-btn_signed-json" @click="handleSendSignedEvent">
        {{ isSendingMessage ? 'Broadcasting...' : 'Broadcast' }}
      </button>
    </div>
  </div>

  <!-- Relay feed -->
  <div id="feed" v-if="currentTab.value === 'feed' || currentTab.value === 'message' || currentTab.value === 'log'">
    <div class="columns">
      <div :class="['events', { 'd-md-none': currentTab.value === 'log' }]">
        <div class="connecting-notice" v-if="isConnectingToRelay.value">
          Loading {{ currentRelay ? 'new' : '' }} relay feed...
        </div>

        <div @click="loadNewRelayEvents" v-if="showNewEventsBadge" class="new-events">
          <div v-if="showImages.value" class="new-events__imgs">
            <img class="new-events__img" :src="newAuthorImg1" alt="img">
            <img class="new-events__img" :src="newAuthorImg2" alt="img">
          </div>
          <span class="new-events__text">{{ newEventsBadgeCount }} new notes</span>
          <b class="new-events__arrow">↑</b>
        </div>

        <RelayEventsList
          :events="events"
          :pubKey="pubKey"
          :showImages="showImages.value"
          @toggleRawData="handleToggleRawData"
          :currentRelays="connectedRelayUrls.value"
        />

        <div v-if="pagesCount > 1" class="pagination">
          Pages: 
          <span v-if="pagesCount < 5">
            <a @click="showFeedPage(page)" :class="['pagination__link', { 'pagination__link_active': currentPage == page }]" v-for="page in pagesCount" :href="`#feed`">
              {{ page }}
            </a>
          </span>
          <span v-if="pagesCount >= 5">
            <a v-if="currentPage >= 3" @click="showFeedPage(1)" :class="['pagination__link']" :href="`#feed`">
              1
            </a>
            <span v-if="currentPage > 3">...</span>

            <a v-if="currentPage != 1" @click="showFeedPage(currentPage - 1)" :class="['pagination__link']" :href="`#feed`">
              {{ currentPage - 1 }}
            </a>
            <a @click="showFeedPage(currentPage)" :class="['pagination__link pagination__link_active']" :href="`#feed`">
              {{ currentPage }}
            </a>
            <a v-if="currentPage != pagesCount" @click="showFeedPage(currentPage + 1)" :class="['pagination__link']" :href="`#feed`">
              {{ currentPage + 1 }}
            </a>

            <span v-if="currentPage < (pagesCount - 2)">...</span>

            <a v-if="currentPage <= (pagesCount - 2)" @click="showFeedPage(pagesCount)" :class="['pagination__link']" :href="`#feed`">
              {{ pagesCount }}
            </a>
          </span>
        </div>
      </div>

      <div :class="['log-wrapper', { 'd-md-none': currentTab.value !== 'log' }]">
        <RelayLog :eventsLog="eventsLog" />
      </div>
    </div>
  </div>

  <!-- User -->
  <div v-if="currentTab.value === 'user'">
    <User
      :currentRelay="(currentRelay as Relay)"
      :showImages="showImages.value"
      :handleRelayConnect="handleRelayConnect"
      :injectLikesToNotes="injectLikesToNotes"
      :injectRepostsToNotes="injectRepostsToNotes"
      :injectReferencesToNotes="injectReferencesToNotes"
    />
  </div>

  <!-- Help -->
  <div v-if="currentTab.value === 'help'">
    <Help :showPrivacy="showPrivacySection" />
  </div>
</template>

<style scoped>
  .additional-relays {
    margin-top: 5px;    
  }
  .additional-relay-field {
    display: flex;
    align-items: center;
  }

  .additional-relay-field input {
    width: 100%; 
    box-sizing: border-box;
    margin-left: 5px;
  }

  .additional-relay-btn {
    cursor: pointer;
  }

  .message-fields__label {
    display: flex;
    align-items: center;
  }

  .error {
    color:red;
    font-size: 16px;
    margin-top: 5px;
  }

  .d-md-none {
    display: none;
  }

  @media (min-width: 768px) {
    .d-md-none {
      display: initial;
    }
  }

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

  .columns {
    display: flex;
  }

  .message-fields-wrapper {
    margin-bottom: 20px;
  }

  .message-fields {
    display: flex;
    flex-wrap: wrap;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .message-fields {
      flex-direction: row;
    }
  }

  .message-fields__field {
    flex-grow: 1;
    margin-bottom: 10px
  }

  @media (min-width: 768px) {
    .message-fields__field {
      margin-bottom: 0;
    }
  }

  @media (min-width: 768px) {
    .message-fields__field_sig {
      margin-bottom: 5px;
    }
  }

  .message-fields__field_sig input {
    margin-right: 0;
  }

  .events {
    width: 100%;
    position: relative;
  }

  @media (min-width: 768px) {
    .events {
      width: 68%;
      min-width: 68%;
      margin-right: 2%;
    }
  }

   @media (min-width: 1024px) {
    .events {
      width: 685px;
      min-width: 685px;
      margin-right: 2%;
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

  .message-input {
    font-size: 16px;
    padding: 1px 3px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .message-input {
      font-size: 15px;
    }
  }

  .send-btn-wrapper {
    text-align: right;
  }

  .send-btn {
    font-size: 14px;
    width: 100%;
    margin-top: 5px;
    cursor: pointer;
  }

  .send-btn_signed-json {
    margin-top: 5px;
  }

  @media (min-width: 768px) {
    .send-btn {
      width: auto;
    }
  }

  .signed-json-textarea {
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .signed-json-textarea{
      font-size: 15px;
    }
  }

  .signed-message-desc {
    margin-bottom: 15px;
  }

  .signed-message-desc_p {
    margin-top: 15px;
    margin-bottom: 0;
  }

  .signed-json-btn-wrapper {
    display: flex;
    flex-direction: column-reverse;
    justify-content: space-between;
    align-items: start;
  }

  @media (min-width: 768px) {
    .signed-json-btn-wrapper {
      flex-direction: row;
    }
  }

  .signed-json-btn-wrapper .error {
    line-height: 1;
    margin-top: 0;
    margin-bottom: 5px;
    margin-top: 5px;
  }

  @media (min-width: 768px) {
    .signed-json-btn-wrapper .error {
       margin-top: 0;
    }
  }

  .pagination__link {
    margin-left: 5px;
  }

  .pagination__link_active {
    color:#3aa99f;
  }
</style>
