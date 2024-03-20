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
  const connectedRelayUrl = ref('') 
  const selectedRelay = ref('')
  const customRelayUrl = ref('')

  // custom relay for the signed event form
  const additionalRelaysCountForSignedEvent = ref(0)
  const additionalRelaysUrlsForSignedEvent = ref<string[]>([])

  // user relays from nip 65 (relay list metadata, kind:10002)
  const connectedReedRelayUrls = ref<string[]>([])
  const reedRelays = ref<string[]>([])
  const writeRelays = ref<string[]>([])

  const allRelays = computed(() => {
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

  const allRelaysUrls = computed(() => allRelays.value.map(r => r.url))
  
  const allRelaysUrlsWithConnectedRelay = computed(() => {
    const connected = connectedRelayUrl.value
    const allRelays = allRelaysUrls.value
    return allRelays.includes(connected) ? allRelays : [connected, ...allRelays]
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
    return connectedRelayUrl.value.length > 0
  })

  function updateCurrentRelay(value: Relay) {
    currentRelay.value = value
  }

  function setConnectionToRelayStatus(value: boolean) {
    isConnectingToRelay.value = value
  }

  function setConnectedRelayUrl(value: string) {
    connectedRelayUrl.value = value === 'custom' || value === '' ? value : normalizeURL(value)
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
    removeUserRelay(url) // prevent duplicates
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
    selectedRelay.value = normalizeURL(value)
  }

  function setCustomRelayUrl(value: string) {
    customRelayUrl.value = normalizeURL(value)
  }

  function updateAdditionalRelaysCountForSignedEvent(value: number) {
    additionalRelaysCountForSignedEvent.value = value
  }

  function updateRelayAdditionalRelaysUrlsForSignedEvent(index: number, value: string) {
    additionalRelaysUrlsForSignedEvent.value[index] = normalizeURL(value)
  }

  return { 
    isConnectingToRelay, 
    setConnectionToRelayStatus, 
    connectedRelayUrl, 
    setConnectedRelayUrl, 
    connectedReedRelayUrls, 
    setConnectedReedRelayUrls,
    selectedRelay,
    setSelectedRelay,
    customRelayUrl,
    setCustomRelayUrl,
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
    allRelays,
    removeWriteRelay,
    addWriteRelay,
    removeUserRelay,
    addUserRelay,
    nip65Tags,
    allRelaysUrls,
    allRelaysUrlsWithConnectedRelay
  }
})

