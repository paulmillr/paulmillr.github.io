import type { Event } from 'nostr-tools';

export type Author = {
  name: string
  display_name: string
  picture: string
  about: string
  nickname: string
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
  references: Array<Object>,
  hasReplies: boolean,
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