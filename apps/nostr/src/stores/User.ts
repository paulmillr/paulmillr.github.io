import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUser = defineStore('user', () => {
  const isRoutingUser = ref(false)
  const isSearchUsed = ref(false)

  function updateRoutingStatus(value: boolean) {
    isRoutingUser.value = value
  }

  function updateSearchStatus(value: boolean) {
    isSearchUsed.value = value
  }

  return { isRoutingUser, updateRoutingStatus, updateSearchStatus, isSearchUsed }
})
