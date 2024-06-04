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
import { EVENT_KIND } from './nostr'

export const injectDataToRootNotes = async (posts: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null, metaCache?: any) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool)
  const reposts = injectRepostsToNotes(posts, relays, relaysPool)
  const references = injectReferencesToNotes(posts, relays, relaysPool, metaCache)
  const replies = injectRootRepliesToNotes(posts, relays, relaysPool)
  posts.forEach((post) => post.isRoot = true)
  return Promise.all([likes, reposts, references, replies])
}

export const injectRootLikesRepostsRepliesCount = (post: Event, events: Event[] = []) => {
  if (!events || !events.length) {
    events = []
  }

  const likes = []
  const reposts = []
  const replies = []

  for (const event of events) {
    switch (event.kind) {
      case EVENT_KIND.LIKE:
        likes.push(event);
        break;
      case EVENT_KIND.REPOST:
        reposts.push(event);
        break;
      case EVENT_KIND.REPLY:
        replies.push(event);
        break;
    }
  }

  injectLikesToNote(post as EventExtended, likes)
  injectRepostsToNote(post as EventExtended, reposts)
  injectRootRepliesToNote(post as EventExtended, replies)
}

export const injectDataToReplyNotes = async (replyingToEvent: EventExtended, posts: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null) => {
  const likes = injectLikesToNotes(posts, relays, relaysPool)
  const reposts = injectRepostsToNotes(posts, relays, relaysPool)
  const references = injectReferencesToNotes(posts, relays, relaysPool)
  const replies = injectNotRootRepliesToNotes(posts, relays, relaysPool)
  posts.forEach((post) => post.isRoot = false)
  if (replyingToEvent) {
    injectReplyingToDataToNotes(replyingToEvent, posts)
  }
  return Promise.all([likes, reposts, references, replies])
}

