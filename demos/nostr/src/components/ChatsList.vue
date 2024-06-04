<script setup lang="ts">
  import type { Chat } from '@/types'
  
  defineProps<{
    chats: Chat[]
    currentChatId: string
    showChatsList: boolean
    handleSelectChat: (chatId: string) => void
  }>()
</script>

<template>
  <div :class="['chats__list', {'chats__list_mobile-hidden': !showChatsList} ]">
    <div v-if="!chats.length" class="no-chats">
      No chats yet...
    </div>
    <div 
      v-for="chat in chats"
      :key="chat.id" 
      :class="['chats__list-item', {'active': currentChatId === chat.id}]"
      @click="handleSelectChat(chat.id)"
    >
      <strong>{{ chat.title }}</strong>
    </div>
  </div>
</template>

<style scoped>
  .chats__list {
    width: 168px;
    min-width: 168px;
    padding-right: 10px;
    overflow-y: scroll;
  }

  @media screen and (min-width: 500px) {
    .chats__list {
      border-right: 1px solid #bbb;
    }
  }

  .chats__list_mobile-hidden {
    display: none;
  }

  @media screen and (min-width: 500px) {
    .chats__list_mobile-hidden {
      display: block;
    }
  }

  .chats__list-item {
    padding: 10px 0;
    cursor: pointer;
  }

  .chats__list-item.active {
    color: #0092bf;
  }
</style>