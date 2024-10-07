/**
 * Utility functions related to network operations, such as connections and relays.
 */

import { SimplePool, Relay, utils, type Event } from 'nostr-tools'
import { timeout } from '@/utils/helpers'
import type { TypedRelay } from '@/types'

export const connectToSelectedRelay = async (relayUrl: string) => {
  let relay: Relay

  try {
    // two attempts to connect
    try {
      relay = await Relay.connect(relayUrl)
    } catch (e) {
      await timeout(500)
      relay = await Relay.connect(relayUrl)
    }
  } catch (e) {
    let error = `WebSocket connection to "${relayUrl}" failed. You can try again `
    if (!navigator.onLine) {
      error += `or check your internet connection.`
    } else {
      error += `Check WebSocket address. Relay address should be a correct WebSocket URL. Maybe the relay is unavailable or you are offline.`
    }
    throw new Error(error)
  }

  return relay
}

export const getConnectedReadWriteRelays = async (
  pool: SimplePool,
  readAndWriteRelays: TypedRelay[],
) => {
  const userConnectedReadRelays: string[] = []
  const userConnectedWriteRelays: string[] = []

  if (readAndWriteRelays.length) {
    const result = await Promise.all(
      readAndWriteRelays.map(async (r: TypedRelay) => {
        let relay: Relay
        try {
          relay = await pool.ensureRelay(r.url)
        } catch (e) {
          return { url: r.url, connected: false, type: r.type }
        }
        return { url: relay.url, connected: relay.connected, type: r.type }
      }),
    )

    result.forEach((r) => {
      if (r.connected) {
        userConnectedReadRelays.push(r.url)
        if (r.type === 'write') {
          userConnectedWriteRelays.push(r.url)
        }
      }

      // do not show log for the same relay again
      // if (relay?.url === r.url) return
      // const mesasge = r.connected ? 'connected to ' : 'failed to connect to '
      // logHtmlParts([
      //   { type: 'text', value: mesasge },
      //   { type: 'bold', value: r.url },
      // ])
    })
  }

  return { userConnectedReadRelays, userConnectedWriteRelays }
}

export const getFollowsConnectedRelaysMap = async (
  follows: Event,
  connectedUserRelays: string[],
  pool: SimplePool,
) => {
  const followsRelaysMap: Record<string, string[]> = {}
  let followsPubkeys: string[] = []

  if (follows.tags.length) {
    followsPubkeys = follows.tags.map((f) => f[1])
    const followsMeta = await pool.querySync(connectedUserRelays, {
      kinds: [10002],
      authors: followsPubkeys,
    })

    const followsRelaysUrlsExceptUserRelays = new Set()
    followsMeta.forEach((event: Event) => {
      event.tags.forEach((tag) => {
        if (tag[0] !== 'r') return
        const relayUrl = utils.normalizeURL(tag[1])
        if (connectedUserRelays.includes(relayUrl)) return
        followsRelaysUrlsExceptUserRelays.add(relayUrl)
      })
    })

    const followsSortedRelays = await Promise.all(
      Array.from(followsRelaysUrlsExceptUserRelays).map(async (relayUrl: any) => {
        let relay: Relay
        try {
          relay = await pool.ensureRelay(relayUrl)
        } catch (e) {
          return { url: relayUrl, connected: false }
        }
        return { url: relayUrl, connected: relay.connected }
      }),
    )

    // const isSuccess = followsSortedRelays.some((r: any) => r.connected)
    // if (isSuccess) {
    //   logHtmlParts([{ type: 'text', value: 'Connected to follows relays' }])
    // } else {
    //   logHtmlParts([{ type: 'text', value: 'Failed to connect to follows relays' }])
    // }

    const followsConnectedRelaysUrls = followsSortedRelays
      .filter((r) => r.connected)
      .map((r) => r.url)

    // creating map of relays for each follow (person which user follow)
    // this map will be used further for loading metas of authors of posts and references inside posts
    // because laoding from the bunch of all follows relays is too slow,
    // so we will load only from relays of the author of the post
    followsMeta.forEach((event: Event) => {
      const normalizedUrls: string[] = []
      event.tags.forEach((tag) => {
        if (tag[0] !== 'r') return
        const relayUrl = utils.normalizeURL(tag[1])
        if (
          followsConnectedRelaysUrls.includes(relayUrl) ||
          connectedUserRelays.includes(relayUrl)
        ) {
          normalizedUrls.push(relayUrl)
        }
      })
      followsRelaysMap[event.pubkey] = normalizedUrls
    })
  }

  return followsRelaysMap
}

export const closeWebSocket = (webSocket: WebSocket) => {
  return new Promise((resolve, reject) => {
    if (webSocket.readyState === WebSocket.CLOSING || webSocket.readyState === WebSocket.CLOSED) {
      resolve(true)
      return
    }

    webSocket.onclose = function () {
      resolve(true)
    }

    webSocket.onerror = function () {
      reject(false)
    }

    webSocket.close()
  })
}

/**
 * function used internal private property of the pool, property "relays"
 * after updating nostr-tools, this function shoule be tested and updated if needed
 */
export const asyncClosePool = async (pool: SimplePool) => {
  // @ts-ignore
  const relays = Array.from(pool.relays.keys())

  // Call the original close method
  pool.close(relays)

  // A helper function to check if a WebSocket is closed
  const isClosed = (ws: WebSocket) => !ws || ws.readyState === WebSocket.CLOSED

  // Wait for all WebSockets to close
  const relayClosePromises = relays.map(async (url) => {
    // @ts-ignore
    const ws = pool.relays.get(url)?.ws // Access the WebSocket for this relay

    if (!ws) return // If no WebSocket exists, nothing to wait for

    // Wait until the WebSocket is closed
    while (!isClosed(ws)) {
      await new Promise((resolve) => setTimeout(resolve, 100)) // Poll every 100ms
    }
  })

  // Wait for all relays to finish closing
  await Promise.all(relayClosePromises)
}

/**
 * terminate all connections to the pool
 * after using this function that pool should be destroyed
 * and new pool created if needed, because it will be in inconsistent state
 */
export const closePoolSockets = async (pool: any) => {
  try {
    /*
      @ts-ignore used here because we are using protected property of the pool
      to get direct access to relays, close them and ensure that relays were closed
      then we set pool to null, so it will have no impact on further operations
    */
    const closingSockets: Promise<unknown>[] = []
    // @ts-ignore
    pool.relays.forEach((r) => {
      // @ts-ignore
      if (!r.connected) return
      // @ts-ignore
      closingSockets.push(closeWebSocket(r.ws))
    })
    /*
      some closings may take long, this may be because of internet connection
      in general it should be fast
    */
    await Promise.all(closingSockets)
  } catch (e) {
    console.error('Error while closing websocket:', e)
  }
}
