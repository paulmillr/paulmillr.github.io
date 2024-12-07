import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { utils, type Relay } from 'nostr-tools'
import type { TypedRelay } from '@/types'

// For all relay addresses we apply normalizeURL to make sure it's a valid URL

const { normalizeURL } = utils

export const useRelay = defineStore('relay', () => {
  // relay from the select field
  const currentRelay = ref(<Relay>{})
  const isConnectingToRelay = ref(false) // TODO: remove this
  const selectInputRelayUrl = ref('')
  const selectInputCustomRelayUrl = ref('')

  // custom relay for the signed event form
  const additionalRelaysCountForSignedEvent = ref(0)
  const additionalRelaysUrlsForSignedEvent = ref<string[]>([])

  // user relays from nip 65 (relay list metadata, kind:10002)
  // values are being changed on login and on settings pages
  const connectedUserReadRelayUrls = ref<string[]>([])
  const connectedUserWriteRelaysUrls = ref<string[]>([])
  const readRelays = ref<string[]>([])
  const writeRelays = ref<string[]>([])

  const isConnectingToReadWriteRelays = ref(false)
  const isConnectedToReadWriteRelays = ref(false)

  // user relays or follows relays
  const connectedFeedRelaysUrls = ref<string[]>([])

  // chat
  const userDMRelaysUrls = ref<string[]>([])

  const userReadWriteRelays = computed(() => {
    const unique = new Set([...readRelays.value, ...writeRelays.value])
    const read: TypedRelay[] = []
    const write: TypedRelay[] = []

    unique.forEach((r) => {
      if (readRelays.value.includes(r) && !writeRelays.value.includes(r)) {
        read.push({ url: r, type: 'read' })
      } else {
        write.push({ url: r, type: 'write' })
      }
    })
    return [...read, ...write].sort((a, b) => a.url.localeCompare(b.url))
  })

  const connectedUserReadWriteUrlsWithSelectedRelay = computed(() => {
    const urls = new Set([
      ...connectedUserReadRelayUrls.value,
      ...connectedUserWriteRelaysUrls.value,
    ])
    if (currentRelay.value.connected) {
      urls.add(currentRelay.value.url)
    }
    return [...urls]
  })

  const userChatRelaysUrls = computed(() => {
    return userDMRelaysUrls.value.length
      ? userDMRelaysUrls.value
      : connectedUserReadWriteUrlsWithSelectedRelay.value
  })

  const userReadWriteRelaysUrls = computed(() => userReadWriteRelays.value.map((r) => r.url))

  const allRelaysUrlsWithSelectedRelay = computed(() => {
    const connected = currentRelay.value.url
    const userRelays = userReadWriteRelaysUrls.value
    return userRelays.includes(connected) ? userRelays : [connected, ...userRelays]
  })

  const connectedUserReadRelayUrlsWithSelectedRelay = computed(() => {
    const relays = connectedUserReadRelayUrls.value
    const curRelay = currentRelay.value
    if (curRelay.connected && !relays.includes(curRelay.url)) {
      relays.push(curRelay.url)
    }
    return relays
  })

  const nip65Tags = computed(() => {
    const read = readRelays.value
    const write = writeRelays.value
    const unique = new Set([...read, ...write])
    const tags: [string, string, string?][] = []
    unique.forEach((r) => {
      if (read.includes(r) && write.includes(r)) {
        tags.push(['r', r])
      } else if (read.includes(r)) {
        tags.push(['r', r, 'read'])
      } else if (write.includes(r)) {
        tags.push(['r', r, 'write'])
      }
    })
    return tags
  })

  const connectedFeedRelaysPrettyStr = computed(() => {
    return connectedFeedRelaysUrls.value
      .map((r) => r.replace('wss://', '').replace('/', ''))
      .join(', ')
  })

  const isConnectedToRelay = computed(() => {
    return currentRelay.value.connected
  })

  function updateCurrentRelay(value: Relay) {
    currentRelay.value = value
  }

  function setConnectionToRelayStatus(value: boolean) {
    isConnectingToRelay.value = value
  }

  function setConnectedUserReadRelayUrls(value: string[]) {
    connectedUserReadRelayUrls.value = value.map((r) => normalizeURL(r))
  }

  function addConnectedUserReadRelay(value: string) {
    const url = normalizeURL(value)
    if (!url) return
    if (connectedUserReadRelayUrls.value.includes(url)) return
    connectedUserReadRelayUrls.value.push(url)
  }

  function setConnectedUserWriteRelayUrls(value: string[]) {
    connectedUserWriteRelaysUrls.value = value.map((r) => normalizeURL(r))
  }

  // function setConnectedUserRead
  function setConnectedUserReadWriteRelays(value: { read: string[]; write: string[] }) {
    setConnectedUserReadRelayUrls(value.read)
    setConnectedUserWriteRelayUrls(value.write)
  }

  function addConnectedUserWriteRelay(value: string) {
    const url = normalizeURL(value)
    if (!url) return
    if (connectedUserWriteRelaysUrls.value.includes(url)) return
    connectedUserWriteRelaysUrls.value.push(url)
  }

  function removeConnectedUserWriteRelay(value: string) {
    connectedUserWriteRelaysUrls.value = connectedUserWriteRelaysUrls.value.filter(
      (r) => r !== value,
    )
  }

  function setConnectedFeedRelayUrls(value: string[]) {
    connectedFeedRelaysUrls.value = value.map((r) => normalizeURL(r))
  }

  function setReadRelays(value: string[]) {
    readRelays.value = value.map((r) => normalizeURL(r))
  }

  function setWriteRelays(value: string[]) {
    writeRelays.value = value.map((r) => normalizeURL(r))
  }

  function setReadWriteRelays(value: { read: string[]; write: string[] }) {
    setReadRelays(value.read)
    setWriteRelays(value.write)
  }

  function addWriteRelay(value: string) {
    if (writeRelays.value.includes(value)) return
    writeRelays.value.push(normalizeURL(value))
  }

  function removeWriteRelay(value: string) {
    writeRelays.value = writeRelays.value.filter((r) => r !== value)
  }

  function addUserRelay(relay: string) {
    const url = normalizeURL(relay)
    if (!url) return false
    if (userReadWriteRelaysUrls.value.includes(url)) return false
    // new relays are always read relays, user can add write option manually
    readRelays.value.push(url)
  }

  function removeUserRelay(value: string) {
    readRelays.value = readRelays.value.filter((r) => r !== value)
    writeRelays.value = writeRelays.value.filter((r) => r !== value)
    connectedUserReadRelayUrls.value = connectedUserReadRelayUrls.value.filter((r) => r !== value)
    connectedUserWriteRelaysUrls.value = connectedUserWriteRelaysUrls.value.filter(
      (r) => r !== value,
    )
  }

  function setSelectedRelay(value: string) {
    selectInputRelayUrl.value = value === 'custom' ? 'custom' : normalizeURL(value)
  }

  function updateAdditionalRelaysCountForSignedEvent(value: number) {
    additionalRelaysCountForSignedEvent.value = value
  }

  function updateRelayAdditionalRelaysUrlsForSignedEvent(index: number, value: string) {
    additionalRelaysUrlsForSignedEvent.value[index] = value.length ? normalizeURL(value) : ''
  }

  function setReadWriteRelaysStatus(value: { connecting: boolean; connected: boolean }) {
    isConnectingToReadWriteRelays.value = value.connecting
    isConnectedToReadWriteRelays.value = value.connected
  }

  function setUserDMRelaysUrls(value: string[]) {
    userDMRelaysUrls.value = value.map((r) => normalizeURL(r))
  }

  function clear() {
    currentRelay.value = <Relay>{}
    connectedUserReadRelayUrls.value = []
    connectedUserWriteRelaysUrls.value = []
    readRelays.value = []
    writeRelays.value = []
    isConnectingToReadWriteRelays.value = false
    isConnectedToReadWriteRelays.value = false
    connectedFeedRelaysUrls.value = []
    userDMRelaysUrls.value = []
  }

  return {
    isConnectingToRelay,
    setConnectionToRelayStatus,
    connectedUserReadRelayUrls,
    setConnectedUserReadRelayUrls,
    selectInputRelayUrl,
    setSelectedRelay,
    selectInputCustomRelayUrl,
    currentRelay,
    updateCurrentRelay,
    additionalRelaysCountForSignedEvent,
    updateAdditionalRelaysCountForSignedEvent,
    additionalRelaysUrlsForSignedEvent,
    updateRelayAdditionalRelaysUrlsForSignedEvent,
    connectedFeedRelaysPrettyStr,
    readRelays,
    writeRelays,
    setReadRelays,
    setWriteRelays,
    isConnectedToRelay,
    userReadWriteRelays,
    removeWriteRelay,
    addWriteRelay,
    removeUserRelay,
    addUserRelay,
    nip65Tags,
    userReadWriteRelaysUrls,
    allRelaysUrlsWithSelectedRelay,
    connectedFeedRelaysUrls,
    setConnectedFeedRelayUrls,
    connectedUserReadRelayUrlsWithSelectedRelay,
    isConnectingToReadWriteRelays,
    setConnectedUserWriteRelayUrls,
    connectedUserWriteRelaysUrls,
    connectedUserReadWriteUrlsWithSelectedRelay,
    isConnectedToReadWriteRelays,
    userChatRelaysUrls,
    setUserDMRelaysUrls,
    clear,
    addConnectedUserReadRelay,
    addConnectedUserWriteRelay,
    removeConnectedUserWriteRelay,
    setReadWriteRelays,
    setReadWriteRelaysStatus,
    setConnectedUserReadWriteRelays,
  }
})
