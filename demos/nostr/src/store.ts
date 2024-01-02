import { reactive } from 'vue'
import { SimplePool, type Event} from 'nostr-tools'
import type { Author, EventExtended } from './types'

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

export const initialUrlNpub = reactive({
  value: '',
  update(npub: string) {
    this.value = npub
  }
})

export const cachedUrlNpub = reactive({
  value: '',
  update(npub: string) {
    this.value = npub
  }
})

export const cachedNpub = reactive({
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

export const cachedNsec = reactive({
  value: '',
  update(nsec: string) {
    this.value = nsec
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

export const currentTab = reactive({
  value: 'feed',
  update(value: string) {
    this.value = value
  }
})

export const pool = reactive({
  value: new SimplePool({ getTimeout: 5600 })
})