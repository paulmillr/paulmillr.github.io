import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Event as NostrEvent } from 'nostr-tools'

export const useCache = defineStore('cache', () => {
  const metas = ref<{ [key: string]: { event: NostrEvent | null, cache_created: number} }>({})

  function addMeta(pubkey: string, event: NostrEvent | null) {
    if (!metas.value.hasOwnProperty(pubkey)) {
      metas.value[pubkey] = { event, cache_created: Date.now() }
    }
  }

  function hasMeta(pubkey: string) {
    return metas.value.hasOwnProperty(pubkey)
  }

  function getMeta(pubkey:string) {
    return metas.value[pubkey]?.event
  }

  return { metas, addMeta, hasMeta, getMeta }
})