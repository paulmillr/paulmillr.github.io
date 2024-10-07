<script setup lang="ts">
  import ShowImagesCheckbox from '@/components/ShowImagesCheckbox.vue'
  import { useImages } from '@/stores/Images'

  const imagesStore = useImages()

  const toggleImages = () => {
    imagesStore.updateShowImages(!imagesStore.showImages)
  }
</script>

<template>
  <h4>Images:</h4>
  <ShowImagesCheckbox :showImages="imagesStore.showImages" @toggleImages="toggleImages" />
</template>

<style scoped>
  h4 {
    margin-bottom: 10px;
  }
</style>
