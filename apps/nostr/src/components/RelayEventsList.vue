<script setup lang="ts">
  import type { EventExtended } from './../types'
  import ParentEventView from './ParentEventView.vue'

  defineProps<{
    events: EventExtended[]
    currentReadRelays: string[]
  }>()

  const emit = defineEmits(['toggleRawData'])

  const handleToggleRawData = (eventId: string) => {
    emit('toggleRawData', eventId)
  }
</script>

<template>
  <div>
    <template v-for="(event, i) in events" :key="event.id">
      <ParentEventView
        class="event"
        @toggleRawData="handleToggleRawData"
        :currentReadRelays="currentReadRelays"
        :event="event"
        :index="i"
        :showRootReplies="true"
        :hasReplyBtn="true"
      />
    </template>
  </div>
</template>

<style scoped>
  .event {
    margin-bottom: 15px;
  }
</style>
