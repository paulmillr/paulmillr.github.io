import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Event } from 'nostr-tools'

export const useMetasCache = defineStore('metasCache', () => {
  const metas = ref<{ 
    [key: string]: Event | null
  }>({})

  function addMeta(event: Event) {
    metas.value[event.pubkey] = event 
  }

  function getMeta(pubkey: string) {
    return metas.value[pubkey] || null
  }

  function setMetaValue(pubkey: string, value: Event | null) {
    metas.value[pubkey] = value
  }

  function hasMeta(pubkey: string) {
    return !!metas.value[pubkey]
  }

  function hasPubkey(pubkey: string) {
    return metas.value.hasOwnProperty(pubkey)
  }

  return {
    metas,
    addMeta,
    getMeta,
    hasMeta,
    hasPubkey,
    setMetaValue
  }
})