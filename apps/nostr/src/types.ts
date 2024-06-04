import type { Event, UnsignedEvent } from 'nostr-tools';

export type Rumor = UnsignedEvent & {id: string}

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
  isRoot: boolean,
  replyingTo: { 
    user: Author,
    pubkey: string,
    event: Event
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

export type ChatMessage = {
  event: Rumor,
  isPublished: boolean,
}

export type Chat = {
  id: string,
  title: string,
  created_at_last_message: number,
  initialRoomTags?: Array<any>,
  messages: Array<ChatMessage>,
}

export type RawChat = {
  id?: string,
  title?: string,
  created_at_last_message?: number,
  messages: Array<ChatMessage>,
}