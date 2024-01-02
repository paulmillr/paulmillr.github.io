<script setup lang="ts">
  const props = defineProps<{
    showImages: boolean
  }>()

  const emit = defineEmits(['handlePrivacyClick', 'toggleImages']);
</script>

<template>
  <div class="show-images">
    <span class="show-images__field">
      <input @change="emit('toggleImages')" class="show-images__input" type="checkbox" id="show-feed-images" :checked="props.showImages" />
      <label class="show-images__label" for="show-feed-images"> Show avatars</label>
    </span>
    <small> (<a @click="emit('handlePrivacyClick')" href="#?help=privacy">Exposes your IP</a>)</small>
  </div>
</template>

<style>
  .show-images__input,
  .show-images__label {
    cursor: pointer;
  }
</style>