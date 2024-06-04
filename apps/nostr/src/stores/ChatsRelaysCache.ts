import { ref } from 'vue'
import { defineStore } from 'pinia'
import { utils, type Event as NostrEvent } from 'nostr-tools'

const { normalizeURL } = utils

export const useChatsRelaysCache = defineStore('chatsRelaysCache', () => {
  const metas = ref<{ 
    [key: string]: { 
      relays: Set<string>, 
      cache_created: number
    }
  }>({})
  const isLoadingRelays = ref(false)

  function addMetas(events: NostrEvent[]) {
    events.forEach(event => {
      const { pubkey, tags } = event

      if (!metas.value.hasOwnProperty(pubkey)) {
        metas.value[pubkey] = { relays: new Set(), cache_created: Date.now() }
      }

      tags.forEach(tag => {
        if ((tag[0] === 'r' || tag[0] === 'relay') && tag[1] && tag[1].length) {
          const relayUrl = normalizeURL(tag[1])
          metas.value[pubkey].relays.add(relayUrl)
        }
      })
    })
  }

  function getRelaysByPubkeys(pubkeys: string[]) {
    const relays = new Set()
    pubkeys.forEach(pubkey => {
      const cached = getMetaRelays(pubkey)
      cached.forEach(relay => relays.add(relay))
    })
    return relays
  }

  function hasMeta(pubkey: string) {
    return metas.value.hasOwnProperty(pubkey)
  }

  function getMetaRelays(pubkey:string) {
    return hasMeta(pubkey) ? metas.value[pubkey].relays : new Set()
  }

  return { metas, hasMeta, getMetaRelays, addMetas, getRelaysByPubkeys, isLoadingRelays }
})