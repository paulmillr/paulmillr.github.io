import { ref } from 'vue'
import { defineStore } from 'pinia'
import { nip19, getPublicKey } from 'nostr-tools'
import { hexToBytes } from '@noble/hashes/utils'

export const useNsec = defineStore('nsec', () => {
  const nsec = ref('')
  const rememberMe = ref(false)
  const cachedNsec = ref('')

  function updateNsec(value: string) {
    nsec.value = value
  }

  function updateCachedNsec(value: string) {
    cachedNsec.value = value
  }

  function setRememberMe(value: boolean) {
    rememberMe.value = value
  }

  function getPubkey() {
    try {
      const privKeyBytes = getPrivkeyBytes()
      if (!privKeyBytes) {
        throw new Error('Invalid private key')
      }
      return getPublicKey(privKeyBytes)
    } catch (e) {
      return ''
    }
  }

  function getPrivkeyBytes() {
    try {
      const isHex = nsec.value.indexOf('nsec') === -1
      return isHex ? hexToBytes(nsec.value) : nip19.decode(nsec.value).data as Uint8Array
    } catch (e) {
      return null
    }
  }

  function isValidNsecPresented() {
    return nsec.value.length > 0 && isNsecValid()
  }

  function isNotValidNsecPresented() {
    return nsec.value.length > 0 && !isNsecValid()
  }

  function isNsecValid() {
    if (nsec.value.length === 0) return false
    return getPubkey().length > 0
  }

  return { 
    nsec, 
    updateNsec, 
    rememberMe, 
    setRememberMe, 
    isNsecValid, 
    isValidNsecPresented, 
    isNotValidNsecPresented, 
    getPubkey,
    cachedNsec,
    updateCachedNsec,
    getPrivkeyBytes
  }
})