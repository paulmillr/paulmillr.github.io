<script setup lang="ts">
  import {nextTick, onMounted, ref } from 'vue'
  import {
    nip10,
    SimplePool,
    type Event
  } from 'nostr-tools'
  import type { EventExtended } from './../types'
  import EventContent from './EventContent.vue'
  import ExpandArrow from './../icons/ExpandArrow.vue'
  import {
    injectAuthorsToNotes,
    injectDataToReplyNotes
  } from './../utils'

  import { usePool } from '@/stores/Pool'

  const poolStore = usePool()
  const pool = poolStore.eventPool

  const emit = defineEmits(['toggleRawData'])

  const props = defineProps<{
    event: EventExtended
    pubKey?: string
    index?: number
    sliceText?: number
    sliceTextReply?: number
    showReplies?: boolean,
    hasReplyBtn?: boolean,
    currentReadRelays: string[]
  }>()

  const showReplyField = ref(false)
  const showMoreRepliesBtn = ref(false)
  const showAllReplies = ref(false)
  const isLoadingThread = ref(false)
  const isLoadingFirstReply = ref(false)

  const replyEvent = ref<EventExtended | null>(null)
  const eventReplies = ref<EventExtended[]>([])

  onMounted(async () => {
    if (props.showReplies) {
      await loadRepliesPreiew()
    }
  })

  const loadRepliesPreiew = async () => {
    const { event, currentReadRelays } = props
    if (!currentReadRelays.length) return

    let replies = await pool.querySync(currentReadRelays, { kinds: [1], '#e': [event.id] })

    // filter first level replies
    replies = replies.filter((reply: Event) => {
      const nip10Data = nip10.parse(reply)
      return !nip10Data.reply && nip10Data?.root?.id === event.id
    })

    if (!replies.length) return

    isLoadingFirstReply.value = true
    showMoreRepliesBtn.value = replies.length > 1
    let reply = replies[0] as EventExtended

    let tempReplies = [reply]
    await injectDataToReplyNotes(event, tempReplies as EventExtended[], currentReadRelays, pool as SimplePool)

    reply = tempReplies[0] as EventExtended
    const authorMeta = await pool.get(currentReadRelays, { kinds: [0], limit: 1, authors: [reply.pubkey] })
    if (authorMeta) {
      reply.author = JSON.parse(authorMeta.content)
    }

    replyEvent.value = reply
    isLoadingFirstReply.value = false
  }

  const handleToggleRawData = (eventId: string, isRootEvent = false) => {
    if (isRootEvent) {
      return emit('toggleRawData', eventId)
    }
  }

  const handleToggleReplyField = () => {
    showReplyField.value = !showReplyField.value
  }

  const handleLoadMoreReplies = async () => {
    const { event, currentReadRelays } = props
    if (!currentReadRelays.length) return

    isLoadingThread.value = true
    let replies = await pool.querySync(currentReadRelays, { kinds: [1], '#e': [event.id] })

    // filter first level replies
    replies = replies.filter((reply: Event) => {
      const nip10Data = nip10.parse(reply)
      return !nip10Data.reply && nip10Data?.root?.id === event.id
    })

    if (!replies.length) {
      isLoadingThread.value = false
      return
    }

    const authors = replies.map((e: any) => e.pubkey)
    const uniqueAuthors = [...new Set(authors)]
    const authorsEvents = await pool.querySync(currentReadRelays, { kinds: [0], authors: uniqueAuthors })
    replies = injectAuthorsToNotes(replies, authorsEvents)

    await injectDataToReplyNotes(event, replies as EventExtended[], currentReadRelays, pool as SimplePool)

    eventReplies.value = replies as EventExtended[]
    showAllReplies.value = true
    isLoadingThread.value = false
  }

  const loadRootReplies = async () => {
    // await nextTick()
    showReplyField.value = false
    if (showAllReplies.value) {
      await handleLoadMoreReplies()
    } else {
      await loadRepliesPreiew()
    }
  }
</script>

