<script setup lang="ts">
  import { ref } from 'vue'
  import { utils, finalizeEvent } from 'nostr-tools'
  import { usePool } from '@/stores/Pool'
  import { useRelay } from '@/stores/Relay'
  import { useNsec } from '@/stores/Nsec'
  import { useFeed } from '@/stores/Feed'
  import { publishEventToRelays } from '@/utils/utils'
  import Checkbox from '@/components/Checkbox.vue'

  const poolStore = usePool()
  const pool = poolStore.pool

  const relayStore = useRelay()
  const nsecStore = useNsec()
  const feedStore = useFeed()

  const relaysError = ref('')
  const newRelayUrl = ref('')
  const relayUrlError = ref('')
  const UPDATING_RELAY_ERROR =
    'Updating relays error. Please reload the page and try again or write us about the issue.'

  const prepareNip65Event = (tags: any) => {
    relaysError.value = ''
    const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : ''
    if (!nsecValue.length) {
      relaysError.value = 'Please provide your private key.'
      return
    }

    let privkey: Uint8Array | null
    let pubkey: string
    try {
      privkey = nsecStore.getPrivkeyBytes()
      if (!privkey) {
        throw new Error()
      }
      pubkey = nsecStore.getPubkey()
      if (!pubkey.length) {
        throw new Error()
      }
    } catch (e) {
      relaysError.value = `Invalid private key. Please check it and try again.`
      return
    }

    const event = {
      kind: 10002,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: tags,
    }

    return finalizeEvent(event, privkey)
  }

  const handleWriteClick = async (e: any, relay: string) => {
    relaysError.value = ''
    const isChecked = e.target.checked
    if (isChecked) {
      relayStore.addWriteRelay(relay)
    } else {
      relayStore.removeWriteRelay(relay)
    }

    const tags = relayStore.nip65Tags
    const signedEvent = prepareNip65Event(tags)

    if (!signedEvent) {
      relaysError.value = UPDATING_RELAY_ERROR
      return
    }

    const result = await publishEventToRelays(
      relayStore.allRelaysUrlsWithSelectedRelay,
      pool,
      signedEvent,
    )
    const hasSuccess = result.some((data: any) => data.success)
    if (!hasSuccess) {
      relaysError.value = UPDATING_RELAY_ERROR
      return
    }

    feedStore.setToRemountFeed(true)
    if (isChecked) {
      relayStore.addConnectedUserWriteRelay(relay)
    } else {
      relayStore.removeConnectedUserWriteRelay(relay)
    }
  }

  const handleRemoveClick = async (relay: string) => {
    relaysError.value = ''
    relayStore.removeUserRelay(relay)

    const tags = relayStore.nip65Tags
    const signedEvent = prepareNip65Event(tags)

    if (!signedEvent) {
      relaysError.value = UPDATING_RELAY_ERROR
      return
    }

    const result = await publishEventToRelays(
      relayStore.allRelaysUrlsWithSelectedRelay,
      pool,
      signedEvent,
    )
    const hasSuccess = result.some((data: any) => data.success)
    if (!hasSuccess) {
      relaysError.value = UPDATING_RELAY_ERROR
    }

    feedStore.setToRemountFeed(true)
  }

  const handleAddRelay = async () => {
    let relay = ''
    relaysError.value = ''
    relayUrlError.value = ''

    try {
      relay = utils.normalizeURL(newRelayUrl.value)
    } catch (e) {
      relayUrlError.value = 'Invalid relay url.'
      return
    }

    relayStore.addUserRelay(relay)
    newRelayUrl.value = ''

    const tags = relayStore.nip65Tags
    const signedEvent = prepareNip65Event(tags)

    if (!signedEvent) {
      relaysError.value = UPDATING_RELAY_ERROR
      return
    }

    const result = await publishEventToRelays(
      relayStore.allRelaysUrlsWithSelectedRelay,
      pool,
      signedEvent,
    )
    const hasSuccess = result.some((data: any) => data.success)
    if (!hasSuccess) {
      relaysError.value = UPDATING_RELAY_ERROR
      relayStore.removeUserRelay(relay)
      return
    }

    feedStore.setToRemountFeed(true)
    relayStore.addConnectedUserReadRelay(relay)
  }
</script>

<template>
  <h4>Your relays:</h4>
  <div class="error">
    {{ relaysError }}
  </div>
  <ul class="relays">
    <li class="relay" v-for="(r, i) in relayStore.userReadWriteRelays" :key="i">
      {{ r.url }}
      <div class="actions">
        <Checkbox
          @onChange="(e) => handleWriteClick(e, r.url)"
          :checked="r.type === 'write'"
          :label="'publish to relay'"
        />
        <span class="actions__delimiter"> | </span>
        <span @click="() => handleRemoveClick(r.url)" class="actions__remove">
          <i class="bi bi-trash trash-icon"></i>
          <span class="actions__remove-label">remove</span>
        </span>
      </div>
    </li>
  </ul>
  <div
    v-if="
      relayStore.isConnectedToRelay &&
      nsecStore.isValidNsecPresented() &&
      !relayStore.userReadWriteRelays.length
    "
  >
    The list with your relays was not found on <b>{{ relayStore.currentRelay.url }}</b>
  </div>
  <div v-if="!relayStore.isConnectedToRelay || !nsecStore.isValidNsecPresented()">
    Please login to see and edit the list of your relays.
  </div>

  <div v-if="relayStore.isConnectedToRelay && nsecStore.isValidNsecPresented()">
    <h4>Add relay:</h4>
    <div class="add-relay">
      <input
        v-model="newRelayUrl"
        class="add-relay__input"
        type="text"
        placeholder="[wss://]relay.url"
      />
      <button @click="handleAddRelay" class="add-relay__btn">Add</button>
    </div>
    <div class="error">
      {{ relayUrlError }}
    </div>
  </div>
</template>

<style scoped>
  h4 {
    margin-bottom: 10px;
  }

  .relays {
    margin-top: 0;
  }

  .relay {
    margin-bottom: 15px;
  }

  .actions {
    display: flex;
    align-items: center;
  }

  .actions__remove-label {
    margin-bottom: 3px;
  }

  .actions__remove {
    cursor: pointer;
  }

  .actions__delimiter {
    margin: 0 5px;
  }

  .add-relay {
    display: flex;
  }

  .add-relay__input {
    flex-grow: 1;
    background: transparent;
    color: inherit;
    border: 1px solid #2a2f3b;
    outline: none;
    border-radius: 5px;
    padding: 6px 12px;
    box-sizing: border-box;
    width: 100%;
    font-size: 16px;
    margin-right: 5px;
  }

  .add-relay__input:focus {
    border-color: #0092bf;
  }

  .add-relay__btn {
    font-size: 14px;
    cursor: pointer;
    background: #2a2f3b;
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    text-decoration: none;
  }

  .add-relay__btn:hover {
    background: #323741;
  }

  .add-relay__btn:active {
    opacity: 0.9;
  }

  .trash-icon {
    color: orangered;
    cursor: pointer;
    margin-right: 5px;
    font-size: 16px;
  }

  .error,
  .warning {
    font-size: 16px;
    margin-top: 5px;
  }

  .error {
    color: #ff4040;
  }

  .warning {
    color: #ffda6a;
  }
</style>
