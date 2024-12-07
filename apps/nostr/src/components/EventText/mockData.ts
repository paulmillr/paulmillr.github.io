import type { EventExtended } from '@/types'
import type { Event } from 'nostr-tools'

export const shortContentEvent: Event = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content: 'Test content...',
  sig: '',
}

export const longContentEvent: Event = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content:
    'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  sig: '',
}

// @ts-ignore
export const shortContentEventWithReferenceOnEnd: EventExtended = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content:
    'Test reference nostr:nprofile1qqsd2ne5faqxc05hqqp0275dxq9jd00ayd3sngl6ssttnanvcxzjw6gpz4mhxue69uhk2er9dchxummnw3ezumrpdejqz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpp4mhxue69uhkummn9ekx7mqtlfdjk',
  references: [
    {
      text: 'nostr:nprofile1qqsd2ne5faqxc05hqqp0275dxq9jd00ayd3sngl6ssttnanvcxzjw6gpz4mhxue69uhk2er9dchxummnw3ezumrpdejqz9rhwden5te0wfjkccte9ejxzmt4wvhxjmcpp4mhxue69uhkummn9ekx7mqtlfdjk',
      profile: {
        pubkey: 'd54f344f406c3e970002f57a8d300b26bdfd236309a3fa8416b9f66cc1852769',
        relays: ['wss://eden.nostr.land', 'wss://relay.damus.io', 'wss://nos.lol'],
      },
      profile_details: {
        name: 'greenoak',
        about: 'I like sun and sky',
        display_name: 'Green Oak',
        picture: 'https://void.cat/d/BPRcPX4dJP7ZXQZ9Ue7cXJ.webp',
      },
    },
  ],
  sig: '',
}

// @ts-ignore
export const shortContentEventWithReferenceOnMiddle: EventExtended = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content:
    'Test reply to nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun, some text.',
  references: [
    {
      text: 'nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun',
      profile: {
        pubkey: 'd54f344f406c3e970002f57a8d300b26bdfd236309a3fa8416b9f66cc1852769',
        relays: [],
      },
      profile_details: {
        name: 'greenoak',
        about: 'I like sun and sky',
        display_name: 'Green Oak',
        picture: 'https://void.cat/d/BPRcPX4dJP7ZXQZ9Ue7cXJ.webp',
      },
    },
  ],
  sig: '',
}

// @ts-ignore
export const shortContentEventWithReferencesOnStart: EventExtended = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content:
    'nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun test reply, some text.',
  references: [
    {
      text: 'nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun',
      profile: {
        pubkey: 'd54f344f406c3e970002f57a8d300b26bdfd236309a3fa8416b9f66cc1852769',
        relays: [],
      },
      profile_details: {
        name: 'greenoak',
        about: 'I like sun and sky',
        display_name: 'Green Oak',
        picture: 'https://void.cat/d/BPRcPX4dJP7ZXQZ9Ue7cXJ.webp',
      },
    },
  ],
  sig: '',
}

// @ts-ignore
export const shortContentEventWithTwoReferences: EventExtended = {
  id: '',
  pubkey: '',
  created_at: 1729174401,
  kind: 1,
  tags: [],
  content:
    'One more reply to nostr:nprofile1qqsrmyukv5t7pmsya2v9hpgx4yztvmp69x02s224trf5fmnkd3uhlwchgrdvj 👋 and to nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun.',
  references: [
    {
      text: 'nostr:nprofile1qqsrmyukv5t7pmsya2v9hpgx4yztvmp69x02s224trf5fmnkd3uhlwchgrdvj',
      profile: {
        pubkey: '3d93966517e0ee04ea985b8506a904b66c3a299ea8295558d344ee766c797fbb',
        relays: [],
      },
      profile_details: {
        picture:
          'https://cdn.nostr.build/i/b1e6ea75974a4606746628c4880a689acab61146ddc5ef011f9f60d1b10e61d4.jpg',
        display_name: 'Shiburai',
        name: 'shiburai',
        about: '😎',
        banner: null,
        website: '',
        lud16: '',
        nip05: '',
      },
    },
    {
      text: 'nostr:npub1648ngn6qdslfwqqz74ag6vqty67l6gmrpx3l4pqkh8mxesv9ya5s2hqhun',
      profile: {
        pubkey: 'd54f344f406c3e970002f57a8d300b26bdfd236309a3fa8416b9f66cc1852769',
        relays: [],
      },
      profile_details: {
        name: 'greenoak',
        about: 'I like sun and sky',
        display_name: 'Green Oak',
        picture: 'https://void.cat/d/BPRcPX4dJP7ZXQZ9Ue7cXJ.webp',
      },
    },
  ],
  sig: '',
}
