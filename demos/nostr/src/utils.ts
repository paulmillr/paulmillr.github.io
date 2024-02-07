import type { EventExtended } from './types'
import {
  SimplePool,
  parseReferences,
  type Event
} from 'nostr-tools'

export const normalizeUrl = (url: string) => {
  const norm = url.trim()
  if (!norm.startsWith('ws://') && !norm.startsWith('wss://')) {
    return `wss://${norm}`
  }
  return norm
}

export const injectDataToNotes = async (posts: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool)
  const reposts = injectRepostsToNotes(posts, relays, relaysPool)
  const references = injectReferencesToNotes(posts, relays, relaysPool)
  return Promise.all([likes, reposts, references])
}

export const injectAuthorsToNotes = (postsEvents: Event[], authorsEvents: Event[]) => {
  const tempPostsEvents = [...postsEvents] as EventExtended[]

  const postsWithAuthor: Event[] = [];
  tempPostsEvents.forEach(pe => {
    let isAuthoAddedToPost = false;
    authorsEvents.forEach(ae => {
      if (pe.pubkey === ae.pubkey) {
        const tempEventWithAuthor = pe as EventExtended
        tempEventWithAuthor.author = JSON.parse(ae.content)
        tempEventWithAuthor.authorEvent = ae
        postsWithAuthor.push(pe)
        isAuthoAddedToPost = true
      }
    })
    // keep post in the list of posts even if author is not found
    if (!isAuthoAddedToPost) {
      postsWithAuthor.push(pe)
    }
  })

  return postsWithAuthor;
}

export const injectReferencesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents
  
  let pool = relaysPool || new SimplePool({ getTimeout: 5600 })

  for (const event of postsEvents) {
    if (!contentHasMentions(event.content)) {
      event.references = []
      continue
    }

    let references = parseReferences(event)

    const referencesToInject = []
    for (let i = 0; i < references.length; i++) {
      let { profile } = references[i]
      if (!profile) continue

      const meta = await pool.get(relays, { kinds: [0], limit: 1, authors: [profile.pubkey] })

      const referencesWithProfile = references[i] as any
      referencesWithProfile.profile_details = JSON.parse(meta?.content || '{}');
      referencesToInject.push(referencesWithProfile)
    }

    event.references = referencesToInject
  }
}

export const injectLikesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  if (!relays.length) return postsEvents

  const postsIds = postsEvents.map((e: Event) => e.id)
  const pool = relaysPool || new SimplePool({ getTimeout: 5600 })

  const likeEvents = await pool.list(relays, [{ kinds: [7], "#e": postsIds }])

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

  const pool = relaysPool || new SimplePool({ getTimeout: 5600 })
  const repostEvents = await pool.list(relays, [{ kinds: [6], "#e": postsIds }])

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