<script setup lang="ts">
  import { computed } from 'vue'
  import { nip19 } from 'nostr-tools'
  import MainMenu from '@/components/MainMenu.vue'
  import MainSearchField from '@/components/MainSearchField.vue'
  import { useOwnProfile } from '@/stores/OwnProfile'
  import { useNpub } from '@/stores/Npub'
  import { useUser } from '@/stores/User'
  import { useNsec } from '@/stores/Nsec'
  import { useRouter } from 'vue-router'
  import { useRelay } from '@/stores/Relay'
  import { getUserUrlPath } from '@/utils/utils'

  const emit = defineEmits(['clearAppState'])

  const ownProfileStore = useOwnProfile()
  const npubStore = useNpub()
  const userStore = useUser()
  const nsecStore = useNsec()
  const relayStore = useRelay()
  const router = useRouter()

  const username = computed(() =>
    nsecStore.isValidNsecPresented() && ownProfileStore.username.length
      ? ownProfileStore.username
      : '',
  )

  const handleUserClick = () => {
    const pubkey = nsecStore.getPubkey()
    const urlNpub = nip19.npubEncode(pubkey)
    npubStore.updateNpubInput(urlNpub)
    userStore.updateRoutingStatus(true)
    router.push({ path: getUserUrlPath(pubkey) })
  }

  const handleLoginClick = async () => {
    await emit('clearAppState')
  }
</script>

<template>
  <div class="header">
    <div :class="['menu', { loggedin: nsecStore.isValidNsecPresented() }]">
      <MainMenu />
      <a
        v-if="username.length"
        class="username-link"
        @click.prevent="handleUserClick"
        :href="getUserUrlPath(nsecStore.getPubkey())"
      >
        @{{ username }}
      </a>
      <span class="connect-wrapper" v-else>
        <a
          v-if="relayStore.isConnectedToRelay"
          @click.prevent="handleLoginClick"
          class="login-link"
          href="/login"
        >
          Login
        </a>
        <button v-else class="connect-btn" @click="handleLoginClick">Connect</button>
      </span>
    </div>
    <MainSearchField />
  </div>
</template>

<style scoped>
  .header {
    margin-top: 15px;
  }

  .menu {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-direction: column;
  }

  @media (min-width: 485px) {
    .menu {
      flex-direction: row;
      align-items: normal;
    }

    .menu.loggedin {
      align-items: center;
    }
  }

  .username-link {
    text-decoration: none;
  }

  .username-link:hover {
    cursor: pointer;
    color: #0092bf;
  }

  .connect-btn {
    font-size: 16px;
    cursor: pointer;
    background: #0092bf;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    text-decoration: none;
    width: 100%;
  }

  @media (min-width: 485px) {
    .connect-btn {
      width: auto;
    }
  }

  .connect-btn:hover {
    background: #0077a3;
  }

  .connect-btn:active {
    opacity: 0.9;
  }

  .login-link {
    text-decoration: none;
  }

  .login-link:hover {
    color: #0092bf;
  }

  .connect-wrapper {
    display: inline-block;
    width: 100%;
    margin-top: 10px;
  }

  @media (min-width: 485px) {
    .connect-wrapper {
      display: inline;
      width: auto;
    }
  }
</style>
