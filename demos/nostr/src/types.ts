import type { Event } from 'nostr-tools';

export type Author = {
  name: string
  display_name: string
  picture: string
  about: string
  username: string
  nip05: string
  followingCount: number
  followersCount: number
}

export type EventExtended = Event & {
  author: Author,
  authorEvent: Event,
  showRawData: boolean,
  rawDataActiveTab: number,
  likes: number,
  reposts: number,
  replies: number,
  references: Array<Object>,
  replyingTo: { 
    user: Author,
    pubkey: string
  }
}

export type EventTextPart = {
  type: string,
  value: string,
  npub?: string,
}

export type LogContentPart = {
  type: string,
  value: string
}

export type ShortPubkeyEvent = {
  id: string,
  pubkey: string
}

export type TypedRelay = {
  url: string, 
  type: string
}

export type Nip65RelaysUrls = {
  read: string[],
  write: string[],
  all: Array<TypedRelay>
}