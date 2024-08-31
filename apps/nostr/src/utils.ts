import type { EventExtended, Nip65RelaysUrls, Author } from './types'
import {
  SimplePool,
  parseReferences,
  nip10,
  nip19,
  Relay,
  utils,
  type Event,
  type Filter,
} from 'nostr-tools'
import { EVENT_KIND } from './nostr'
import { PURPLEPAG_RELAY_URL } from '@/nostr'

export const markNotesAsRoot = (posts: EventExtended[]) => {
  posts.forEach((post) => (post.isRoot = true))
}

export const markNotesAsNotRoot = (posts: EventExtended[]) => {
  posts.forEach((post) => (post.isRoot = false))
}

export const injectRootLikesRepostsRepliesCount = (post: Event, events: Event[] = []) => {
  if (!events || !events.length) {
    events = []
  }

  const { likes, reposts, replies } = sortByLikesRepostsReplies(events)

  injectLikesToNote(post as EventExtended, likes)
  injectRepostsToNote(post as EventExtended, reposts)
  injectRootRepliesToNote(post as EventExtended, replies)
}

export const injectNotRootLikesRepostsRepliesCount = (post: Event, events: Event[] = []) => {
  if (!events || !events.length) {
    events = []
  }

  const { likes, reposts, replies } = sortByLikesRepostsReplies(events)

  injectLikesToNote(post as EventExtended, likes)
  injectRepostsToNote(post as EventExtended, reposts)
  injectNotRootRepliesToNote(post as EventExtended, replies)
}

const sortByLikesRepostsReplies = (events: Event[]) => {
  if (!events || !events.length) {
    return { likes: [], reposts: [], replies: [] }
  }

  const likes = []
  const reposts = []
  const replies = []

  for (const event of events) {
    switch (event.kind) {
      case EVENT_KIND.LIKE:
        likes.push(event)
        break
      case EVENT_KIND.REPOST:
        reposts.push(event)
        break
      case EVENT_KIND.REPLY:
        replies.push(event)
        break
    }
  }
  return { likes, reposts, replies }
}

const injectReplyingToDataToNotes = (
  replyingToEvent: EventExtended,
  postsEvents: EventExtended[],
) => {
  for (const event of postsEvents) {
    event.replyingTo = {
      user: replyingToEvent.author,
      pubkey: replyingToEvent.pubkey,
      event: replyingToEvent,
    }
  }
}

export const injectRootRepliesToNote = (postEvent: EventExtended, repliesEvents: Event[]) => {
  let replies = 0
  for (const reply of repliesEvents) {
    if (nip10IsFirstLevelReplyForEvent(postEvent.id, reply)) {
      replies++
    }
  }
  postEvent.replies = replies
}

export const injectNotRootRepliesToNote = (postEvent: EventExtended, repliesEvents: Event[]) => {
  let replies = 0
  for (const reply of repliesEvents) {
    if (nip10IsReplyForEvent(postEvent.id, reply)) {
      replies++
    }
  }
  postEvent.replies = replies
}

