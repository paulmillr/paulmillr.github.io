<script setup lang="ts">
  import EmptyHeartIcon from './../icons/EmptyHeartIcon.vue'
  import ArrowRepeatIcon from './../icons/ArrowRepeatIcon.vue'
  import ReplyIcon from './../icons/ReplyIcon.vue'

  const emit = defineEmits(['showReplyField'])

  defineProps<{
    likes: number
    reposts: number
    hasReplyBtn?: boolean
  }>()

  const handleShowReplyField = () => {
    emit('showReplyField')
  }
</script>

<template>
  <div class="actions-bar">
    <span class="actions-bar__action actions-bar__likes">
      <EmptyHeartIcon class="actions-bar__icon" />
      <span class="actions_bar-number">{{ likes }}</span>
    </span>
    <span class="actions-bar__action actions-bar__repost">
      <ArrowRepeatIcon class="actions-bar__icon" />
      <span class="actions_bar-number">{{ reposts }}</span>
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

  .actions-bar__likes {
    margin-right: 12px;
  }

  .actions-bar__repost {
    margin-right: 12px;
  }

  .actions-bar__reply {
    position: relative;
    top: 2px;
    cursor: pointer;
  }

  .actions-bar__icon {
    margin-right: 5px;
  }
</style>