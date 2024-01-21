<script setup lang="ts">
  import { ref, watchEffect } from 'vue'
  import { nip19, verifySignature, type Event } from 'nostr-tools'
  import RawData from './RawData.vue'
  import EventActionsBar from './EventActionsBar.vue'
  import type { Author, EventExtended } from './../types'

  const props = defineProps<{
    event: EventExtended
    authorEvent: Event
    author: Author
    isUserProfile: boolean
    key: string
  }>()

  const event = ref<Event>()
  const isSigVerified = ref(false)
  const isSigValid = ref(false)
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

  const formatedDate = (timestamp: number) => {
    const ms = timestamp * 1000
    return new Date(ms).toLocaleString();
  }

  const handleCheckSignature = () => {
    if (isSigVerified.value) return
    isSigVerified.value = true
    isSigValid.value = verifySignature(event.value as Event)
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
        <div class="btn-field">
          <label class="btn-field__label"><b>Signature:</b></label>
          <input
            class="btn-field__input"
            readonly
            v-model="sig"
            type="text"
          >
          <button @click="handleCheckSignature" class="btn-field__btn">
            {{ !isSigVerified && !isSigValid ? 'Check' : isSigVerified && isSigValid ?  'Ok ✅' : '❌' }}
          </button>
        </div>
    </div>

    <RawData v-if="showRawData" :isUserEvent="true" :event="event" :authorEvent="authorEvent" />

    <div class="event-footer" :class="{ 'event-footer_block': isUserProfile }">
      <EventActionsBar v-if="!isUserProfile" :likes="likes" :reposts="reposts" />
      <span class="event-footer-code" @click="handleToggleRawData">{...}</span>
    </div>
  </div>
</template>

<style scoped>
  .event__header {
    margin-bottom: 15px;
  }

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
  }

  .col {
    padding: 4px 0;
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

  .btn-field {
    display: flex;
    align-items: start;
    flex-direction: column;
    position: relative;
  }

  @media (min-width: 768px) {
    .btn-field {
      display: flex;
      align-items: center;
      flex-direction: row;
    }
  }

  .btn-field__label {
    margin-right: 10px;
    color: #999;
  }

  .btn-field__input {
    flex-grow: 1;
    background: transparent;
    padding: 10px 12px;
    border: 1px solid white;
    font-size: 1.125rem;
    color: #ddd;
    font-weight: normal;
    font-family: 'PT Mono', 'Menlo', monospace;

    padding: 10px 2%;
    width: 96%;
    margin-top: 5px;
  }

  @media (min-width: 768px) {
    .btn-field__input {
      padding: 10px 80px 10px 12px;
      width: 100%;
      margin-top: 0;
    }
  }

  .btn-field__btn {
    position: absolute;
    right: 0;
    top: 3px;
    width: 60px;
  }

  @media (min-width: 768px) {
    .btn-field__btn {
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
    }
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

  .event-footer_block {
    display: block;
    text-align: right;    
  }

  .event-footer-code {
    cursor: pointer;
  }

  button {
    cursor: pointer;
  }
</style>