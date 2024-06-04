import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useChat = defineStore('chat', () => {
  const ownRumors = ref(new Set<string>())

  function addOwnRumor(messageId: string) {
    ownRumors.value.add(messageId)
  }

  return { ownRumors, addOwnRumor }
})