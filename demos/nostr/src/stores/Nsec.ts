import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNsec = defineStore('nsec', () => {
  const nsec = ref('')
  const rememberMe = ref(false)

  function updateNsec(value: string) {
    nsec.value = value
  }

  function setRememberMe(value: boolean) {
    rememberMe.value = value
  }

  return { nsec, updateNsec, rememberMe, setRememberMe }
})