<script setup lang="ts">
  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'

  const emit = defineEmits(['logout'])

  const nsecStore = useNsec()
  const relayStore = useRelay()

  const logout = () => {
    emit('logout')
  }
</script>

<template>
  <div v-if="relayStore.isConnectedToRelay" class="logout-block">
    <button class="logout-btn" @click="logout">
      <span v-if="nsecStore.isValidNsecPresented()">
        Log Out <i class="bi bi-door-closed"></i>
      </span>
      <span v-else>Disconnect <i class="bi bi-door-closed"></i></span>
    </button>
  </div>
</template>

<style scoped>
  .logout-block {
    border-top: 1px solid #2a2f3b;
    padding-top: 25px;
  }

  .logout-btn {
    font-size: 16px;
    cursor: pointer;
    background: #2a2f3b;
    color: #de6262;
    border: none;
    border-radius: 5px;
    padding: 4px 12px;
    cursor: pointer;
    transition: background 0.2s;
    text-decoration: none;
    line-height: 1.5;
  }

  .logout-btn:hover {
    background: #323741;
  }

  .logout-btn:active {
    opacity: 0.9;
  }
</style>
