import { ref } from 'vue'
import { defineStore } from 'pinia'

// generated from priv key and used for signing event
// and to higlighting events which belong to user
export const usePubKey = defineStore('pub-key', () => {
  const fromPrivate = ref('')

  function updateKeyFromPrivate(value: string) {
    fromPrivate.value = value
  }

  return { fromPrivate, updateKeyFromPrivate }
})
