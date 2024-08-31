<script setup lang="ts">
  import { ref } from 'vue'
  import FeedSourceSelect from '@/components/FeedSourceSelect.vue'
  import ShowImagesCheckbox from '@/components/ShowImagesCheckbox.vue'

  const props = defineProps<{
    isDisabledSourceSelect: boolean
  }>()

  const notice = ref('')

  const showFeedNotice = (value: string) => {
    notice.value = value
    setTimeout(() => {
      notice.value = ''
    }, 5000)
  }
</script>

<template>
  <div class="feed-header">
    <FeedSourceSelect
      class="dropdown"
      :disabled="props.isDisabledSourceSelect"
      @showFeedNotice="showFeedNotice"
    />
    <ShowImagesCheckbox />
  </div>
  <div v-if="notice.length" class="warning">{{ notice }}</div>
</template>

<style scoped>
  .feed-header {
    display: flex;
    justify-content: space-between;
    align-items: self-start;
    flex-direction: column-reverse;
    margin-bottom: 10px;
  }

  @media (min-width: 425px) {
    .feed-header {
      flex-direction: row;
      align-items: center;
    }
  }

  .warning {
    color: #ffda6a;
    font-size: 16px;
    margin-top: 5px;
  }

  .dropdown {
    margin-top: 10px;
  }

  @media (min-width: 425px) {
    .dropdown {
      margin-top: 0px;
    }
  }
</style>
