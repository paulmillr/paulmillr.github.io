<script setup lang="ts">
  import type { LogContentPart } from './../types';

  const props = defineProps<{
    eventsLog: LogContentPart[][]
  }>()
</script>

<template>
  <div class="log">
    <strong>Relay events log</strong>
    <ul class="log__list">
      <li class="log__list-item" v-for="log in props.eventsLog">
        <template v-for="{ type, value } in log">
          <span v-if="type === 'text'">{{ value }}</span>
          <b v-else="type === 'bold'">{{ value }}</b>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
  .log {
    border: 1px solid #bbb;
    padding: 14px;
    margin: 1rem 0;
  }

  .log__list {
    padding-left: 18px;
    padding-top: 5px;
    padding-bottom: 5px;
  }

  .log__list-item {
    margin-bottom: 10px;
    word-wrap: break-word;
  }
</style>