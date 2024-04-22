import { ref } from 'vue'
import { defineStore } from 'pinia'
import { SimplePool } from 'nostr-tools'

export const usePool = defineStore('pool', () => {
  const pool = ref(new SimplePool())

  function resetPool() {
    pool.value = new SimplePool()
  }

  return { pool, resetPool }
})