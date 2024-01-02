import type { EventExtended } from './types'
import {
  SimplePool,
  parseReferences,
  type Event
} from 'nostr-tools'

export const updateUrlHash = (hash: string) => {
  window.location.hash = hash
}

export const updateUrlUser = (npub: string) => {
  window.location.hash = `#?user=${npub}`
}

export const normalizeUrl = (url: string) => {
  const norm = url.trim()
  if (!norm.startsWith('ws://') && !norm.startsWith('wss://')) {
    return `wss://${norm}`
  }
  return norm
}

export const injectAuthorsToNotes = async (postsEvents: Event[], authorsEvents: Event[]) => {
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

export const injectReferencesToNotes = async (postsEvents: Event[], relays: string[] = [], relaysPool: SimplePool | null) => {
  const eventsWithReferences: EventExtended[] = [];
  if (!relays.length) return postsEvents
  
  let pool = relaysPool || new SimplePool({ getTimeout: 5600 })

  for (const event of postsEvents) {
    const extendedEvent = event as EventExtended

    if (!contentHasMentions(event.content)) {
      extendedEvent.references = []
      eventsWithReferences.push(extendedEvent)
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

    extendedEvent.references = referencesToInject
    eventsWithReferences.push(extendedEvent)
  }

  return eventsWithReferences
}

export const injectLikesToNotes = async (postsEvents: Event[], relays: string[] = []) => {
  if (!relays.length) return postsEvents

  const postsIds = postsEvents.map((e: Event) => e.id)

  const pool = new SimplePool({ getTimeout: 5600 })
  const likeEvents = await pool.list(relays, [{ kinds: [7], "#e": postsIds }])

  const postsWithLikes: Event[] = [];
  postsEvents.forEach(postEvent => {
    let likes = 0
    likeEvents.forEach(likedEvent => {
      const likedEventId = likedEvent.tags.reverse().find((tag: Array<string>) => tag[0] === 'e')?.[1]
      if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
        likes++
      }
    })
    const tempEvent = postEvent as EventExtended
    tempEvent.likes = likes
    postsWithLikes.push(tempEvent)
  })

  return postsWithLikes
}

export const injectRepostsToNotes = async (postsEvents: Event[], fallbackRelays: string[] = []) => {
  if (!fallbackRelays.length) return postsEvents

  const postsIds = postsEvents.map((e: Event) => e.id)

  const pool = new SimplePool({ getTimeout: 5600 })
  const repostEvents = await pool.list(fallbackRelays, [{ kinds: [6], "#e": postsIds }])

  const postsWithReposts: Event[] = [];
  postsEvents.forEach(postEvent => {
    let reposts = 0
    repostEvents.forEach(repostEvent => {
      const repostEventId = repostEvent.tags.find((tag: Array<string>) => tag[0] === 'e')?.[1]
      if (repostEventId && repostEventId === postEvent.id) {
        reposts++
      }
    })
    const tempEvent = postEvent as EventExtended
    tempEvent.reposts = reposts
    postsWithReposts.push(tempEvent)
  })

  return postsWithReposts
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