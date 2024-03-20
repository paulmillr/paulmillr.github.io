import type { EventExtended, Nip65RelaysUrls } from './types'
import {
  SimplePool,
  parseReferences,
  nip10,
  Relay,
  utils,
  type Event,
  type Filter
} from 'nostr-tools'

export const injectDataToRootNotes = async (posts: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool)
  const reposts = injectRepostsToNotes(posts, relays, relaysPool)
  const references = injectReferencesToNotes(posts, relays, relaysPool)
  const replies = injectRootRepliesToNotes(posts, relays, relaysPool)
  return Promise.all([likes, reposts, references, replies])
}

export const injectDataToReplyNotes = async (replyingToEvent: EventExtended, posts: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool)
  const reposts = injectRepostsToNotes(posts, relays, relaysPool)
  const references = injectReferencesToNotes(posts, relays, relaysPool)
  const replies = injectNotRootRepliesToNotes(posts, relays, relaysPool)
  injectReplyingToDataToNotes(replyingToEvent, posts)
  return Promise.all([likes, reposts, references, replies])
}

const injectReplyingToDataToNotes = (replyingToEvent: EventExtended, postsEvents: EventExtended[]) => {
  for (const event of postsEvents) {
    event.replyingTo = { 
      user: replyingToEvent.author,
      pubkey: replyingToEvent.pubkey
    }
  }
}

// counting replies for root notes, because root notes and replies notes have different e tag type
export const injectRootRepliesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents

  const pool = relaysPool || new SimplePool()
  const postsIds = postsEvents.map((e: Event) => e.id)
  const repliesEvents = await pool.querySync(relays, { kinds: [1], '#e': postsIds })

  for (const event of postsEvents) {
    let replies = 0
    for (const reply of repliesEvents) {
      const nip10Data = nip10.parse(reply)
      if (!nip10Data.reply && nip10Data?.root?.id === event.id) {
        replies++
      }
    }
    event.replies = replies
  }
}

// counting replies for reply notes, because root notes and replies notes have different e tag type
export const injectNotRootRepliesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents

  const pool = relaysPool || new SimplePool()
  const postsIds = postsEvents.map((e: Event) => e.id)
  const repliesEvents = await pool.querySync(relays, { kinds: [1], '#e': postsIds })

  for (const event of postsEvents) {
    let replies = 0
    for (const reply of repliesEvents) {
      const nip10Data = nip10.parse(reply)
      if (nip10Data?.reply?.id === event.id) {
        replies++
      }
    }
    event.replies = replies
  }
}

export const injectAuthorsToNotes = (postsEvents: Event[], authorsEvents: Event[]) => {
  const tempPostsEvents = [...postsEvents] as EventExtended[]

  const postsWithAuthor: Event[] = [];
  tempPostsEvents.forEach(pe => {
    let isAuthorAddedToPost = false;
    authorsEvents.forEach(ae => {
      if (!isAuthorAddedToPost && pe.pubkey === ae.pubkey) {
        const tempEventWithAuthor = pe as EventExtended
        tempEventWithAuthor.author = JSON.parse(ae.content)
        tempEventWithAuthor.authorEvent = ae
        postsWithAuthor.push(pe)
        isAuthorAddedToPost = true
      }
    })
    // keep post in the list of posts even if author is not found
    if (!isAuthorAddedToPost) {
      postsWithAuthor.push(pe)
    }
  })

  return postsWithAuthor;
}

export const injectReferencesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents
  
  let pool = relaysPool || new SimplePool()

  for (const event of postsEvents) {
    if (!contentHasMentions(event.content)) {
      event.references = []
      continue
    }

    let references = parseReferences(event)

    const referencesRequests = []
    for (let i = 0; i < references.length; i++) {
      let { profile } = references[i]
      if (!profile) continue
      const request = pool.get(relays, { kinds: [0], limit: 1, authors: [profile.pubkey] })
      referencesRequests.push(request)
    }

    const metas = await Promise.all(referencesRequests)
    const referencesToInject: any[] = []
    for (let i = 0; i < references.length; i++) {
      let { profile } = references[i]
      if (!profile) continue

      metas.forEach((meta, i) => {
        if (meta?.pubkey === profile?.pubkey) {
          const referenceWithProfile = references[i] as any
          referenceWithProfile.profile_details = JSON.parse(meta?.content || '{}')
          referencesToInject.push(referenceWithProfile)
        }
      })
    }

    event.references = referencesToInject
  }
}