export const injectAuthorsToNotes = (postsEvents: Event[], authorsEvents: (Event | null)[]) => {
  const tempPostsEvents = [...postsEvents] as EventExtended[]

  const postsWithAuthor: Event[] = []
  tempPostsEvents.forEach((pe) => {
    let isAuthorAddedToPost = false
    authorsEvents.forEach((ae) => {
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

  return postsWithAuthor
}

export const getNoteReferences = (postEvent: Event) => {
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

export const injectReferencesToNote = (
  postEvent: EventExtended,
  referencesMetas: (Event | null)[],
) => {
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

export const dedupByPubkeyAndSortEvents = (events: Event[]) => {
  const cache = new Set()
  const result: Event[] = []
  const sorted = events.sort((a, b) => b.created_at - a.created_at)
  sorted.forEach((event) => {
    const { pubkey } = event
    if (cache.has(pubkey)) return
    cache.add(pubkey)
    result.push(event)
  })
  return result
}

export const injectLikesToNote = (postEvent: EventExtended, likesEvents: Event[]) => {
  let likes = 0
  likesEvents.forEach((likedEvent) => {
    const likedEventId = likedEvent.tags.reverse().find((tag: Array<string>) => tag[0] === 'e')?.[1]
    if (
      likedEventId &&
      likedEventId === postEvent.id &&
      likedEvent.content &&
      isLike(likedEvent.content)
    ) {
      likes++
    }
  })
  postEvent.likes = likes
}

export const injectRepostsToNote = (postEvent: EventExtended, repostEvents: Event[]) => {
  let reposts = 0
  repostEvents.forEach((repostEvent) => {
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
  if (['-', '👎'].includes(content)) {
    return false
  }
  return true
}

export const isWsAvailable = (url: string, timeout: number = 3000) => {
  try {
    return new Promise((resolve) => {
      const socket = new WebSocket(url)

      const timer = setTimeout(() => {
        socket.close()
        resolve(false)
      }, timeout)

      socket.onopen = () => {
        clearTimeout(timer)
        socket.close()
        resolve(true)
      }

      socket.onerror = () => {
        clearTimeout(timer)
        socket.close()
        resolve(false)
      }
    })
  } catch (error) {
    // An error occurred while creating the WebSocket object (e.g., invalid URL)
    return Promise.resolve(false)
  }
}

export const isSHA256Hex = (hex: string) => {
  return /^[a-f0-9]{64}$/.test(hex)
}

export const relayGet = (relay: Relay, filters: Filter[], timeout: number) => {
  const timout = new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, timeout)
  })

  const connection = new Promise<Event>((resolve) => {
    const sub = relay.subscribe(filters, {
      onevent(event) {
        resolve(event)
      },
      oneose() {
        sub.close()
      },
    })
  })

  return Promise.race([connection, timout])
}

export const poolList = (
  pool: SimplePool,
  relays: string[],
  filters: Filter[],
): Promise<Event[]> => {
  return new Promise((resolve) => {
    const events = <Event[]>[]
    let h = pool.subscribeMany(relays, filters, {
      onevent(event) {
        events.push(event)
      },
      oneose() {
        resolve(events)
        h.close()
      },
    })
  })
}

export const parseRelaysNip65 = (event: Event) => {
  const { tags } = event
  const relays: Nip65RelaysUrls = { read: [], write: [], all: [] }
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
    const promises = pool.publish([relay], event)
    const result = (await Promise.allSettled(promises))[0]
    return {
      relay,
      success: result.status === 'fulfilled',
    }
  })
  return await Promise.all(promises)
}

export const formatedDate = (date: number) => {
  return new Date(date * 1000).toLocaleString('default', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: 'numeric',
  })
}

export const formatedDateYear = (date: number) => {
  return new Date(date * 1000).toLocaleString('default', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  })
}

export const racePromises = (
  promises: Promise<any>[],
  handleSuccess: (result: any) => void,
  handleError: (error: any) => void,
) => {
  if (promises.length === 0) return

  const wrappedPromises = promises.map((p) =>
    p
      .then((result) => ({ result, isFulfilled: true, originalPromise: p }))
      .catch((error) => ({ result: error, isFulfilled: false, originalPromise: p })),
  )

  Promise.race(wrappedPromises).then(({ result, isFulfilled, originalPromise }) => {
    if (isFulfilled) {
      handleSuccess(result)
    } else {
      handleError(result)
    }

    // Remove the handled promise from the array
    const remainingPromises = promises.filter((p) => p !== originalPromise)

    // Continue racing the remaining promises
    racePromises(remainingPromises, handleSuccess, handleError)
  })
}

export const nip10IsFirstLevelReplyForEvent = (eventId: string, reply: Event) => {
  const nip10Data = nip10.parse(reply)
  return !nip10Data.reply && nip10Data?.root?.id === eventId
}

export const nip10IsReplyForEvent = (eventId: string, reply: Event) => {
  const nip10Data = nip10.parse(reply)
  return nip10Data?.reply?.id === eventId || nip10Data?.root?.id === eventId
}

export const loadAndInjectDataToPosts = async (
  posts: Event[],
  replyingToEvent: EventExtended | null,
  userRelaysMap: Record<string, string[]> = {},
  fallBackRelays: string[] = [],
  metasCacheStore: any,
  pool: SimplePool,
  isRootPosts: boolean,
  onPostProcessed: (post: EventExtended) => void = () => {},
) => {
  // collect promises for all posts
  const postPromises = []
  // used for filtering authors for which we already created the promise
  const cachedMetasPubkeys: Set<string> = new Set()
  let relays = fallBackRelays
  let usePurple = false

  for (const post of posts) {
    const author = post.pubkey

    if (Object.keys(userRelaysMap).length && userRelaysMap[author]?.length) {
      relays = userRelaysMap[author]
      usePurple = relays.includes(PURPLEPAG_RELAY_URL)
    }

    let metasPromise = null
    let metaAuthorPromise = null

    const allPubkeysToGet = getNoteReferences(post)
    if (!usePurple && !allPubkeysToGet.includes(author)) {
      allPubkeysToGet.push(author)
    }

    if (usePurple && !metasCacheStore.hasPubkey(author) && !cachedMetasPubkeys.has(author)) {
      metaAuthorPromise = pool.get([PURPLEPAG_RELAY_URL], { kinds: [0], authors: [author] })
      cachedMetasPubkeys.add(author)
    }

    const pubkeysForRequest: string[] = []
    allPubkeysToGet.forEach((pubkey) => {
      if (!metasCacheStore.hasPubkey(author) && !cachedMetasPubkeys.has(pubkey)) {
        pubkeysForRequest.push(pubkey)
      }
      cachedMetasPubkeys.add(pubkey)
    })

    if (pubkeysForRequest.length) {
      metasPromise = pool.querySync(relays, { kinds: [0], authors: pubkeysForRequest })
    }

    const likesRepostsRepliesPromise = pool.querySync(relays, { kinds: [1, 6, 7], '#e': [post.id] })
    const postPromise = Promise.all([
      post,
      metasPromise,
      likesRepostsRepliesPromise,
      metaAuthorPromise,
    ])

    postPromises.push(postPromise)
  }

  for (const promise of postPromises) {
    const result = await promise
    const post = result[0]
    const metas = result[1] || []
    const likesRepostsReplies = result[2] || []
    let authorMeta = result[3]

    const referencesMetas: (Event | null)[] = []
    const refsPubkeys: string[] = []

    // cache author from purplepag too, if presented
    if (authorMeta) {
      metasCacheStore.addMeta(authorMeta)
      referencesMetas.push(authorMeta)
      refsPubkeys.push(authorMeta.pubkey)
    }

    const filteredMetas = dedupByPubkeyAndSortEvents(metas)
    filteredMetas.forEach((meta) => {
      const ref: Event = meta
      metasCacheStore.addMeta(meta)
      referencesMetas.push(ref)
      refsPubkeys.push(ref.pubkey)
      if (meta.pubkey === post.pubkey) {
        authorMeta = meta
      }
    })

    cachedMetasPubkeys.forEach((pubkey) => {
      if (refsPubkeys.includes(pubkey)) return
      if (!metasCacheStore.hasPubkey(pubkey)) {
        metasCacheStore.setMetaValue(pubkey, null)
      }
      const ref = metasCacheStore.getMeta(pubkey)
      referencesMetas.push(ref)
      if (pubkey === post.pubkey) {
        authorMeta = ref
      }
    })

    injectReferencesToNote(post as EventExtended, referencesMetas)
    injectAuthorsToNotes([post], [authorMeta])

    if (isRootPosts) {
      injectRootLikesRepostsRepliesCount(post, likesRepostsReplies)
      markNotesAsRoot([post as EventExtended])
    } else {
      injectNotRootLikesRepostsRepliesCount(post, likesRepostsReplies)
      markNotesAsNotRoot([post as EventExtended])
      if (replyingToEvent) {
        injectReplyingToDataToNotes(replyingToEvent, [post as EventExtended])
      }
    }

    onPostProcessed(post as EventExtended)
  }
}

export const getEventWithAuthorById = async (
  eventId: string,
  relays: string[],
  pool: SimplePool,
) => {
  const event = await pool.get(relays, { kinds: [1], ids: [eventId] })
  if (event) {
    const authorMeta = await pool.get(relays, { kinds: [0], authors: [event.pubkey] })
    if (authorMeta) {
      injectAuthorsToNotes([event], [authorMeta])
    }
  }
  return event
}

export const isReply = (event: Event) => {
  const { reply, root } = nip10.parse(event)
  return !!reply || !!root
}

export const listRootEvents = (pool: SimplePool, relays: string[], filters: Filter[]) => {
  return new Promise((resolve) => {
    const events: Event[] = []
    let filtersLimit: number | undefined
    let newFilters = filters
    if (filters && filters.length && filters[0].limit) {
      const { limit, ...restFilters } = filters[0]
      newFilters = [restFilters]
      filtersLimit = limit
    }

    let subClosed = false
    const sub = pool.subscribeMany(relays, newFilters, {
      onevent(event: Event) {
        if (subClosed) return

        const nip10Data = nip10.parse(event)
        if (nip10Data.reply || nip10Data.root) return

        events.push(event)
        if (filtersLimit && events.length >= filtersLimit) {
          sub.close()
          subClosed = true
          resolve(events.slice(0, filtersLimit))
        }
      },
      oneose() {
        sub.close()
        const result = filtersLimit ? events.slice(0, filtersLimit) : events
        resolve(result)
      },
    })
  })
}

export const getMetaByPubkey = async (relays: string[], pubkey: string, pool: SimplePool) => {
  return await pool.get(relays, {
    kinds: [EVENT_KIND.META],
    limit: 1,
    authors: [pubkey],
  })
}

export const getDisplayUsername = (author: Author, pubkey: string) => {
  const { username, name, display_name } = author
  // order is important here, function showDisplayName based on this order too
  const usernameToShow = username || name || display_name
  if (usernameToShow.length) {
    return usernameToShow
  }
  return nip19.npubEncode(pubkey).slice(0, 10) + '...'
}

export const getUserUrlPath = (pubkey: string) => {
  return `/user/${nip19.npubEncode(pubkey)}`
}

export const getNip19FromSearch = (query: string) => {
  if (!query.length) {
    throw new Error('Public key or event id is required.')
  }

  const queryError = 'Public key or event id should be in npub or note format, or hex.'
  let nip19data
  try {
    nip19data = nip19.decode(query)
  } catch (e) {
    throw new Error(queryError)
  }

  const { type } = nip19data
  if (type !== 'npub' && type !== 'note') {
    throw new Error(queryError)
  }

  return nip19data
}
