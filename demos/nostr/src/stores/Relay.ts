import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Relay } from 'nostr-tools'

export const useRelay = defineStore('relay', () => {
  const currentRelay = ref(<Relay>{})
  const isConnectingToRelay = ref(false)
  const connectedRelayUrl = ref('')
  const connectedRelayUrls = ref<string[]>([])
  const selectedRelay = ref('')
  const customRelayUrl = ref('')
  const additionalRelaysCountForSignedEvent = ref(0)
  const additionalRelaysUrlsForSignedEvent = ref<string[]>([])

  function updateCurrentRelay(value: Relay) {
    currentRelay.value = value
  }

  function setConnectionToRelayStatus(value: boolean) {
    isConnectingToRelay.value = value
  }

  function setConnectedRelayUrl(value: string) {
    connectedRelayUrl.value = value
  }

  function setConnectedRelayUrls(value: string[]) {
    connectedRelayUrls.value = value
  }

  function setSelectedRelay(value: string) {
    selectedRelay.value = value
  }

  function setCustomRelayUrl(value: string) {
    customRelayUrl.value = value
  }

  function updateAdditionalRelaysCountForSignedEvent(value: number) {
    additionalRelaysCountForSignedEvent.value = value
  }

  function updateRelayAdditionalRelaysUrlsForSignedEvent(index: number, value: string) {
    additionalRelaysUrlsForSignedEvent.value[index] = value
  }

  return { 
    isConnectingToRelay, 
    setConnectionToRelayStatus, 
    connectedRelayUrl, 
    setConnectedRelayUrl, 
    connectedRelayUrls, 
    setConnectedRelayUrls,
    selectedRelay,
    setSelectedRelay,
    customRelayUrl,
    setCustomRelayUrl,
    currentRelay,
    updateCurrentRelay,
    additionalRelaysCountForSignedEvent,
    updateAdditionalRelaysCountForSignedEvent,
    additionalRelaysUrlsForSignedEvent,
    updateRelayAdditionalRelaysUrlsForSignedEvent
  }
})

