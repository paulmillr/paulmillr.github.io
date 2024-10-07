<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { LogContentPart } from './types'
  import { asyncClosePool } from '@/utils/network'

  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'
  import { useImages } from '@/stores/Images'
  import type { SimplePool } from 'nostr-tools'

  const router = useRouter()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const feedStore = useFeed()
  const imagesStore = useImages()
  const poolStore = usePool()
  const pool = poolStore.pool

  const isRemembered = !!localStorage.getItem('privkey')?.length
  nsecStore.setRememberMe(isRemembered)
  const initialNsec = isRemembered ? localStorage.getItem('privkey') : ''
  nsecStore.updateNsec(initialNsec || '')

  const eventsLog = ref<LogContentPart[][]>([])

  const logStr = (msg: string) => {
    const parts = [{ type: 'text', value: msg }]
    logHtmlParts(parts)
  }

  const logHtmlParts = (parts: LogContentPart[]) => {
    eventsLog.value.unshift(parts)
  }

  const clearAppState = async (clearLocalStorage: boolean = true) => {
    feedStore.clearNewEventsBadgeUpdateInterval()

    if (relayStore.isConnectedToRelay) {
      relayStore.currentRelay?.close()
    }

    // TODO: loader on the logout page needed to show the status of closing connections to relays

    // console.time('asyncClosePool') // Start timing
    await asyncClosePool(pool as SimplePool)
    // console.timeEnd('asyncClosePool') // End timing

    feedStore.clear()
    relayStore.clear()
    poolStore.resetPool()

    imagesStore.updateShowImages(false)

    if (clearLocalStorage) {
      localStorage.clear()
      nsecStore.updateCachedNsec('')
      nsecStore.updateNsec('')
      nsecStore.setRememberMe(false)
    }

    router.push('/login')

    // logHtmlParts([
    //   { type: 'text', value: 'disconnected from ' },
    //   { type: 'bold', value: relay.url },
    // ])
  }
</script>

<template>
  <router-view @clearAppState="clearAppState" name="Header"></router-view>
  <router-view @clearAppState="clearAppState" :eventsLog="eventsLog"></router-view>
</template>
