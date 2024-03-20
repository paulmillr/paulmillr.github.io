import { ref } from 'vue'
import { defineStore } from 'pinia'
import { SimplePool } from 'nostr-tools'

export const usePool = defineStore('pool', () => {
  const eventPool = ref(new SimplePool())
  const feedPool = ref(new SimplePool())
  const userPool = ref(new SimplePool())

  return { eventPool, feedPool, userPool }
})