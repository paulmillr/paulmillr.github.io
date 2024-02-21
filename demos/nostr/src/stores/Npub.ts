import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNpub = defineStore('npub', () => {
  const npub = ref('')
  const cachedUrlNpub = ref('')

  function updateNpub(value: string) {
    npub.value = value
  }

  function updateCachedUrl(value: string) {
    cachedUrlNpub.value = value
  }

  return { npub, cachedUrlNpub, updateNpub, updateCachedUrl }
})