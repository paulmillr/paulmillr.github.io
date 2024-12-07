<script setup lang="ts">
  import Images from '@/components/settings/Images.vue'
  import Relays from '@/components/settings/Relays.vue'
  import Keys from '@/components/settings/Keys.vue'
  import Logout from '@/components/settings/Logout.vue'

  const emit = defineEmits(['clearAppState'])

  const logout = async () => {
    const clearUserData = true
    await emit('clearAppState', clearUserData)
  }
</script>

<template>
  <Images />
  <Relays />
  <Keys />
  <Logout @logout="logout" />
</template>
