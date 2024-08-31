import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNpub = defineStore('npub', () => {
  const npubInput = ref('')
  const cachedUrlNpub = ref('')
  const error = ref('')

  function updateNpubInput(value: string) {
    npubInput.value = value
  }

  function updateCachedUrl(value: string) {
    cachedUrlNpub.value = value
  }

  function setError(value: string) {
    error.value = value
  }

  return {
    npubInput,
    cachedUrlNpub,
    updateNpubInput,
    updateCachedUrl,
    setError,
    error,
  }
})
