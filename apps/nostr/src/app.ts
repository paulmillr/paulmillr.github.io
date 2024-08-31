export const DEFAULT_RELAY = 'wss://nos.lol'

export const DEFAULT_RELAYS = [
  'wss://nos.lol', // USA
  'wss://relay.damus.io', // Cannada
  'wss://relay.snort.social', // France
  'wss://relay.nostr.band', // Finland
  'wss://eden.nostr.land', // USA
]

export const fallbackRelays = [
  'wss://nos.lol', // USA
  'wss://relay.damus.io', // Cannada
  'wss://relay.nostr.band', // Finland
  'wss://relay.snort.social', // France
  'wss://relay.primal.net', // Cannada
  'wss://eden.nostr.land', // USA
  'wss://nostr.wine', // USA
  'wss://offchain.pub', // USA
  'wss://relay.nostr.bg', // Germany
  'wss://relay.mostr.pub', // Cannada
]

export const DEFAULT_EVENTS_COUNT = 20

export const BECH32_REGEX = /[\x21-\x7E]{1,83}1[023456789acdefghjklmnpqrstuvwxyz]{6,}/
