<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { connectToSelectedRelay } from '@/utils/network'
  import Dropdown from '@/components/Dropdown.vue'
  import { utils, Relay, type Event } from 'nostr-tools'
  import { DEFAULT_RELAY, DEFAULT_RELAYS } from '@/app'
  import { useRouter } from 'vue-router'
  import { relayGet, parseRelaysNip65 } from '@/utils'
  import { getConnectedReadWriteRelays } from '@/utils/network'
  import { EVENT_KIND } from '@/nostr'

  import { useNsec } from '@/stores/Nsec'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { useOwnProfile } from '@/stores/OwnProfile'
  import { useUser } from '@/stores/User'
  import { usePool } from '@/stores/Pool'

  const poolStore = usePool()
  const pool = poolStore.pool

  const relayStore = useRelay()
  const nsecStore = useNsec()
  const feedStore = useFeed()
  const ownProfileStore = useOwnProfile()
  const userStore = useUser()
  const router = useRouter()

  const selectedRelay = ref<string>(DEFAULT_RELAY)
  const showCustomRelayUrl = computed(() => selectedRelay.value === 'custom')
  // const showRememberMe = computed(() => nsecStore.isValidNsecPresented())
  const loginError = ref('')
  const isConnectingToRelays = ref(false)

  const dropdownRelays = DEFAULT_RELAYS.map((r: string) => ({ key: r, value: r })).concat({
    key: 'custom',
    value: 'Custom relay url',
  })

  let afterLoginPath = '/feed'
  let redirectToUser = false

  onMounted(() => {
    if (isRedirectedFromSearch()) {
      afterLoginPath = history.state.back
      redirectToUser = true
    }
  })

  const isRedirectedFromSearch = () => {
    return history.state && /^\/(user|event)\/[a-zA-Z0-9]+$/g.test(history.state.back)
  }

  const handleSelect = (selected: string) => {
    selectedRelay.value = selected
  }

  const showError = (msg: string) => {
    loginError.value = msg
  }

  const handleConnectClick = async () => {
    let relayUrl = selectedRelay.value
    if (relayUrl === 'custom') {
      const customUrl = relayStore.selectInputCustomRelayUrl
      relayUrl = customUrl.length ? customUrl : ''
    }
    if (!relayUrl.length) {
      return showError('Please provide relay URL or choose one from the list.')
    }

    relayUrl = utils.normalizeURL(relayUrl)
    if (!relayUrl.length) {
      return showError('Invalid relay URL')
    }

    if (isConnectingToRelays.value) return

    if (nsecStore.isNotValidNsecPresented()) {
      return showError('Private key is invalid. Please check it and try again.')
    } else if (nsecStore.isValidNsecPresented()) {
      nsecStore.updateCachedNsec(nsecStore.nsec)
    }

    let relay: Relay

    isConnectingToRelays.value = true
    try {
      relay = await connectToSelectedRelay(relayUrl)
    } catch (err: any) {
      isConnectingToRelays.value = false
      return showError(err.message)
    }
    relayStore.updateCurrentRelay(relay)

    if (nsecStore.isValidNsecPresented()) {
      const pubkey = nsecStore.getPubkey()
      const authorMeta = (await relayGet(
        relay,
        [{ kinds: [EVENT_KIND.META], limit: 1, authors: [pubkey] }],
        3000, // timeout
      )) as Event

      if (!authorMeta) {
        isConnectingToRelays.value = false
        return showError(
          'Your profile was not found on the selected relay. Please check the private key or change the relay and try again.',
        )
      }

      ownProfileStore.updateMeta(authorMeta)
      feedStore.setSelectedFeedSource('follows')

      let relayListMeta = (await relayGet(
        relay,
        [{ kinds: [EVENT_KIND.RELAY_LIST_META], limit: 1, authors: [pubkey] }],
        3000, // timeout
      )) as Event

      if (relayListMeta.tags.length) {
        // refetch again relays list, because on selected relay data can be outdated
        const relays = relayListMeta.tags.map((tag) => tag[1])
        const freshMeta = await pool.get(relays, {
          kinds: [EVENT_KIND.RELAY_LIST_META],
          authors: [pubkey],
          limit: 1,
        })

        // get the latest relay list meta from selected relay and user's relays
        if (freshMeta && freshMeta.tags.length && freshMeta.created_at > relayListMeta.created_at) {
          relayListMeta = freshMeta
        }

        const { read, write } = parseRelaysNip65(relayListMeta)
        relayStore.setReedRelays(read)
        relayStore.setWriteRelays(write)
      }

      // const startTime = Date.now()

      relayStore.setIsConnectingToReadWriteRelaysStatus(true)
      relayStore.setIsConnectedToReadWriteRelaysStatus(false)

      const {
        userConnectedReadRelays,
        userConnectedWriteRelays,
      }: {
        userConnectedReadRelays: string[]
        userConnectedWriteRelays: string[]
      } = await getConnectedReadWriteRelays(relayStore.userReadWriteRelays)
      relayStore.setConnectedUserReadRelayUrls(userConnectedReadRelays)
      relayStore.setConnectedUserWriteRelayUrls(userConnectedWriteRelays)

      relayStore.setIsConnectingToReadWriteRelaysStatus(false)
      relayStore.setIsConnectedToReadWriteRelaysStatus(true)

      // const endTime = Date.now()
      // const executionTime = (endTime - startTime) / 1000
      // console.log(`Execution time for connecting relays: ${executionTime} seconds`)
    }

    isConnectingToRelays.value = false
    feedStore.setMountAfterLogin(true)

    if (redirectToUser) {
      userStore.updateRoutingStatus(true)
    }
    router.push({ path: afterLoginPath })
  }
