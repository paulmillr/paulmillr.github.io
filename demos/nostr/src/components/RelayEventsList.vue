<script setup lang="ts">
  import type { EventExtended } from './../types'
  import EventView from './EventView.vue'
  
  defineProps<{
    events: EventExtended[]
    pubKey: string
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
      <EventView 
        class="event"
        @toggleRawData="handleToggleRawData" 
        :currentReadRelays="currentReadRelays"
        :event="event" 
        :pubKey="pubKey"
        :index="i" 
        :showReplies="true"
        :hasReplyBtn="true"
        :sliceText="150"
      />
    </template>
  </div>
</template>

<style scoped>
  .event {
    margin-bottom: 15px;
  }
</style>