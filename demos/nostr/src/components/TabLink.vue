<script setup lang="ts">
  const props = defineProps<{
    isActive: boolean
  }>()
  const emit = defineEmits(['click'])
</script>

<template>
  <span
    :class="['tab-link', { 'tab-link_active': props.isActive }]"
    @click="emit('click')" 
  >
    <slot></slot>
  </span>
</template>

<style scoped>
  .tab-link {
    color: #0092bf;
    margin-right: 15px;
    cursor: pointer;
    display: inline-block;
  }

  .tab-link:hover {
    text-decoration: underline;
  }

  .tab-link_active {
    text-decoration: underline;
  }
</style>