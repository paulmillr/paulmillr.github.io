<script setup lang="ts">
  import { computed } from 'vue'
  import { useFeed } from '@/stores/Feed'
  import { useImages } from '@/stores/Images'

  const feedStore = useFeed()
  const imagesStore = useImages()

  const newAuthorImg1 = computed(() => feedStore.newEventsBadgeImageUrls[0])
  const newAuthorImg2 = computed(() => feedStore.newEventsBadgeImageUrls[1])
  const newEventsCount = computed(() => feedStore.newEventsBadgeCount)

  const emit = defineEmits(['loadNewRelayEvents'])

  const loadNewRelayEvents = () => {
    emit('loadNewRelayEvents')
  }
</script>

<template>
  <div
    @click="loadNewRelayEvents"
    :class="['new-events', { 'new-events_top-shifted': feedStore.isLoadingNewEvents }]"
  >
    <div
      v-if="imagesStore.showImages && feedStore.newEventsBadgeImageUrls.length"
      class="new-events__imgs"
    >
      <img class="new-events__img" :src="newAuthorImg1" alt="user's avatar" />
      <img class="new-events__img" :src="newAuthorImg2" alt="user's avatar" />
    </div>
    <span class="new-events__text">
      {{ newEventsCount }} new note{{ newEventsCount > 1 ? 's' : '' }}
    </span>
    <b>↑</b>
  </div>
</template>

<style scoped>
  .new-events {
    position: absolute;
    z-index: 1;
    padding: 4px 8px;
    top: 0px;
    left: 50%;
    transform: translate(-50%, 0);
    background: #0092bf;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 200px;
    border-bottom-right-radius: 5px;
    border-bottom-left-radius: 5px;
  }

  .new-events_top-shifted {
    top: 60px;
  }

  @media (min-width: 768px) {
    .new-events {
      padding: 4px 14px;
      width: auto;
    }
  }

  .new-events__img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid white;
  }

  .new-events__text {
    margin-left: 5px;
    margin-right: 5px;
  }

  .new-events__imgs {
    display: flex;
  }
  .new-events__img:first-child {
    margin-right: -10px;
  }
</style>
