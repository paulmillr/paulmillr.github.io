<script setup lang="ts">
  import { ref } from 'vue'
  import type { Event } from 'nostr-tools'
  import MessageInput from '@/components/MessageInput.vue'
  import SignedEventInput from '@/components/SignedEventInput.vue'
  import { isWsAvailable, publishEventToRelays } from '@/utils'

  import { useRelay } from '@/stores/Relay'
  import { usePool } from '@/stores/Pool'
  import { useFeed } from '@/stores/Feed'

  const relayStore = useRelay()
  const feedStore = useFeed()
  const poolStore = usePool()
  const pool = poolStore.pool

  const emit = defineEmits(['loadNewRelayEvents'])

  const props = defineProps<{
    newEvents: { id: string; pubkey: string }[]
  }>()

  const sentEventIds = ref<Set<string>>(new Set())
  const isPresignedMessage = ref(false)
  const isSendingMessage = ref(false)
  const broadcastMsgError = ref('')

  const toggleMessageType = () => {
    isPresignedMessage.value = !isPresignedMessage.value
  }

  const broadcastEvent = async (event: Event, type: string) => {
    let writeRelays: string[] = []

    // for debugging json events
    // if (type !== 'json') {
    //   console.log(JSON.stringify(event))
    //   return
    // }

    if (isSendingMessage.value) return
    isSendingMessage.value = true

    if (type === 'json') {
      const rawAdditionalUrls = relayStore.additionalRelaysUrlsForSignedEvent
      let connectedJsonRelays: string[] = []

      if (rawAdditionalUrls.length) {
        let error = "Message was not sent. Can't connect to the next relays: \n"
        let isError = false
        for (const url of rawAdditionalUrls) {
          if (!url?.length) continue
          if (!(await isWsAvailable(url))) {
            isError = true
            error += `- ${url} \n`
            continue
          }
          connectedJsonRelays.push(url)
        }

        const connectedRelayUrl = relayStore.currentRelay.url
        if (!(await isWsAvailable(connectedRelayUrl))) {
          isError = true
          error += `- ${connectedRelayUrl} \n`
        }

        if (isError) {
          error += `Relays are unavailable or you are offline. Please try again or change the list of relays.`
          return handleBroadcastError(error)
        }
      }

      writeRelays = [relayStore.currentRelay.url, ...connectedJsonRelays]
      writeRelays = [...new Set(writeRelays)] // make unique
    }

    if (type === 'text') {
      writeRelays = relayStore.connectedUserWriteRelaysUrls
    }

    if (!writeRelays.length) {
      const error =
        'No relays to broadcast the message. Please provide the list of write relays in settings.'
      return handleBroadcastError(error)
    }

    const networkResult = await publishEventToRelays(writeRelays, pool, event)
    // result.forEach((data: any) => {
    //   if (data.success) {
    //     logHtmlParts([
    //       { type: 'text', value: '✅ new event broadcasted to ' },
    //       { type: 'bold', value: data.relay },
    //     ])
    //   } else {
    //     logHtmlParts([
    //       { type: 'text', value: '❌ failed to publish to ' },
    //       { type: 'bold', value: data.relay },
    //     ])
    //   }
    // })

    // check if something was failed during sending event (ex. no connection)
    const isAllError = networkResult.every((r: any) => r.success === false)
    if (isAllError) {
      const error =
        'Failed to broadcast the message. Please check the connection or there may be a problem on the all provided relays. Also please try again.'
      return handleBroadcastError(error)
    }

    // check if all relays was applied event successfully (ex. spam protection, paid relay, etc.)
    if (type === 'json' && writeRelays.length > 1) {
      const relayResults = await Promise.all(
        writeRelays.map(async (relay: string) => {
          const note = await pool.get([relay], { ids: [event.id] })
          return { relay: relay, success: !!note }
        }),
      )
      const allError = relayResults.every((r: any) => r.success === false)
      const isError = relayResults.some((r: any) => r.success === false)

      let failedRelaysListStr = ''
      relayResults.forEach((r: any) => {
        if (!r.success) {
          failedRelaysListStr += `- ${r.relay} \n`
        }
      })

      if (allError) {
        const error = `Event was not sent, the next relay(s) were not accepted event for some reason: \n ${failedRelaysListStr}`
        return handleBroadcastError(error)
      } else if (isError) {
        const error = `Event was sent, but the next relay(s) were not accepted event for some reason: \n ${failedRelaysListStr}`
        showBroadcastNotice(error)
      }
    }

    const publishedEvent = await pool.get(writeRelays, { ids: [event.id] })
    if (!publishedEvent) {
      const error = `Failed to broadcast the message. Please check the connection or there may be a problem with relay(s).`
      return handleBroadcastError(error)
    }

    feedStore.pushToNewEventsToShow({
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
    })
    emit('loadNewRelayEvents')

    if (type === 'text') {
      feedStore.updateMessageToBroadcast('')
    }
    if (type === 'json') {
      feedStore.updateSignedJson('')
    }

    sentEventIds.value.add(event.id)
    isSendingMessage.value = false
  }

  const handleBroadcastError = (error: string) => {
    broadcastMsgError.value = error
    isSendingMessage.value = false
  }

  const showBroadcastNotice = (error: string) => {
    broadcastMsgError.value = error
  }

  const clearBroadcastError = () => {
    broadcastMsgError.value = ''
  }
</script>

<template>
  <div class="message-field-wrapper">
    <SignedEventInput
      v-if="isPresignedMessage"
      @broadcastEvent="broadcastEvent"
      @toggleMessageType="toggleMessageType"
      @clearBroadcastError="clearBroadcastError"
      :sentEventIds="sentEventIds"
      :isSendingMessage="isSendingMessage"
    />
    <MessageInput
      v-else
      @broadcastEvent="broadcastEvent"
      @toggleMessageType="toggleMessageType"
      @clearBroadcastError="clearBroadcastError"
      :sentEventIds="sentEventIds"
      :isSendingMessage="isSendingMessage"
    />
    <div class="error">{{ broadcastMsgError }}</div>
  </div>
</template>

<style scoped>
  .message-field-wrapper {
    margin-bottom: 30px;
  }

  .error {
    color: #ff4040;
    font-size: 16px;
    margin-top: 5px;
    white-space: pre-line;
  }
</style>
