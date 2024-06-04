import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUser = defineStore('user', () => {
  const isRoutingUser = ref(false)

  function updateRoutingStatus(value: boolean) {
    isRoutingUser.value = value
  }

  return { isRoutingUser, updateRoutingStatus }
})