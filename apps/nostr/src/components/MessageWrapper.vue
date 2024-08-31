<script setup lang="ts">
  import { ref } from 'vue'
  import type { SubCloser } from 'nostr-tools/lib/types/abstract-pool'
  import type { Event } from 'nostr-tools'
  import MessageInput from '@/components/MessageInput.vue'
  import SignedEventInput from '@/components/SignedEventInput.vue'
  import { isWsAvailable, publishEventToRelays } from '@/utils'

  import { useRelay } from '@/stores/Relay'
  import { useNsec } from '@/stores/Nsec'
  import { usePool } from '@/stores/Pool'
  import { useFeed } from '@/stores/Feed'

  const relayStore = useRelay()
  const nsecStore = useNsec()
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
          broadcastMsgError.value = error
          isSendingMessage.value = false
          return
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
      return handleBroadcastError(null, error)
    }

    // TODO, handle case when user is logged in, but no write relays presented in his profile
    // maybe show notice in that case

    const relaysToWatch = relayStore.connectedFeedRelaysUrls
    let userSub: SubCloser | null = null
    let interval: number | undefined
    const toWatchForUpadtes = relaysToWatch.some((r) => writeRelays.includes(r))
    if (toWatchForUpadtes) {
      const userNewEventOptions = [{ ids: [event.id] }]
      userSub = pool.subscribeMany(relaysToWatch, userNewEventOptions, {
        onevent(event: Event) {
          // update feed only if new event is loaded
          // interval needed because of delay between publishing and loading new event
          interval = setInterval(() => {
            if (props.newEvents.some((e) => e.id === event.id)) {
              emit('loadNewRelayEvents')
              userSub?.close()
            }
          }, 100)
        },
        onclose() {
          clearInterval(interval)
        },
      })
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
      return handleBroadcastError(userSub, error)
    }

    // check if all relays was applied event successfully (ex. spam protection, paid relay, etc.)
    if (type === 'json' && writeRelays.length > 1) {
      const relayResults = await Promise.all(
        writeRelays.map(async (relay: string) => {
          const note = await pool.get([relay], { ids: [event.id] })
          return { relay: relay, success: !!note }
        }),
      )
      const isError = relayResults.some((r: any) => r.success === false)
      if (isError) {
        let error =
          'Event was sent, but the next relay(s) were not accepted event for some reason: \n'
        relayResults.forEach((r: any) => {
          if (!r.success) {
            error += `- ${r.relay} \n`
          }
        })
        const allError = relayResults.every((r: any) => r.success === false)
        if (allError) {
          return handleBroadcastError(userSub, error)
        }
      }

      // force feed update, because when some relays were not accepted event the feed will not be updated, so we need to update it manually
      const successfullRelays = relayResults.filter((r: any) => r.success).map((r: any) => r.relay)
      const toUpdateFeed = relaysToWatch.some((r) => successfullRelays.includes(r))
      if (toUpdateFeed) {
        emit('loadNewRelayEvents')
        userSub?.close()
      }
    } else {
      const publishedEvent = await pool.querySync(writeRelays, { ids: [event.id] })
      if (!publishedEvent.length) {
        const error = `Failed to broadcast the message. Please check the connection or there may be a problem with relay(s).`
        return handleBroadcastError(userSub, error)
      } else {
        // TODO: probably we we can get rid of the subscription for new event above because of this, proper testing needed
        emit('loadNewRelayEvents')
        userSub?.close()
      }
    }

    if (type === 'text') {
      feedStore.updateMessageToBroadcast('')
    }
    if (type === 'json') {
      feedStore.updateSignedJson('')
    }

    sentEventIds.value.add(event.id)
    isSendingMessage.value = false
  }

  const handleBroadcastError = (eventSub: SubCloser | null, error: string) => {
    broadcastMsgError.value = error
    eventSub?.close()
    isSendingMessage.value = false
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
