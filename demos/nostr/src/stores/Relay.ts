import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { utils, type Relay } from 'nostr-tools'
import type { TypedRelay } from '@/types'

// For all relay addresses we apply normalizeURL to make sure it's a valid URL

const { normalizeURL } = utils

export const useRelay = defineStore('relay', () => {
  // relay from the select field
  const currentRelay = ref(<Relay>{})
  const isConnectingToRelay = ref(false)
  const selectInputRelayUrl = ref('')
  const selectInputCustomRelayUrl = ref('')

  // custom relay for the signed event form
  const additionalRelaysCountForSignedEvent = ref(0)
  const additionalRelaysUrlsForSignedEvent = ref<string[]>([])

  // user relays from nip 65 (relay list metadata, kind:10002)
  const connectedReedRelayUrls = ref<string[]>([])
  const reedRelays = ref<string[]>([])
  const writeRelays = ref<string[]>([])

  const userReadWriteRelays = computed(() => {
    const unique = new Set([...reedRelays.value, ...writeRelays.value])
    const read: TypedRelay[] = []
    const write: TypedRelay[] = []

    unique.forEach(r => {
      if (reedRelays.value.includes(r) && !writeRelays.value.includes(r)) {
        read.push({ url: r, type: 'read' })
      } else {
        write.push({ url: r, type: 'write' })
      }
    })
    return [...read, ...write].sort((a, b) => a.url.localeCompare(b.url))
  })

  const userReadWriteRelaysUrls = computed(() => userReadWriteRelays.value.map(r => r.url))
  
  const allRelaysUrlsWithSelectedRelay = computed(() => {
    const connected = currentRelay.value.url
    const userRelays = userReadWriteRelaysUrls.value
    return userRelays.includes(connected) ? userRelays : [connected, ...userRelays]
  })

  const nip65Tags = computed(() => {
    const read = reedRelays.value
    const write = writeRelays.value
    const unique = new Set([...read, ...write])
    const tags: [string, string, string?][] = [];
    unique.forEach(r => {
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

  const connectedRelaysPrettyStr = computed(() => {
    return connectedReedRelayUrls.value.map(r => r.replace('wss://', '').replace('/', '')).join(', ')
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

  function setConnectedReedRelayUrls(value: string[]) {
    connectedReedRelayUrls.value = value.map(r => normalizeURL(r))
  }

  function setReedRelays(value: string[]) {
    reedRelays.value = value.map(r => normalizeURL(r))
  }

  function setWriteRelays(value: string[]) {
    writeRelays.value = value.map(r => normalizeURL(r))
  }

  function addWriteRelay(value: string) {
    if (writeRelays.value.includes(value)) return
    writeRelays.value.push(normalizeURL(value))
  }

  function addUserRelay(relay: string) {
    const url = normalizeURL(relay)
    if (!url) return false
    if (userReadWriteRelaysUrls.value.includes(url)) return false
    // new relays are always read relays, user can add write option manually
    reedRelays.value.push(url)
  }

  function removeWriteRelay(value: string) {
    writeRelays.value = writeRelays.value.filter(r => r !== value)
  }

  function removeUserRelay(value: string) {
    reedRelays.value = reedRelays.value.filter(r => r !== value)
    writeRelays.value = writeRelays.value.filter(r => r !== value)
    connectedReedRelayUrls.value = connectedReedRelayUrls.value.filter(r => r !== value)
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

  return { 
    isConnectingToRelay, 
    setConnectionToRelayStatus, 
    connectedReedRelayUrls, 
    setConnectedReedRelayUrls,
    selectInputRelayUrl,
    setSelectedRelay,
    selectInputCustomRelayUrl,
    currentRelay,
    updateCurrentRelay,
    additionalRelaysCountForSignedEvent,
    updateAdditionalRelaysCountForSignedEvent,
    additionalRelaysUrlsForSignedEvent,
    updateRelayAdditionalRelaysUrlsForSignedEvent,
    connectedRelaysPrettyStr,
    reedRelays,
    writeRelays,
    setReedRelays,
    setWriteRelays,
    isConnectedToRelay,
    userReadWriteRelays,
    removeWriteRelay,
    addWriteRelay,
    removeUserRelay,
    addUserRelay,
    nip65Tags,
    userReadWriteRelaysUrls,
    allRelaysUrlsWithSelectedRelay
  }
})

