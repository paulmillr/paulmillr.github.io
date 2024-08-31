<script setup lang="ts">
  import { ref } from 'vue'
  import { nip19 } from 'nostr-tools'
  import TrashIcon from '@/icons/TrashIcon.vue'
  import ShowImagesCheckbox from '@/components/ShowImagesCheckbox.vue'
  import { usePool } from '@/stores/Pool'
  import { useNsec } from '@/stores/Nsec'
  import { useImages } from '@/stores/Images'
  import { useRelay } from '@/stores/Relay'
  import { useFeed } from '@/stores/Feed'
  import { utils, finalizeEvent } from 'nostr-tools'
  import { publishEventToRelays } from '@/utils'

  const emit = defineEmits(['relayConnect', 'relayDisconnect', 'clearAppState'])

  const poolStore = usePool()
  const nsecStore = useNsec()
  const feedStore = useFeed()
  const imagesStore = useImages()

  const pool = poolStore.pool

  const relayStore = useRelay()
  const newRelayUrl = ref('')
  const relayUrlError = ref('')
  const relaysError = ref('')
  const relaysWarning = ref('')
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

  const toggleImages = () => {
    imagesStore.updateShowImages(!imagesStore.showImages)
  }

  const handleCopyPubkeyNpub = () => {
    if (!nsecStore.isValidNsecPresented()) return
    const pubkey = nsecStore.getPubkey()
    navigator.clipboard.writeText(nip19.npubEncode(pubkey))
  }

  const handleCopyPubkeyHex = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPubkey())
  }

  const handleCopyPrivkeyNsec = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPrivkey())
  }

  const handleCopyPrivkeyHex = () => {
    if (!nsecStore.isValidNsecPresented()) return
    navigator.clipboard.writeText(nsecStore.getPrivkeyHex())
  }

  const logout = () => {
    emit('clearAppState')
  }
</script>

<template>
  <h4>Images:</h4>
  <div class="show-images">
    <ShowImagesCheckbox :showImages="imagesStore.showImages" @toggleImages="toggleImages" />
  </div>

  <h4>Your relays:</h4>
  <div class="error">
    {{ relaysError }}
  </div>
  <div class="warning">
    {{ relaysWarning }}
  </div>
  <ul class="relays">
    <li class="relay" v-for="(r, i) in relayStore.userReadWriteRelays" :key="i">
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
        <span @click="() => handleRemoveClick(r.url)" class="actions__remove">
          <TrashIcon class="trash-icon" />
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

  <h4>Your Keys:</h4>
  <div class="keys">
    <div class="key-block">
      <div>Public key:</div>
      <div class="key-block__desc">
        <small>
          Public key identifies your Nostr account. Feel free to share it with others.
        </small>
      </div>
      <div>
        🔑&nbsp;
        <code v-if="nsecStore.isValidNsecPresented()" class="key-block__code">
          {{ nip19.npubEncode(nsecStore.getPubkey()) }}
        </code>
        <span v-else>Please login to see your public key.</span>
      </div>
      <div class="key-block__btns">
        <button class="copy-btn" @click="handleCopyPubkeyNpub">Copy pubkey</button>
        <button class="copy-btn" @click="handleCopyPubkeyHex">Copy hex</button>
      </div>
    </div>

    <div class="key-block">
      <div>Private key:</div>
      <div class="key-block__desc">
        <small>
          Private key fully controls your Nostr account and used to cryptographically sign your
          messages.
          <b>Do not share your private key with anyone and keep it secure.</b>
        </small>
      </div>
      <div>
        🔐&nbsp;
        <code v-if="nsecStore.isValidNsecPresented()" class="key-block__code">
          ***************************************************************
        </code>
        <span v-else>Please login to get your private key.</span>
      </div>
      <div class="key-block__btns">
        <button class="copy-btn" @click="handleCopyPrivkeyNsec">Copy privkey</button>
        <button class="copy-btn" @click="handleCopyPrivkeyHex">Copy hex</button>
      </div>
    </div>
  </div>

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
  .key-block {
    margin-bottom: 25px;
  }

  .key-block__code {
    font-size: 15px;
    word-wrap: break-word;
  }

  .key-block__desc {
    margin-bottom: 5px;
  }

  .key-block__btns {
    margin-top: 7px;
  }

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

  .logout-block {
    border-top: 1px solid #2a2f3b;
    padding-top: 25px;
  }

  .copy-btn {
    background: #2a2f3b;
    color: white;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 15px;
    margin-right: 5px;
  }

  .copy-btn:hover {
    background: #323741;
  }

  .copy-btn:active {
    opacity: 0.9;
  }
</style>
