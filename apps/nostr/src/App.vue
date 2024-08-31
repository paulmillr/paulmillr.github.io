<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import type { LogContentPart } from './types'
  import { closePoolSockets } from '@/utils/network'

  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { usePool } from '@/stores/Pool'
  import { useImages } from '@/stores/Images'

  const router = useRouter()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const feedStore = useFeed()
  const imagesStore = useImages()
  const poolStore = usePool()
  const pool = poolStore.pool

  const isRemembered = localStorage.getItem('rememberMe') === 'true'
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

  const clearAppState = () => {
    if (relayStore.isConnectedToRelay) {
      relayStore.currentRelay?.close()
    }

    // pool.close(relayStore.userReadWriteRelaysUrls)
    closePoolSockets(pool)
    poolStore.resetPool()

    // feedStore.pool?.close(relayStore.connectedFeedRelaysUrls)
    if (feedStore.pool) {
      closePoolSockets(feedStore.pool)
      feedStore.resetPool()
    }

    localStorage.removeItem('privkey')
    nsecStore.updateNsec('')
    feedStore.clear()
    relayStore.clear()
    imagesStore.updateShowImages(false)

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
