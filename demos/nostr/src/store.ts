import { reactive } from 'vue'
import { SimplePool, type Event, type Relay, type Sub} from 'nostr-tools'
import type { Author, EventExtended, ShortPubkeyEvent } from './types'

export const userNotesEvents = reactive({
  value: <EventExtended[]>([]),
  update(events: EventExtended[]) {
    this.value = events
  },
  toggleRawData(id: string) {
    const event = this.value.find(e => e.id === id)
    if (event) {
      event.showRawData = !event.showRawData
    }
  }
})

export const userNotesEventsIds = reactive({
  value: <string[]>([]),
  update(value: string[]) {
    this.value = value
  }
})

export const userEvent = reactive({
  value: <Event>{},
  update(event: Event) {
    this.value = event
  }
})

export const userDetails = reactive({
  value: <Author>{},
  update(details: Author) {
    this.value = details
  },
  updateFollowersCount(count: number) {
    this.value.followersCount = count
  },
  updateFollowingCount(count: number) {
    this.value.followingCount = count
  }
})

export const cachedUrlNpub = reactive({
  value: '',
  update(npub: string) {
    this.value = npub
  }
})

export const npub = reactive({
  value: '',
  update(npub: string) {
    this.value = npub
  }
})

export const isRoutingUser = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const gettingUserInfoId = reactive({
  value: 1,
  update(value: number) {
    this.value = value
  }
})

export const isUserHasValidNip05 = reactive({
  value: false,
  update(isValid: boolean) {
    this.value = isValid
  }
})

export const isUsingFallbackSearch = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const isConnectingToRelay = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const connectedRelayUrl = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const connectedRelayUrls = reactive({
  value: <string[]>([]),
  update(value: string[]) {
    this.value = value
  }
})

export const selectedRelay = reactive({
  value: '',
  update(relay: string) {
    this.value = relay
  },
})

export const showImages = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const nsec = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const isRememberedUser = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const customRelayUrl = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const eventPool = reactive({
  value: new SimplePool({ getTimeout: 5600 })
})

export const currentRelay = reactive({
  value: <Relay>{},
  update(value: Relay) {
    this.value = value
  }
})

export const feedEvents = reactive({
  value: <EventExtended[]>([]),
  update(events: EventExtended[]) {
    this.value = events
  },
  toggleRawData(id: string) {
    const event = this.value.find(e => e.id === id)
    if (event) {
      event.showRawData = !event.showRawData
    }
  }
})

// generated from priv key and used for signing event
// and to higlighting events which belong to user
export const pubkeyFromPrivate = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const relaysFeedPool = reactive({
  value: new SimplePool({ getTimeout: 5600 })
})

export const showNewEventsBadgeFeed = reactive({
  value: false,
  update(value: boolean) {
    this.value = value
  }
})

export const newEventsBadgeImageUrlsFeed = reactive({
  value: <string[]>([]),
  update(value: string[]) {
    this.value = value
  }
})

export const newEventsBadgeCountFeed = reactive({
  value: 0,
  update(value: number) {
    this.value = value
  }
})

export const newEventsFeed = reactive({
  value: <ShortPubkeyEvent[]>([]),
  update(value: ShortPubkeyEvent[]) {
    this.value = value
  },
  push(value: ShortPubkeyEvent) {
    this.value.push(value)
  }
})

export const paginationEventsIdsFeed = reactive({
  value: <string[]>([]),
  update(value: string[]) {
    this.value = value
  },
  push(value: string) {
    this.value.push(value)
  }
})

export const messageToBroadcastFeed = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const additionalRelaysCountSignedEvent = reactive({
  value: 0,
  update(value: number) {
    this.value = value
  }
})

export const additionalRelaysUrlsSignedEvent = reactive({
  value: <string[]>([]),
  update(value: string[]) {
    this.value = value
  },
  updateRelay(index: number, value: string) {
    this.value[index] = value
  }
})

export const signedJsonFeed = reactive({
  value: '',
  update(value: string) {
    this.value = value
  }
})

export const userPool = reactive({
  value: new SimplePool({ getTimeout: 5600 })
})