const injectReplyingToDataToNotes = (replyingToEvent: EventExtended, postsEvents: EventExtended[]) => {
  for (const event of postsEvents) {
    event.replyingTo = { 
      user: replyingToEvent.author,
      pubkey: replyingToEvent.pubkey,
      event: replyingToEvent
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

export const injectRootRepliesToNote = async (postEvent: EventExtended, repliesEvents: Event[]) => {
  let replies = 0
  for (const reply of repliesEvents) {
    const nip10Data = nip10.parse(reply)
    if (!nip10Data.reply && nip10Data?.root?.id === postEvent.id) {
      replies++
    }
  }
  postEvent.replies = replies
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

export const injectAuthorsToNotes = (postsEvents: Event[], authorsEvents: (Event | null)[]) => {
  const tempPostsEvents = [...postsEvents] as EventExtended[]

  const postsWithAuthor: Event[] = [];
  tempPostsEvents.forEach(pe => {
    let isAuthorAddedToPost = false;
    authorsEvents.forEach(ae => {
      if (!isAuthorAddedToPost && pe.pubkey === ae?.pubkey) {
        const tempEventWithAuthor = pe as EventExtended
        tempEventWithAuthor.author = JSON.parse(ae.content)
        tempEventWithAuthor.authorEvent = ae
        postsWithAuthor.push(tempEventWithAuthor)
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

export const injectReferencesToNotes = async (postsEvents: EventExtended[], relays: string[] = [], relaysPool: SimplePool | null, metaCache?: any) => {
  if (!relays.length) return postsEvents
  
  let pool = relaysPool || new SimplePool()

  const eventsReferences: { [key: string]: any } = {}

  const allReferencesPubkeys: Set<string> = new Set()
  for (const event of postsEvents) {
    if (!contentHasMentions(event.content)) {
      continue
    }

    const references = parseReferences(event)
    for (let i = 0; i < references.length; i++) {
      let { profile } = references[i]
      if (!profile?.pubkey) continue
      allReferencesPubkeys.add(profile.pubkey)
    }

    eventsReferences[event.id] = references
  }

  // if no references with pubkeys in posts, just exit
  if (!allReferencesPubkeys.size) {
    postsEvents.forEach((p) => p.references = [])
    return
  }

  const cachedMetas = []
  let pubkeysToDownload = []
  if (metaCache) {
    for (const pubkey of allReferencesPubkeys) {
      const meta = metaCache[pubkey]?.event
      if (meta) {
        cachedMetas.push(meta)
      } else {
        pubkeysToDownload.push(pubkey)
      }
    }
  } else {
    pubkeysToDownload = [...allReferencesPubkeys]
  }

  const newMetas = await Promise.all(
    pubkeysToDownload.map(async (pubkey) => {
      // const authorRelays = relaysMap?.length && relaysMap[pubkey]?.length ? relaysMap[pubkey] : relays
      return pool.get(relays, { kinds: [0], authors: [pubkey] })
    })
  ) as Event[]
  
  const metas = [...cachedMetas, ...newMetas]
    .sort((a, b) => b.created_at - a.created_at)

  for (const event of postsEvents) {
    const references = eventsReferences[event.id]
    if (!references) {
      event.references = []
      continue
    }

    const referencesToInject: any[] = []
    for (let i = 0; i < references.length; i++) {
      let { profile } = references[i]
      if (!profile?.pubkey) continue
      metas.forEach((meta) => {
        if (meta?.pubkey === profile.pubkey) {
          const referenceWithProfile = references[i] as any
          referenceWithProfile.profile_details = JSON.parse(meta?.content || '{}')
          referencesToInject.push(referenceWithProfile)
        }
      })
    }
    event.references = referencesToInject
  }
}

export const getNoteReferences = (postEvent: Event) =>{
  if (!contentHasMentions(postEvent.content)) {
    return []
  }
  
  const allReferencesPubkeys: Set<string> = new Set()
  const references = parseReferences(postEvent)
  for (let i = 0; i < references.length; i++) {
    let { profile } = references[i]
    if (!profile?.pubkey) continue
    allReferencesPubkeys.add(profile.pubkey)
  }

  // if no references with pubkeys in posts, just exit
  if (!allReferencesPubkeys.size) {
    return []
  }

  return [...allReferencesPubkeys]
}

export const injectReferencesToNote = async (postEvent: EventExtended, referencesMetas: (Event | null)[]) => {
  if (!referencesMetas.length) {
    postEvent.references = []
    return
  }

  const references = parseReferences(postEvent)

  const referencesToInject: any[] = []
  for (let i = 0; i < references.length; i++) {
    let { profile } = references[i]
    if (!profile?.pubkey) continue
    referencesMetas.forEach((meta) => {
      if (meta?.pubkey === profile?.pubkey) {
        const referenceWithProfile = references[i] as any
        referenceWithProfile.profile_details = JSON.parse(meta?.content || '{}')
        referencesToInject.push(referenceWithProfile)
      }
    })
  }
  postEvent.references = referencesToInject
}

// remove duplicates and sort by date
export const filterMetas = (metas: Event[]) => {
  const cache = new Set()
  const filteredMetas: Event[] = []
  const sortedMetas = metas.sort((a, b) => b.created_at - a.created_at)
  sortedMetas.forEach((meta) => {
    const { pubkey } = meta
    if (cache.has(pubkey)) return
    cache.add(pubkey)
    filteredMetas.push(meta)
  })
  return filteredMetas
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

export const injectLikesToNote = (postEvent: EventExtended, likesEvents: Event[]) => {
  let likes = 0
  likesEvents.forEach(likedEvent => {
    const likedEventId = likedEvent.tags.reverse().find((tag: Array<string>) => tag[0] === 'e')?.[1]
    if (likedEventId && likedEventId === postEvent.id && likedEvent.content && isLike(likedEvent.content)) {
      likes++
    }
  })
  postEvent.likes = likes
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

export const injectRepostsToNote = (postEvent: EventExtended, repostEvents: Event[]) => {
  let reposts = 0
  repostEvents.forEach(repostEvent => {
    const repostEventId = repostEvent.tags.find((tag: Array<string>) => tag[0] === 'e')?.[1]
    if (repostEventId && repostEventId === postEvent.id) {
      reposts++
    }
  })
  postEvent.reposts = reposts
}

export const filterRootEventReplies = (event: Event, replies: Event[]) => {
  return replies.filter((reply) => {
    const nip10Data = nip10.parse(reply)
    return !nip10Data.reply && nip10Data?.root?.id === event.id
  })
}

export const filterReplyEventReplies = (event: Event, replies: Event[]) => {
  return replies.filter((reply) => {
    const nip10Data = nip10.parse(reply)
    return nip10Data?.reply?.id === event.id || nip10Data?.root?.id === event.id
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

export const isWsAvailable = (url: string, timeout: number = 3000) => {
  try {
    return new Promise((resolve) => {
      const socket = new WebSocket(url)
      
      const timer = setTimeout(() => {
        socket.close();
        resolve(false);
      }, timeout);

      socket.onopen = () => {
        clearTimeout(timer);
        socket.close();
        resolve(true);
      };

      socket.onerror = () => {
        clearTimeout(timer);
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

export const formatedDateYear = (date: number) => {
  return new Date(date * 1000).toLocaleString('default', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  })
}

export const racePromises = (promises: Promise<any>[], handleSuccess: (result: any) => void, handleError: (error: any) => void) => {
  if (promises.length === 0) return

  const wrappedPromises = promises.map(p => 
    p.then(result => ({ result, isFulfilled: true, originalPromise: p }))
    .catch(error => ({ result: error, isFulfilled: false, originalPromise: p }))
  );

  Promise.race(wrappedPromises).then(({ result, isFulfilled, originalPromise }) => {
    if (isFulfilled) {
      handleSuccess(result)
    } else {
      handleError(result)
    }

    // Remove the handled promise from the array
    const remainingPromises = promises.filter(p => p !== originalPromise)

    // Continue racing the remaining promises
    racePromises(remainingPromises, handleSuccess, handleError)
  })
}

function _delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}