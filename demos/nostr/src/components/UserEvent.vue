<script setup lang="ts">
  import { ref, watchEffect, onMounted } from 'vue'
  import { nip19, verifySignature, type Event } from 'nostr-tools'
  import RawData from './RawData.vue'
  import EventActionsBar from './EventActionsBar.vue'
  import type { Author, EventExtended } from './../types'
  import CheckSquareIcon from './../icons/CheckSquareIcon.vue'
  import InvalidSignatureIcon from './../icons/InvalidSignatureIcon.vue'

  const props = defineProps<{
    event: EventExtended
    authorEvent: Event
    author: Author
    isUserProfile: boolean
    key: string
  }>()

  const event = ref<Event>()
  const showRawData = ref(false)
  const showHexId = ref(false)
  const showHexPubkey = ref(false)

  const id = ref('')
  const sig = ref('')
  const pubkey = ref('')
  const created_at = ref(0)
  const likes = ref(0)
  const reposts = ref(0)
  const isUserProfile = ref(false)
  const isSigVerified = ref(false)

  watchEffect(() => {
    event.value = props.event
    id.value = props.event.id
    sig.value = props.event.sig
    pubkey.value = props.event.pubkey
    created_at.value = props.event.created_at
    likes.value = props.event.likes
    reposts.value = props.event.reposts
    isUserProfile.value = props.isUserProfile
  })

  onMounted(() => {
    isSigVerified.value = verifySignature(props.event as Event)
  })

  const formatedDate = (timestamp: number) => {
    const ms = timestamp * 1000
    return new Date(ms).toLocaleString();
  }

  const handleToggleRawData = () => {
    showRawData.value = !showRawData.value
  }
</script>

<template>
  <div class="event">
    <div v-if="!showRawData" class="event__content">
      <slot>No content for event</slot>
      <hr>

      <div class="event__field">
        <div class="header-col"><b>Author: </b></div>
        <div class="content-col content-col_code">
          <div class="code-wrapper">
            <code>
              {{ showHexPubkey ? pubkey : nip19.npubEncode(pubkey) }}
            </code>
            <button @click="showHexPubkey = !showHexPubkey">
              {{ showHexPubkey ? 'npub' : 'hex' }}
            </button>
          </div>
        </div>
      </div>
      <div class="event__field">
        <div class="header-col"><b>Event id: </b></div>
        <div class="content-col content-col_code">
          <div class="code-wrapper">
            <code>
              {{ showHexId ? id : nip19.neventEncode({ id }) }}
            </code>
            <button @click="showHexId = !showHexId">
              {{ showHexId ? 'nevent' : 'hex' }}
            </button>
          </div>
        </div>
      </div>
      <div class="event__field">
        <div class="header-col"><b>Kind: </b></div>
        <div class="content-col"><code>0 - PROFILE METADATA</code></div>
      </div>
      <div class="event__field">
        <div class="header-col"><b>Date: </b></div>
        <div class="content-col"><code>{{ formatedDate(created_at) }}</code></div>
      </div>
    </div>

    <RawData v-if="showRawData" :isUserEvent="true" :event="event" :authorEvent="authorEvent" />

    <div class="event-footer" :class="{ 'event-footer_flex-end': !showRawData }">
      <div v-if="showRawData" :class="['event-footer__signature', { 'event-footer__signature_invalid': !isSigVerified }]">
        <CheckSquareIcon v-if="isSigVerified" /> 
        <InvalidSignatureIcon v-if="!isSigVerified" />
        <span class="event-footer__signature-text">
          {{ isSigVerified ? 'Signature is valid' : 'Invalid signature' }}
        </span>
      </div>
      <div>
        <EventActionsBar v-if="!isUserProfile" :likes="likes" :reposts="reposts" />
        <span class="event-footer-code" @click="handleToggleRawData">{...}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .event__field {
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .event__field {
      flex-direction: row;
    }
  }

  .code-wrapper {
    display: inline-flex;
    flex-direction: column;
    align-items: end;
  }

  @media (min-width: 768px) {
    .code-wrapper {
      flex-direction: row;
      align-items: center;
    }
  }

  .code-wrapper button {
    margin-left: 10px;
    font-size: 14px;
    min-width: 60px;
  }

  .header-col {
    text-align: left;
    color: #999;
  }

  @media (min-width: 768px) {
    .header-col {
      text-align: right;
    }
  }

  .content-col {
    padding-left: 0px;
  }

  @media (min-width: 768px) {
    .content-col {
      padding-left: 10px;
    }
  }

  .content-col_code {
    line-break: anywhere;
  }

  .event {
    border: 1px solid white;
    padding: 14px;
    margin-top: 25px;
  }

  /* common styles */

  .event-footer {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
  }

  .event-footer_flex-end {
    justify-content: flex-end;
  }

  .event-footer-code {
    cursor: pointer;
  }

  button {
    cursor: pointer;
  }

  .event-footer__signature {
    display: flex;
    align-items: center;
  }

  .event-footer__signature-text {
    margin-left: 5px;
  }

  .event-footer__signature_invalid {
    color: red;
  }
</style>