<script setup lang="ts">
  const props = defineProps<{
    showImages: boolean
  }>()

  const emit = defineEmits(['toggleImages']);
</script>

<template>
  <div class="show-images">
    <span class="show-images__field">
      <input @change="emit('toggleImages')" class="show-images__input" type="checkbox" id="show-feed-images" :checked="props.showImages" />
      <label class="show-images__label" for="show-feed-images"> Show avatars</label>
    </span>
    <small> (<router-link :to="{ path: '/help', hash: '#privacy' }">Exposes your IP</router-link>)</small>
  </div>
</template>

<style>
  .show-images__input,
  .show-images__label {
    cursor: pointer;
  }
</style>