</script>

<template>
  <div class="fields">
    <div class="field">
      <label class="select-relay-label">
        <strong>Select relay</strong>
      </label>
      <Dropdown :listItems="dropdownRelays" @handleSelect="handleSelect" />
    </div>

    <div v-if="showCustomRelayUrl" class="field">
      <div class="field-elements">
        <input
          v-model="relayStore.selectInputCustomRelayUrl"
          class="text-input"
          id="relay_url"
          type="text"
          placeholder="[wss://]relay.example.com"
        />
      </div>
    </div>

    <div class="field">
      <label class="text-input-label" for="priv_key">
        <strong>Login with private key (optional)</strong>
      </label>
      <div class="field-elements">
        <input
          v-model="nsecStore.nsec"
          class="text-input"
          id="priv_key"
          type="password"
          placeholder="nsec..."
        />
      </div>
    </div>
    <!-- <ShowImagesCheckbox
      v-if="showRememberMe"
      :showImages="false"
      @toggleImages="
        () => {
          console.log('test')
        }
      "
    /> -->

    <div class="field">
      <button
        :disabled="isConnectingToRelays"
        @click="handleConnectClick"
        class="button button-block"
      >
        {{ isConnectingToRelays ? 'Connecting...' : 'Connect' }}
      </button>
    </div>

    <div class="error">{{ loginError }}</div>
  </div>
</template>

<style scoped>
  .select-relay-label {
    display: inline-block;
    margin-bottom: 5px;
  }

  .fields {
    width: 100%;
    margin: 2rem auto;
  }

  @media (min-width: 576px) {
    .fields {
      width: 60%;
    }
  }

  @media (min-width: 768px) {
    .fields {
      width: 50%;
    }
  }

  .field {
    margin-top: 15px;
    width: 100%;
  }

  .field-elements {
    overflow: hidden;
  }

  .text-input-label {
    display: inline-block;
    margin-bottom: 7px;
  }

  .text-input {
    background: #100f0f !important;
    color: inherit;
    border: 1px solid #2a2f3b;
    outline: none;
    border-radius: 5px;
    padding: 6px 12px;
    width: 100%;
    box-sizing: border-box;
  }

  .text-input:focus {
    border: 1px solid #0092bf;
    background: #100f0f !important;
  }

  .button {
    background: #0092bf;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
  }

  .button:active {
    opacity: 0.9;
  }

  .button:hover {
    background: #0077a3;
  }

  .button:disabled {
    background: #0077a3;
    opacity: 1;
  }

  .button-block {
    display: block;
  }

  .error {
    color: #ff4040;
    font-size: 16px;
    margin-top: 10px;
  }
</style>
