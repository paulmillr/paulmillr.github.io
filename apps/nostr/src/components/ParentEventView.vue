<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import type { SimplePool, Event } from 'nostr-tools'
  import type { EventExtended } from './../types'
  import EventContent from './EventContent.vue'
  import ExpandArrow from './../icons/ExpandArrow.vue'
  import {
    filterRootEventReplies,
    filterReplyEventReplies,
    nip10IsFirstLevelReply,
    nip10IsSecondLevelReply,
    loadAndInjectDataToPosts,
  } from '../utils/utils'

  import { useMetasCache } from '@/stores/MetasCache'
  import { usePool } from '@/stores/Pool'

  const metasCacheStore = useMetasCache()
  const poolStore = usePool()
  const pool = poolStore.pool

  const emit = defineEmits(['toggleRawData'])

  const props = defineProps<{
    event: EventExtended
    index?: number
    hasReplyBtn?: boolean
    showRootReplies?: boolean
    currentReadRelays: string[]
  }>()

  const showReplyField = ref(false)
  const showMoreRepliesBtn = ref(false)
  const showAllReplies = ref(false)
  const isLoadingThread = ref(false)
  const isLoadingFirstReply = ref(false)

  const replyEvent = ref<EventExtended | null>(null)
  const eventReplies = ref<EventExtended[]>([])
  const isMounted = ref(true)

  onMounted(async () => {
    await loadRepliesPreiew()
  })

  onUnmounted(() => {
    isMounted.value = false
  })

  const loadRepliesPreiew = async () => {
    const { event, currentReadRelays } = props

    let replies = await pool.querySync(currentReadRelays, { kinds: [1], '#e': [event.id] })
    if (!isMounted.value) return

    if (props.showRootReplies) {
      replies = replies.filter((reply: Event) => nip10IsFirstLevelReply(event.id, reply))
    } else {
      replies = replies.filter((reply: Event) => nip10IsSecondLevelReply(event.id, reply))
    }

    if (!replies.length) return
    isLoadingFirstReply.value = true
    showMoreRepliesBtn.value = replies.length > 1

    const reply = replies[0]
    const isRootPosts = false
    await loadAndInjectDataToPosts(
      [reply],
      event,
      {},
      currentReadRelays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
      (reply) => {
        if (!isMounted.value) return
        replyEvent.value = reply
        isLoadingFirstReply.value = false
      },
    )
  }

  const handleToggleRawData = (eventId: string, isMainEvent = false) => {
    if (isMainEvent) {
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
    if (!isMounted.value) return

    // filter first level replies
    if (event.isRoot) {
      replies = filterRootEventReplies(event, replies)
    } else {
      replies = filterReplyEventReplies(event, replies)
    }

    if (!replies.length) {
      isLoadingThread.value = false
      return
    }

    const isRootPosts = false
    await loadAndInjectDataToPosts(
      replies,
      event,
      {},
      currentReadRelays,
      metasCacheStore,
      pool as SimplePool,
      isRootPosts,
    )
    if (!isMounted.value) return

    eventReplies.value = replies as EventExtended[]
    showAllReplies.value = true
    isLoadingThread.value = false
  }

  const loadRootReplies = async () => {
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
      :isMainEvent="true"
      :currentReadRelays="currentReadRelays"
      :pool="(pool as SimplePool)"
      :hasReplyBtn="hasReplyBtn"
    />
    <div v-if="isLoadingFirstReply">Loading replies...</div>

    <div v-if="replyEvent" class="replies">
      <div
        @click="handleLoadMoreReplies"
        v-if="!showAllReplies && showMoreRepliesBtn && !isLoadingThread"
        class="replies__other"
      >
        <span class="replies__other-link">
          <span class="replies__other-text"> Show more replies </span>
          <ExpandArrow />
        </span>
      </div>
      <div v-if="isLoadingThread" class="replies__other">Loading replies...</div>

      <div v-if="showAllReplies && showMoreRepliesBtn" class="replies__other">
        <span class="replies__other-text"> Loaded {{ eventReplies.length }} replies </span>
      </div>

      <div
        :class="[
          'line-vertical',
          {
            'line-vertical_long': showMoreRepliesBtn,
            'line-vertical_reply-field': showReplyField && !showMoreRepliesBtn,
            'line-vertical_reply-field_long': showReplyField && showMoreRepliesBtn,
          },
        ]"
      ></div>
      <div
        v-if="!showAllReplies"
        :class="['line-horizontal', { 'line-horizontal_height': showMoreRepliesBtn }]"
      ></div>

      <div v-if="!showAllReplies">
        <EventContent
          :key="replyEvent.id"
          :event="(replyEvent as EventExtended)"
          :currentReadRelays="currentReadRelays"
          :pool="(pool as SimplePool)"
          :hasReplyBtn="hasReplyBtn"
        />
      </div>

      <div v-if="showAllReplies" class="replies__list">
        <div class="replies__list-item" v-for="(reply, i) in eventReplies" :key="reply.id">
          <div class="replies__list-item-line-horizontal"></div>
          <div
            :class="[
              'replies__list-item-line-vertical',
              { 'replies__list-item-line-vertical_short': i === eventReplies.length - 1 },
            ]"
          ></div>
          <EventContent
            :key="reply.id"
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
    background-color: #2a2f3b;
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
    background-color: #2a2f3b;
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
    background-color: #2a2f3b;
  }

  .replies__list-item-line-vertical {
    position: absolute;
    left: -38px;
    top: 0;
    width: 1px;
    height: calc(100% + 30px);
    background-color: #2a2f3b;
  }

  .replies__list-item-line-vertical_short {
    height: 38px;
  }
</style>
