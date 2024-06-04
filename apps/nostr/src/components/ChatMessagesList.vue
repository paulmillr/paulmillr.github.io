<script setup lang="ts">
  import { formatedDateYear } from '../utils'
  import type { ChatMessage } from '@/types';

  defineProps<{
    messages: ChatMessage[]
    userPubkey: string
  }>()
</script>

<template>
  <div :class="['message-line', { 'own': msg.event.pubkey === userPubkey } ]" v-for="msg in messages">
    <div :class="['message', { 'own': msg.event.pubkey === userPubkey } ]">
      <div>{{ msg.event.content }}</div>
    </div>
    <div class="message-date">
      {{ msg.isPublished ? formatedDateYear(msg.event.created_at) : 'sending...' }}
    </div>
  </div>
</template>

<style scoped>
  .message-line {
    text-align: left;
    margin: 10px 0;
  }

  .message-line.own {
    text-align: right;
  }

  .message {
    border: 1px solid #bbb;
    display: inline-block;
    padding: 2px 8px;
    border-radius: 5px;
    border-bottom-left-radius: 0;
  }

  .message.own {
    border-color: #0092bf;
    border-radius: 5px;
    border-bottom-right-radius: 0;
  }

  .message-date {
    margin-top: 3px;
    color: rgb(113, 118, 123);
    font-size: 14px;
  }
</style>