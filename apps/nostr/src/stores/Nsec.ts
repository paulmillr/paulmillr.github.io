import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { nip19, getPublicKey } from 'nostr-tools'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'

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

  function getPrivkeyHex() {
    const bytes = getPrivkeyBytes()
    if (!bytes) {
      return ''
    }
    try {
      return bytesToHex(bytes)
    } catch (e) {
      return ''
    }
  }

  function getPrivkey() {
    try {
      const isHex = nsec.value.indexOf('nsec') === -1
      return isHex ? nip19.nsecEncode(hexToBytes(nsec.value)) : nsec.value
    } catch (e) {
      return ''
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

  const isNsecValidTemp = computed(() =>{
    return isNsecValid()
  })

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
    getPrivkeyBytes,
    getPrivkeyHex,
    getPrivkey,
    isNsecValidTemp
  }
})