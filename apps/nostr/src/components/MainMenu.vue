<script setup lang="ts">
  import { computed } from 'vue'
  import { useNpub } from '@/stores/Npub'
  const npubStore = useNpub()

  const userTabLink = computed(() =>
    npubStore.cachedUrlNpub.length ? `/user/${npubStore.cachedUrlNpub}` : '/user',
  )
</script>

<template>
  <div class="tabs">
    <router-link class="tab-link" to="/feed">
      <span class="tab-link-text">
        <i class="tab-icon bi bi-justify-right"></i>
        Feed
      </span>
    </router-link>
    <router-link class="tab-link" to="/chat">
      <span class="tab-link-text">
        <i class="tab-icon bi bi-chat-dots"></i>
        Chat
      </span>
    </router-link>
    <router-link class="tab-link" to="/help">
      <span class="tab-link-text">
        <i class="tab-icon bi bi-info-circle"></i>
        Help
      </span>
    </router-link>
    <!-- <router-link class="tab-link" to="/log">
      <span class="tab-link-text">
        <i class="tab-icon bi bi-file-earmark-text"></i>
        Log
      </span>
    </router-link> -->
    <router-link class="tab-link" to="/settings">
      <span class="tab-link-text">
        <i class="tab-icon bi bi-gear"></i>
        Settings
      </span>
    </router-link>
  </div>
</template>

<style scoped>
  .tabs {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  @media (min-width: 411px) {
    .tabs {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  @media (min-width: 510px) {
    .tabs {
      display: block;
    }
  }

  .tab-link {
    display: inline-block;
    /* color: #0092bf; */
    text-decoration: none;
    cursor: pointer;
    padding: 5px 0;
    border-bottom: 2px solid transparent;
  }

  svg {
    margin-right: 4px;
  }

  .tab-icon {
    font-size: 16px;
    margin-right: 4px;
  }

  .tab-link-text {
    padding: 3px 8px;
    border-radius: 5px;
    display: flex;
    align-items: center;
  }

  @media (min-width: 510px) {
    .tab-link {
      margin-right: 5px;
    }
  }

  .tab-link:hover .tab-link-text {
    /* background-color: #2a2f3b; */
    color: #0092bf;
  }

  .tab-link:hover {
    /* border-bottom: 2px solid #0092bf; */
  }

  .tab-link.router-link-active {
    /* text-decoration: underline; */
    border-bottom: 2px solid #0092bf;
    font-weight: bold;
  }
</style>
