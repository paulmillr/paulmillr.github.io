import { nip19, SimplePool, type Filter, type Event } from "nostr-tools"
import type { ChatMessage, RawChat } from '@/types'
import { bytesToHex } from "@noble/hashes/utils"
import { sha256 } from '@noble/hashes/sha256'
import { nip44Decrypt } from '@/utils/chat-crypto'

export const injectChatTitle = async (chat: RawChat, hostPubkey: string, relaysPool: SimplePool | null, relays: string[]) => {
  const pool = relaysPool || new SimplePool()
  const title = await getChatTitle(chat.messages, hostPubkey, pool, relays)
  chat.title = title
  return chat
}

export const getChatTitle = async (messages: ChatMessage[], hostPubkey: string, pool: SimplePool, relays: string[]) => {
  const event = messages[0].event

  const { pubkey, tags } = event
  const tagsPubkeys = tags.filter((tag: any) => tag[0] === 'p').map((tag: any) => tag[1])
  const eventPubkeys = [pubkey, ...tagsPubkeys]
  const pubkeysSet = new Set(eventPubkeys)
  
  if (pubkeysSet.size > 2) {
    return `group of ${pubkeysSet.size} events`
  }

  let filter: Filter = {}
  if (pubkeysSet.size === 1) { // message yourself
    filter = { kinds: [0], authors: [pubkey] }
  } else if (pubkeysSet.size === 2) { // DM (chat of two participants)
    const contactPubkey = eventPubkeys.filter((pb) => pb !== hostPubkey)[0]
    filter = { kinds: [0], authors: [contactPubkey] }
  }
  
  const meta = await pool.get(relays, filter)

  const author = JSON.parse(meta?.content || '{}')

  if (author.display_name) {
    return author.display_name
  } else if (author.name) {
    return author.name
  } else if (author.username) {
    return author.username
  } else {
    return nip19.npubEncode(pubkey).slice(0, 10) + '...'
  }
}

export const getNewChatTitle = async (pubkey: string, pool: SimplePool, relays: string[]) => {
  let filter: Filter = {}
  filter = { kinds: [0], authors: [pubkey] }
  const meta = await pool.get(relays, filter)

  const author = JSON.parse(meta?.content || '{}')
  if (author.display_name) {
    return author.display_name
  } else if (author.name) {
    return author.name
  } else if (author.username) {
    return author.username
  } else {
    return nip19.npubEncode(pubkey).slice(0, 10) + '...'
  }
}

export const getChatRoomHash = (event: Event) => {
  const roomPubkeys = event.tags.filter((tag) => tag[0] === 'p').map((tag) => tag[1]).sort()
  const strToHash = roomPubkeys.join('')
  return bytesToHex(sha256(strToHash))
}

export const getNewChatRoomHash = (pubkeys: string[]) => {
  const strToHash = pubkeys.sort().join('')
  return bytesToHex(sha256(strToHash))
}

export const getRumorFromWrap = (giftWrap: Event, privateKey: Uint8Array) => {
  let seal, rumor

  try {
    seal = nip44Decrypt(giftWrap, privateKey) // kind 13
    rumor = nip44Decrypt(seal, privateKey) // kind 14
  } catch (e) {
    return null
  }

  // NIP-17 (https://github.com/nostr-protocol/nips/blob/master/17.md)
  // Clients MUST verify if pubkey of the kind:13 is the same pubkey on the kind:14, 
  // otherwise any sender can impersonate others by simply changing the pubkey on kind:14.
  if (seal.pubkey !== rumor.pubkey) {
    return null
  }

  return rumor
}

export const getChatMessageFromRumor = (rumor: Event) => {
  return {
    event: rumor,
    isPublished: true,
  }
}

export const isGroupChat = (rumor: Event) => {
  const tagsPubkeys = rumor.tags.filter((tag: any) => ((tag[0] === 'r' || tag[0] === 'relay') && tag[1] && tag[1].length)).map((tag: any) => tag[1])
  return tagsPubkeys.length > 2
}