<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { nip19, type Event } from 'nostr-tools'
  import type { EventExtended } from './../types'

  const props = defineProps<{
    event: EventExtended
    authorEvent: Event
    isUserEvent?: Boolean
  }>()
  const rawDataActiveTab = ref(1)
  const showAuthorTab = ref(true)

  const clearEvent = ref<Event>()
  const clearAuthorEvent = ref<Event>()
  
  onMounted(() => {
    const { event, authorEvent } = props
    clearEvent.value = sanitizeEvent(event)
    clearAuthorEvent.value = sanitizeEvent(authorEvent)

    if (!props.authorEvent) return
    showAuthorTab.value = props.event.id !== props.authorEvent.id
  })

  const sanitizeEvent = (event: Event) => {
    const { id, pubkey, created_at, kind, tags, content, sig } = event
    return { id, pubkey, created_at, kind, tags, content, sig }
  }

  const handleRawDataTabClick = (tab: number) => {
    rawDataActiveTab.value = tab
  }
</script>

<template>
  <div class="event-details">
    <div :class="['event-details__header', { 'event-details__header_user': isUserEvent }]">
      <span @click="() => handleRawDataTabClick(1)" :class="['event-details__tab', { 'event-details__tab_active': rawDataActiveTab === 1 }]">Note</span>
      <span v-if="showAuthorTab" @click="() => handleRawDataTabClick(2)" :class="['event-details__tab', { 'event-details__tab_active': rawDataActiveTab === 2 }]">Author</span>
      <span @click="() => handleRawDataTabClick(3)" :class="['event-details__tab', { 'event-details__tab_active': rawDataActiveTab === 3 }]">Author content</span>
    </div>
    <div v-if="rawDataActiveTab === 1">
      <pre class="highlight">{{ JSON.stringify(clearEvent, null, 2) }}</pre>
    </div>
    <div v-if="showAuthorTab && rawDataActiveTab === 2">
      <pre v-if="authorEvent" class="highlight">{{ JSON.stringify(clearAuthorEvent, null, 2) }}</pre>
      <div class="event-details__no-user" v-else>
        <div>No info about author on this relay.</div>
        <pre class="highlight">pubkey: {{ event.pubkey }} 
npub: {{ nip19.npubEncode(event.pubkey) }}</pre>
      </div>
    </div>
    <div v-if="rawDataActiveTab === 3">
      <pre v-if="event.author" class="highlight">{{ JSON.stringify(event.author, null, 2) }}</pre>
      <div class="event-details__no-user" v-else>
        <div>No info about author on this relay.</div>
        <pre class="highlight">pubkey: {{ event.pubkey }}
npub: {{ nip19.npubEncode(event.pubkey) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .event-details__header {
    position: fixed;
    top: 10px;
    left: 15px;
  }
  
  .event-details__header_user {
    position: static;
  }

  .event-details__tab {
    cursor: pointer;
    margin-right: 6px;
    display: inline-block;
    color: #0092bf;
  }

  @media (min-width: 1024px) {
    .event-details__tab {
      margin-right: 20px;
    }
  }

  @media (min-width: 768px) {
    .event-details__tab {
      margin-right: 15px;
    }
  }

  .event-details__tab_active {
    text-decoration: underline;
  }

  .event-details__no-user {
    margin-top: 10px;
  }

  .event-details .highlight {
    margin-top: 0;
    margin-bottom: 0;
  }
</style>