<template>
  <div class="event">
    <EventContent
      :key="event.id"
      @loadRootReplies="loadRootReplies"
      @showReplyField="handleToggleReplyField"
      @toggleRawData="(eventId) => handleToggleRawData(eventId, true)"
      @loadMoreReplies="handleLoadMoreReplies"
      :event="(event as EventExtended)"
      :pubKey="pubKey"
      :sliceText="sliceText"
      :isRootEvent="true"
      :currentReadRelays="currentReadRelays"
      :pool="(pool as SimplePool)"
      :hasReplyBtn="hasReplyBtn"
    />
    <div v-if="isLoadingFirstReply">Loading replies...</div>

    <div v-if="showReplies && replyEvent" class="replies">
      <div @click="handleLoadMoreReplies" v-if="!showAllReplies && showMoreRepliesBtn && !isLoadingThread" class="replies__other">
        <span class="replies__other-link">
          <span class="replies__other-text">
            Show more replies
          </span>
          <ExpandArrow />
        </span>
      </div>
      <div v-if="isLoadingThread" class="replies__other">
        Loading replies...
      </div>

      <div v-if="showAllReplies && showMoreRepliesBtn" class="replies__other">
        <span class="replies__other-text">
          Loaded {{ eventReplies.length }} replies
        </span>
      </div>

      <div :class="[
        'line-vertical', {
          'line-vertical_long': showMoreRepliesBtn,
          'line-vertical_reply-field': showReplyField && !showMoreRepliesBtn,
          'line-vertical_reply-field_long': showReplyField && showMoreRepliesBtn
        }]">
      </div>
      <div v-if="!showAllReplies" :class="['line-horizontal', { 'line-horizontal_height': showMoreRepliesBtn }]"></div>

      <div v-if="!showAllReplies">
        <EventContent
          :key="replyEvent.id"
          :sliceText="sliceTextReply"
          :event="(replyEvent as EventExtended)"
          :currentReadRelays="currentReadRelays"
          :pool="(pool as SimplePool)"
          :hasReplyBtn="hasReplyBtn"
        />
      </div>

      <div v-if="showAllReplies" class="replies__list">
        <div class="replies__list-item" v-for="(reply, i) in eventReplies">
          <div class="replies__list-item-line-horizontal"></div>
          <div :class="['replies__list-item-line-vertical', { 'replies__list-item-line-vertical_short': i === (eventReplies.length - 1) }]"></div>
          <EventContent
            :key="reply.id"
            :sliceText="sliceTextReply"
            :event="(reply as EventExtended)"
            :currentReadRelays="currentReadRelays"
            :pool="(pool as SimplePool)"
            :hasReplyBtn="hasReplyBtn"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .line-vertical {
    position: absolute;
    left: -38px;
    top: -15px;
    width: 1px;
    height: 54px;
    background-color: #878580;
  }

  .line-vertical_long {
    height: 95px;
  }

  .line-vertical_reply-field {
    top: -50px;
    height: 88px;
  }

  .line-vertical_reply-field_long {
    top: -50px;
    height: 130px;
  }

  .line-horizontal {
    position: absolute;
    left: -38px;
    top: 38px;
    height: 1px;
    width: 38px;
    background-color: #878580;
  }

  .line-horizontal_height {
    top: 80px;
  }

  .event {
    margin: 1rem 0;
    margin-bottom: 15px;
  }
  .replies {
    position: relative;
    margin-left: 76px;
    margin-top: 15px;
    margin-bottom: 20px;
  }

  .replies__other {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .replies__other-link {
    display: flex;
    align-items: center;
    cursor: pointer;
    color: #0092bf;
  }

  .replies__other-link:hover {
    text-decoration: underline;
  }

  .replies__other-text {
    margin-right: 5px;
  }

  .replies__list-item {
    position: relative;
    margin-bottom: 15px;
  }

  .replies__list-item-line-horizontal {
    position: absolute;
    left: -38px;
    top: 38px;
    height: 1px;
    width: 38px;
    background-color: #878580;
  }

  .replies__list-item-line-vertical {
    position: absolute;
    left: -38px;
    top: 0;
    width: 1px;
    height: calc(100% + 30px);
    background-color: #878580;
  }

  .replies__list-item-line-vertical_short {
    height: 38px;
  }
</style>