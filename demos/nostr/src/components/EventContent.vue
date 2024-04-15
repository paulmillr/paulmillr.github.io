<script setup lang="ts">
  import { onMounted, onBeforeUpdate, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { 
    nip19, 
    parseReferences, 
    SimplePool, 
    nip10,
    finalizeEvent, 
    verifyEvent,
    type Event
  } from 'nostr-tools'
  import type { EventExtended } from './../types'
  import RawData from './RawData.vue'
  import EventActionsBar from './EventActionsBar.vue'
  import EventText from './EventText.vue'
  import { useNpub } from '@/stores/Npub'
  import { useNsec } from '@/stores/Nsec'
  import { useUser } from '@/stores/User'
  import { useImages } from '@/stores/Images'
  import { useRelay } from '@/stores/Relay'

  import {
    injectAuthorsToNotes,
    injectDataToReplyNotes,
    parseRelaysNip65,
    publishEventToRelays,
    formatedDate
  } from './../utils'
  import LinkIcon from './../icons/LinkIcon.vue'
  import CheckIcon from './../icons/CheckIcon.vue'
  import CheckSquareIcon from './../icons/CheckSquareIcon.vue'
  import InvalidSignatureIcon from './../icons/InvalidSignatureIcon.vue'

  const emit = defineEmits([
    'toggleRawData', 
    'showReplyField', 
    'loadRootReplies',
    'resetSentStatus',
    'loadMoreReplies'
  ])
  const replyText = ref('')
  const msgErr = ref('')

  const props = defineProps<{
    event: EventExtended
    pool: SimplePool
    pubKey?: string
    index?: number
    hasReplyBtn?: boolean
    isRootEvent?: boolean
    currentReadRelays?: string[]
  }>()

  const router = useRouter()
  const npubStore = useNpub()
  const nsecStore = useNsec()
  const userStore = useUser()
  const imagesStore = useImages()
  const relayStore = useRelay()

  const showReplyField = ref(false)
  const isPublishingReply = ref(false)
  const eventReplies = ref<EventExtended[]>([])
  const showReplies = ref(false)
  const isCopiedEventLink = ref(false)
  const isSigVerified = ref(false)
  const isLoadingReplies = ref(false)

  const handleToggleRawData = (eventId: string) => {
    if (props.isRootEvent) {
      return emit('toggleRawData', eventId)
    }
    props.event.showRawData = !props.event.showRawData
  }

  const getUserPath = (pubkey: string) => {
    return `/user/${nip19.npubEncode(pubkey)}`
  }

  onMounted(() => {
    if (Object.keys(props.event).length === 0) return
    isSigVerified.value = verifyEvent(props.event as Event)
  })

  const displayName = (author: any, pubkey: string) => {
    if (author) {
      if (author.name) {
        return author.name
      } else if (author.username) {
        return author.username
      } else {
        return author.display_name
      }
    } else {
      return nip19.npubEncode(pubkey).slice(0, 15) + '...'
    }
  }

  const handleToggleReplyField = () => {
    showReplyField.value = !showReplyField.value
    emit('showReplyField')
  }

  const handleSendReply = async () => {
    if (isPublishingReply.value) return

    const nsecValue = nsecStore.nsec ? nsecStore.nsec.trim() : ''
    if (!nsecValue.length) {
      msgErr.value = 'Please provide your private key or generate random key.'
      return;
    }

    const messageValue = replyText.value.trim()
    if (!messageValue.length) {
      msgErr.value = 'Please provide message to broadcast.'
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
    } catch (e) {
      msgErr.value = `Invalid private key. Please check it and try again.`
      return;
    }

    const event = {
      kind: 1,
      pubkey: pubkey,
      created_at: Math.floor(Date.now() / 1000),
      content: messageValue,
      tags: [],
      id: '',
      sig: ''
    }

    // keep all menitoned people and keep the thread chain from the event we are replying to
    const existedETags: any = []
    const existedPTags: any = []
    props.event.tags.forEach((tag) => {
      const tempTag = [tag[0], tag[1]]
      if (tag[2]) tempTag.push(tag[2])
      if (tag[3]) tempTag.push(tag[3])

      if (tempTag[0] === 'e') {
        existedETags.push(tempTag)
      } else if (tempTag[0] === 'p') {
        existedPTags.push(tempTag)
      }
    })

    // keep chain and add own e tag
    const eTagsForReply: any = []
    if (existedETags.length) {
      const root = existedETags.find((tag: any) => tag[3] === 'root')
      if (root) {
        eTagsForReply.push(root)
      } else {
        eTagsForReply.push(existedETags[0])
      }
      eTagsForReply.push(['e', props.event.id, '', 'reply'])
    } else {
      eTagsForReply.push(['e', props.event.id, '', 'root'])
    }

    // keep all mentioned people and add own from message if presented
    const msgReferences = parseReferences(event)
    const existedPubKeys = existedPTags.map((tag: any) => tag[1])
    const pTagsFromOurMsg: any = []
    msgReferences.forEach((ref) => {
      const refPubkey = ref?.profile?.pubkey
      if (refPubkey && !existedPubKeys.includes(refPubkey)) {
        pTagsFromOurMsg.push(['p', refPubkey])
        existedPubKeys.push(refPubkey)
      }
    })

    // add author pubkey from event we are replying to
    // https://github.com/nostr-protocol/nips/blob/master/10.md#the-p-tag
    const pTagsForReply = [...pTagsFromOurMsg, ...existedPTags]
    if (!existedPubKeys.includes(props.event.pubkey)) {
      pTagsForReply.push(['p', props.event.pubkey])
    }

    // gather all tags together and sign message
    event.tags = [...pTagsForReply, ...eTagsForReply] as never[]
    const signedEvent = finalizeEvent(event, privkey)

    msgErr.value = ''
    isPublishingReply.value = true

    // all mentions except author of the event
    const pubkeysMentions = pTagsForReply
      .filter((tag: any) => tag[1] !== pubkey)
      .map((tag: any) => tag[1])
    let additionalRelays: string[] = []

    const { pool } = props
    if (pubkeysMentions.length) {
      const allRelays = [...relayStore.reedRelays, ...relayStore.writeRelays, relayStore.connectedRelayUrl]
      let relays = [...new Set(allRelays)]; // make array values unique
      const metaEvents = await pool.querySync(relays, { kinds: [10002], authors: pubkeysMentions })

      const mentionsReadRelays = new Set<string>()
      metaEvents.forEach((event: Event) => {
        if (event.tags.length)  {
          const { read } = parseRelaysNip65(event)
          read.forEach((r: string) => {
            if (relayStore.writeRelays.includes(r)) return
            mentionsReadRelays.add(r)
          })
        }
      })

      additionalRelays = [...mentionsReadRelays]
    }
    
    const writeRelays = relayStore.writeRelays
    if (!writeRelays.length) {
      msgErr.value = 'Please provide your write relays to broadcast event'
      return
    }

    const result = await publishEventToRelays(writeRelays, pool, event)
    const hasSuccess = result.some((data: any) => data.success)

    if (!hasSuccess) {
      msgErr.value = 'Failed to broadcast reply'
      return
    }

    if (additionalRelays.length) {
      try {
        await pool.publish(additionalRelays, event)
      } catch (e) {
        console.error('Failed to broadcast reply to some additional relays')
      }
    }
    
    isPublishingReply.value = false
    showReplyField.value = false
    replyText.value = ''

    if (props.isRootEvent) {
      return emit('loadRootReplies')
    }

    handleLoadReplies()
  }

  const handleLoadReplies = async () => {
    const { event, currentReadRelays, pool } = props

    if (!currentReadRelays?.length || !pool) return

    if (props.isRootEvent) {
      return emit('loadMoreReplies')
    }

    isLoadingReplies.value = true

    // filter replies for particular event
    let replies = await pool.querySync(currentReadRelays, {kinds: [1], '#e': [event.id]})
    replies = replies.filter((reply) => {
      const nip10Data = nip10.parse(reply)
      return nip10Data?.root?.id === event.id || nip10Data?.reply?.id === event.id
    })

    const authors = replies.map((e: any) => e.pubkey)
    const uniqueAuthors = [...new Set(authors)]
    const authorsEvents = await pool.querySync(currentReadRelays, { kinds: [0], authors: uniqueAuthors })
    replies = injectAuthorsToNotes(replies, authorsEvents)

    await injectDataToReplyNotes(event, replies as EventExtended[], currentReadRelays, pool)

    eventReplies.value = replies as EventExtended[]
    showReplies.value = true
    isLoadingReplies.value = false
  }

  const handleHideReplies = () => {
    showReplies.value = false
  }

  const handleCopyEventLink = () => {
    const { origin, pathname } = window.location
    let noteId = nip19.noteEncode(props.event.id)
    const eventLink = `${origin}${pathname}#/event/${noteId}`
    navigator.clipboard.writeText(eventLink)
    isCopiedEventLink.value = true
    setTimeout(() => {
      isCopiedEventLink.value = false
    }, 2000)
  }

  const handleUserClick = (pubkey: string) => {
    const urlNpub = nip19.npubEncode(pubkey)
    npubStore.updateNpubInput(urlNpub)
    userStore.updateRoutingStatus(true)
    router.push({ path: getUserPath(pubkey) })
  }
</script>

<template>
  <div class="event-card">
    <div :class="['event-card__content', {'flipped': event.showRawData }]">
      <div :class="['event-card__front', 'event__presentable-date', { 'event-card__front_custom': pubKey === event.pubkey }]">
        <div v-if="imagesStore.showImages && event.author" class="event-img">
          <img class="author-pic" :src="event.author.picture" alt="user's avatar" :title="`Avatar for ${event.author.name}`">
        </div>
        <div class="event-content">
          <div class="event-header">
            <div>
              <a class="event-username-link" @click.prevent="() => handleUserClick(event.pubkey)" :href="getUserPath(event.pubkey)">
                <b class="event-username-text">{{ displayName(event.author, event.pubkey) }}</b>
              </a>
            </div>
            <div>
              {{ formatedDate(event.created_at) }}
            </div>
          </div>

          <div v-if="event.replyingTo" class="event-replying-to">
            Replying to <a @click.prevent="() => handleUserClick(event.replyingTo.pubkey)" :href="getUserPath(event.replyingTo.pubkey)" class="event-username-link event-username-text">@{{ displayName(event.replyingTo.user, event.replyingTo.pubkey) }}</a>
          </div>
  
          <div class="event-body">
            <EventText :event="event" />
          </div>
  
          <div class="event-footer">
            <EventActionsBar 
              @showReplyField="handleToggleReplyField" 
              @handleShowReplies="handleLoadReplies"
              @handleHideReplies="handleHideReplies"
              :hasReplyBtn="hasReplyBtn" 
              :likes="event.likes" 
              :reposts="event.reposts"
              :replies="event.replies"
            />
            <div class="event-footer__right-actions">
              <div class="event-footer__link-wrapper">
                <CheckIcon v-if="isCopiedEventLink" class="event-footer-copy-icon event-footer-copy-icon_check" />
                <LinkIcon v-if="!isCopiedEventLink" @click="handleCopyEventLink" title="Copy link" class="event-footer-copy-icon" />
              </div>
              <span @click="() => handleToggleRawData(event.id)" title="See raw data" class="event-footer-code">
                {...}
              </span>
            </div>
          </div>
        </div>
      </div>
  
      <div :class="['event-card__back', { 'event-card__back_custom': pubKey === event.pubkey, 'event-details-first': index === 0 }]">
        <div class="event__raw-data">
          <RawData :event="event" :authorEvent="event.authorEvent" />
        </div>
        <div class="event-footer-code-wrapper">
          <div :class="['event-footer__signature', { 'event-footer__signature_invalid' : !isSigVerified }]">
            <CheckSquareIcon v-if="isSigVerified" /> 
            <InvalidSignatureIcon v-if="!isSigVerified" />
            <span class="event-footer__signature-text">
              {{ isSigVerified ? 'Signature is valid' : 'Invalid signature' }}
            </span>
          </div>
          <div class="event-footer__right-actions">
            <div class="event-footer__link-wrapper">
              <CheckIcon v-if="isCopiedEventLink" class="event-footer-copy-icon event-footer-copy-icon_check" />
              <LinkIcon v-if="!isCopiedEventLink" @click="handleCopyEventLink" title="Copy link" class="event-footer-copy-icon" />
            </div>
            <span @click="() => handleToggleRawData(event.id)" title="See raw data" class="event-footer-code">
              {...}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showReplyField" class="reply-field">
    <textarea v-model="replyText" rows="4" class="reply-field__textarea" placeholder="Write a reply..."></textarea>
    <div class="reply-field__actions">
      <div class="reply-field__error">{{ msgErr }}</div>
      <button :disabled="isPublishingReply" @click="handleSendReply" class="reply-field__btn">
        {{ isPublishingReply ? 'Sending reply...' : 'Reply' }}
      </button>
    </div>
  </div>

  <div v-if="isLoadingReplies" class="loading-replies">
    Loading replies...
  </div>

  <div v-if="showReplies && eventReplies.length" class="replies">
    <div class="reply" :key="reply.id" v-for="(reply, i) in eventReplies">
      <!-- <div class="reply__vertical-line"></div> -->
      <EventContent
        @toggleRawData="() => handleToggleRawData(event.id)"
        :event="(reply as EventExtended)"
        :currentReadRelays="currentReadRelays"
        :pool="pool"
        :hasReplyBtn="hasReplyBtn"
      />
    </div>
  </div>
</template>

<style scoped>
  .replies {
    margin-bottom: 30px;
  }

  .reply {
    margin-top: 15px;
    position: relative;
  }
  .reply__vertical-line {
    position: absolute;
    background-color: #878580;
    width: 1px;
    height: 15px;
    left: 38px;
    top: -15px;
  }

  .loading-replies {
    display: inline-block;
    margin-top: 5px;
  }

  .event-body {
    min-height: 60px;
  }

  .event-card {
    perspective: 40rem;
  }

  .event-card__content {
    transform-style: preserve-3d;
    transition: transform 0.5s;
    position: relative;
  }

  .event-card__content.flipped {
    transform: rotateX(-180deg);
  }

  .event-card__front, .event-card__back {
    backface-visibility: hidden;
    border: 1px solid white;
    padding: 14px;
  }

  .event-card__front_custom, .event-card__back_custom {
    border-color: #0092bf;
  }

  .event-card__back {
    position: absolute;
    top: 0; right: 0; bottom: 0; left: 0;
    transform: rotateX(-180deg);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .event__raw-data {
    margin-top: 28px;
    overflow-y: hidden;
    margin-bottom: 2px;
  }

  .event-card__content.flipped .event__raw-data {
    overflow-y: scroll;
  }

  .event__presentable-date {
    display: flex;
  }

  .event-img {
    margin-right: 12px;
    max-width: 50px;
  }

  .author-pic {
    width: 50px;
    height: 50px;
    min-width: 50px;
    min-height: 50px;
    border-radius: 50%;
  }

  .event-username-link {
    color: #0092bf;
    text-decoration: none;
  }

  .event-content {
    flex-grow: 1;
  }

  .event-header {
    display: flex;
    justify-content: space-between;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .event-header {
      flex-direction: row;
    }
  }

  .event-replying-to {
    font-size: 15px;
    margin-bottom: 3px;
  }

  .event-username-text {
    line-break: anywhere;
  }

  .event-footer {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
  }

  .event-footer-code {
    cursor: pointer;
  }

  .event-footer-code-wrapper {
    margin-top: 2px;
    display: flex;
    justify-content: space-between;
  }

  .event-details-first {
    margin-top: 30px;
  }

  .reply-field__textarea {
    width: 100%;
    box-sizing: border-box;
    margin-top: 10px;
  }

  .reply-field__actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .reply-field__btn {
    cursor: pointer;
  }

  .reply-field__error {
    color: red;
    font-size: 16px;
    flex-grow: 1;
    text-align: right;
    margin-right: 10px;
  }

  .event-footer__right-actions {
    display: inline-flex;
  }

  .event-footer__link-wrapper {
    position: relative;
  }

  .event-footer-copy-icon {
    cursor: pointer;
    margin-right: 4px;
    margin-top: 4px;
  }

  @media (min-width: 375px) {
    .event-footer-copy-icon {
      margin-right: 10px;
    }
  }

  .event-footer-copy-icon_check {
    cursor: auto;
  }

  .event-footer__signature {
    display: flex;
    align-items: center;
  }

  .event-footer__signature-text {
    margin-left: 5px;
  }

  .event-footer__signature_invalid {
    color: red;
  }
</style>