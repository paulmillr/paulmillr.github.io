// @ts-nocheck
/**
 * TODO: Remove ts-nocheck after fixing the issue
 * code was taken from https://github.com/nostr-protocol/nips/blob/master/59.md
 * but fixed with secure random
 */
import { bytesToHex } from '@noble/hashes/utils'
import type { EventTemplate, UnsignedEvent, Event } from 'nostr-tools'
import { getPublicKey, getEventHash, nip44, finalizeEvent, generateSecretKey } from 'nostr-tools'

export type Rumor = UnsignedEvent & { id: string }

export const TWO_DAYS = 2 * 24 * 60 * 60

const secureRandom = () => {
  return crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1)
}

export const now = () => Math.round(Date.now() / 1000)
const randomNow = () => Math.round(now() - secureRandom() * TWO_DAYS)

export const nip44ConversationKey = (privateKey: Uint8Array, publicKey: string) =>
  nip44.v2.utils.getConversationKey(bytesToHex(privateKey), publicKey)

export const nip44Encrypt = (data: EventTemplate, privateKey: Uint8Array, publicKey: string) =>
  nip44.v2.encrypt(JSON.stringify(data), nip44ConversationKey(privateKey, publicKey))

export const nip44Decrypt = (data: Event, privateKey: Uint8Array) =>
  JSON.parse(nip44.v2.decrypt(data.content, nip44ConversationKey(privateKey, data.pubkey)))

export const createRumor = (event: Partial<UnsignedEvent>, privateKey: Uint8Array) => {
  const rumor = {
    kind: 14,
    created_at: now(),
    content: '',
    tags: [],
    ...event,
    pubkey: getPublicKey(privateKey),
  } as any

  rumor.id = getEventHash(rumor)

  return rumor as Rumor
}

export const createSeal = (rumor: Rumor, privateKey: Uint8Array, recipientPublicKey: string) => {
  return finalizeEvent(
    {
      kind: 13,
      content: nip44Encrypt(rumor, privateKey, recipientPublicKey),
      created_at: randomNow(),
      tags: [],
    },
    privateKey,
  ) as Event
}

export const createWrap = (event: Event, recipientPublicKey: string) => {
  const randomPrivateKey = generateSecretKey()

  return finalizeEvent(
    {
      kind: 1059,
      content: nip44Encrypt(event, randomPrivateKey, recipientPublicKey),
      created_at: randomNow(),
      tags: [['p', recipientPublicKey]],
    },
    randomPrivateKey,
  ) as Event
}
