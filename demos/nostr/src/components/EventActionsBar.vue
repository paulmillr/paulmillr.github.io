<script setup lang="ts">
  import EmptyHeartIcon from './../icons/EmptyHeartIcon.vue'
  import ArrowRepeatIcon from './../icons/ArrowRepeatIcon.vue'
  import ReplyIcon from './../icons/ReplyIcon.vue'
  import ChatIcon from '@/icons/ChatIcon.vue'

  const emit = defineEmits(['showReplyField', 'handleShowReplies', 'handleHideReplies'])

  defineProps<{
    likes: number
    reposts: number
    replies: number
    hasReplyBtn?: boolean
  }>()

  const handleShowReplyField = () => {
    emit('showReplyField')
  }

  const handleShowReplies = () => {
    emit('handleShowReplies')
  }
</script>

<template>
  <div class="actions-bar">
    <span class="actions-bar__action actions-bar__num">
      <EmptyHeartIcon class="actions-bar__icon" />
      <span class="actions_bar-number">{{ likes }}</span>
    </span>
    <span class="actions-bar__action actions-bar__num">
      <ArrowRepeatIcon class="actions-bar__icon" />
      <span class="actions_bar-number">{{ reposts }}</span>
    </span>
    <span v-if="hasReplyBtn" @click="handleShowReplies" class="actions-bar__action actions-bar__num actions-bar__replies">
      <ChatIcon class="actions-bar__icon" />
      <span class="actions_bar-number">{{ replies }}</span>
    </span>
    <span v-if="hasReplyBtn" @click="handleShowReplyField" class="actions-bar__action actions-bar__reply">
      <ReplyIcon class="actions-bar__icon" />
    </span>
  </div>
</template>

<style>
  .actions-bar__action {
    display: inline-flex;
    align-items: center;
    position: relative;
  }

  .actions-bar__num {
    margin-right: 10px;
  }

  .actions-bar__replies {
    cursor: pointer;
  }

  .actions-bar__reply {
    position: relative;
    top: 3px;
    cursor: pointer;
  }

  .actions-bar__icon {
    margin-right: 5px;
  }
</style>