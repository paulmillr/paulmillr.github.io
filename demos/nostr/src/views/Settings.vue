<script setup lang="ts">
  import { ref } from 'vue'
  import { useRelay } from '@/stores/Relay'
  import TrashIcon from '@/icons/TrashIcon.vue'
  import { utils, nip19, finalizeEvent } from 'nostr-tools'
  import { usePool } from '@/stores/Pool'
  import { useNsec } from '@/stores/Nsec'
  import { usePubKey } from '@/stores/PubKey'

  const props = defineProps<{
    handleRelayConnect: Function
  }>()

  const poolStore = usePool()
  const nsecStore = useNsec()
  const pubKeyStore = usePubKey()

  const relayStore = useRelay()
  const newRelayUrl = ref('')
  const relayUrlError = ref('')
  const relaysError = ref('')
  const UPDATING_RELAY_ERROR = 'Updating relays error. Please reload the page and try again or write us about the issue.'
  
  const prepareNip65Event = (tags: any) => {
    relaysError.value = ''
    const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : ''
    if (!nsecValue.length) {
      relaysError.value = 'Please provide your private key.'
      return;
    }

    let privkey: Uint8Array | null;
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
      pubKeyStore.updateKeyFromPrivate(pubkey)
    } catch (e) {
      relaysError.value = `Invalid private key. Please check it and try again.`
      return;
    }

    const event = {
      kind: 10002,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: '',
      tags: tags
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
    const pool = poolStore.feedPool
    
    if (signedEvent) {
      return await pool.publish(relayStore.allRelaysUrlsWithConnectedRelay, signedEvent)
    }
    if (!relaysError.value.length) {
      relaysError.value = UPDATING_RELAY_ERROR
    }
  }

  const handleRemoveClick = async (relay: string) => {
    relaysError.value = ''
    relayStore.removeUserRelay(relay)
    props.handleRelayConnect(true)

    const tags = relayStore.nip65Tags
    const signedEvent = prepareNip65Event(tags)
    const pool = poolStore.feedPool

    // console.log('signedEvent', signedEvent)
    if (signedEvent) {
      return await pool.publish(relayStore.allRelaysUrlsWithConnectedRelay, signedEvent)
    }
    if (!relaysError.value.length) {
      relaysError.value = UPDATING_RELAY_ERROR
    }
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
    props.handleRelayConnect(true)
    newRelayUrl.value = ''

    const tags = relayStore.nip65Tags
    const signedEvent = prepareNip65Event(tags)
    const pool = poolStore.feedPool

    // console.log('signedEvent', signedEvent)
    if (signedEvent) {
      return await pool.publish(relayStore.allRelaysUrlsWithConnectedRelay, signedEvent)
    }
    if (!relaysError.value.length) {
      relaysError.value = UPDATING_RELAY_ERROR
    }
  }
</script>

<template>
  <h4>Your relays:</h4>
  <div class="error">
    {{ relaysError }}
  </div>
  <ul class="relays">
    <li class="relay" v-for="(r, i) in relayStore.allRelays">
      {{ r.url }} 
      <div class="actions">
        <input 
          @change="(e) => handleWriteClick(e, r.url)" 
          class="actions__checkbox" 
          type="checkbox" 
          :id="`write-${i}`" 
          :name="`write-${i}`" 
          :checked="r.type === 'write'" 
        />
        <label class="actions__label" :for="`write-${i}`"> publish to relay</label>
        <span class="actions__delimiter"> | </span>
        <span @click="() => handleRemoveClick(r.url)"  class="actions__remove">
          <TrashIcon class="trash-icon" /> 
          <span class="actions__remove-label">remove</span>
        </span>
      </div>
    </li>
    <div v-if="!relayStore.allRelays.length">
      The list with your relays {{ relayStore.connectedRelayUrl.length ? 'on' : '' }} <b>{{ relayStore.connectedRelayUrl }}</b> was not found.
    </div>
  </ul>

  <h4>Add relay:</h4>
  <div class="add-relay">
    <input v-model="newRelayUrl" class="add-relay__input" type="text" placeholder="[wss://]relay.url" />
    <button @click="handleAddRelay" class="add-relay__btn">Add</button>
  </div>
  <div class="error">
    {{ relayUrlError }}
  </div>
</template>

<style scoped>
  h4 {
    margin-bottom: 10px;
  }

  .relays {
    margin-top: 0
  }

  .relay {
    margin-bottom: 15px;
  }

  .actions {
    display: flex;
    align-items: center;
  }

  .actions__label {
    margin-bottom: 3px;
    cursor: pointer;
  }

  .actions__checkbox {
    margin-right: 7px;
    cursor: pointer;
  }

  .actions__remove-label {
    margin-bottom: 3px;
  }

  .actions__remove {
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .trash-icon {
    color: orangered;
    cursor: pointer;
    margin-right: 5px;
  }

  .actions__delimiter {
    margin: 0 5px;
  }

  .add-relay {
    display: flex;
  }

  .add-relay__input {
    flex-grow: 1;
    font-size: 15px;
    margin-right: 5px;
  }

  .add-relay__btn {
    font-size: 14px;
    cursor: pointer;
  }

  .error {
    color: red;
    font-size: 16px;
    margin-top: 5px;
  }
</style>