<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { LogContentPart } from './types'
  import { useNsec } from '@/stores/Nsec'

  const router = useRouter()
  const nsecStore = useNsec()

  const isRemembered = !!localStorage.getItem('privkey')?.length
  nsecStore.setRememberMe(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsecStore.updateNsec(initialNsec || '')

  const eventsLog = ref<LogContentPart[][]>([])

  // old loggin logic
  // const logStr = (msg: string) => {
  //   const parts = [{ type: 'text', value: msg }]
  //   logHtmlParts(parts)
  // }
  // const logHtmlParts = (parts: LogContentPart[]) => {
  //   eventsLog.value.unshift(parts)
  // }

  const clearAppState = async (clearUserData: boolean = false) => {
    if (clearUserData) {
      localStorage.clear()
      nsecStore.clear()
    }

    await router.push('/login')
    location.reload()
  }
</script>

<template>
  <router-view @clearAppState="clearAppState" name="Header"></router-view>
  <router-view @clearAppState="clearAppState" :eventsLog="eventsLog"></router-view>
</template>
