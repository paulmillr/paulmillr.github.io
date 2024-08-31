<script setup lang="ts">
  import { useImages } from '@/stores/Images'
  import Checkbox from '@/components/Checkbox.vue'
  const imagesStore = useImages()

  const toggleImages = () => {
    imagesStore.updateShowImages(!imagesStore.showImages)
  }
</script>

<template>
  <div class="wrapper">
    <Checkbox @onChange="toggleImages" :checked="imagesStore.showImages" :label="'Show avatars'" />
    <small>
      (<router-link :to="{ path: '/help', hash: '#privacy' }">Exposes your IP</router-link>)
    </small>
  </div>
</template>

<style>
  .wrapper {
    display: flex;
    align-items: center;
    margin-top: 2px;
  }

  small {
    line-height: 1;
  }
</style>