export const injectLikesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents

  const postsIds = postsEvents.map((e: Event) => e.id)
  const pool = relaysPool || new SimplePool()

  const likeEvents = await pool.querySync(relays, { kinds: [7], "#e": postsIds })

  postsEvents.forEach(postEvent => {
    let likes = 0
    likeEvents.forEach(likedEvent => {
      const likedEventId = likedEvent.tags.reverse().find((tag: Array<string>) => tag[0] === 'e')?.[1]
      if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
        likes++
      }
    })
    postEvent.likes = likes
  })
}

export const injectRepostsToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents

  const postsIds = postsEvents.map((e: Event) => e.id)

  const pool = relaysPool || new SimplePool()
  const repostEvents = await pool.querySync(relays, { kinds: [6], "#e": postsIds })

  postsEvents.forEach(postEvent => {
    let reposts = 0
    repostEvents.forEach(repostEvent => {
      const repostEventId = repostEvent.tags.find((tag: Array<string>) => tag[0] === 'e')?.[1]
      if (repostEventId && repostEventId === postEvent.id) {
        reposts++
      }
    })
    postEvent.reposts = reposts
  })
}

export const contentHasMentions = (content: string) => {
  return content.indexOf('nostr:npub') !== -1 || content.indexOf('nostr:nprofile1') !== -1
}

export const isLike = (content: string) => {
  if (["-", "👎"].includes(content)) {
    return false
  }
  return true
}

export const isWsAvailable = (url: string) => {
  try {
    const socket = new WebSocket(url);
    return new Promise((resolve) => {
      socket.onopen = () => {
        socket.close();
        resolve(true);
      };

      socket.onerror = () => {
        socket.close();
        resolve(false);
      };
    });
  } catch (error) {
    // An error occurred while creating the WebSocket object (e.g., invalid URL)
    return Promise.resolve(false);
  }
}

export const isSHA256Hex = (hex:string) => {
  return /^[a-f0-9]{64}$/.test(hex);
}

export const relayGet = (relay: Relay, filters: Filter[], timeout: number) => {
  const timout = new Promise(resolve => {
    setTimeout(() => {
      resolve(null);
    }, timeout);
  });

  const connection = new Promise<Event>(resolve => {
    const sub = relay.subscribe(filters, {
      onevent(event) {
        resolve(event)
      },
      oneose() {
        sub.close()
      }
    })
  })

  return Promise.race([connection, timout])
}

export const poolList = (pool: SimplePool, relays: string[], filters: Filter[]): Promise<Event[]> => {
  return new Promise (resolve => {
    const events = <Event[]>[]
    let h = pool.subscribeMany(
      relays,
      filters,
      {
        onevent(event) {
          events.push(event)
        },
        oneose() {
          resolve(events)           
          h.close()
        }
      }
    )
  })
}

export const parseRelaysNip65 = (event: Event) => {
  const { tags } = event
  const relays: Nip65RelaysUrls = { read: [], write: [], all: []}
  if (!tags.length) return relays

  tags.forEach((tag: string[]) => {
    const isRelay = tag[0] === 'r'
    if (isRelay) {
      const relayUrl = utils.normalizeURL(tag[1])
      const relayType = tag[2] // read / write
      if (!relayType) {
        relays.read.push(relayUrl)
        relays.write.push(relayUrl)
      } else if (relayType === 'read') {
        relays.read.push(relayUrl)
      } else if (relayType === 'write') {
        relays.write.push(relayUrl)
      }
      relays.all.push({ url: relayUrl, type: relayType || 'write' })
    }
  })

  return relays
}

export const publishEventToRelays = async (relays: string[], pool: any, event: Event) => {
  const promises = relays.map(async (relay: string) => {
    const promises = await pool.publish([relay], event)
    // @ts-ignore
    const result = (await Promise.allSettled(promises))[0]
    return {
      relay,
      success: result.status === 'fulfilled'
    }
  })
  return await Promise.all(promises);
}

export const formatedDate = (date: number) => {
  return new Date(date * 1000).toLocaleString('default', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric'
  })
}