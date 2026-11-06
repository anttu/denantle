// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { type DataConnection, Peer } from 'peerjs'
import type { MultiplayerMessage } from './contracts.js'
import {
  createDataPeer,
  directIceConfiguration,
  type GamePeer,
  type PeerCallbacks,
} from './data-peer.js'
import { i18n } from './i18n.js'
import { isRecord } from './validation.js'

export function randomInvitationToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export function validPeerInvite(
  id: string | null,
  token: string | null,
): id is string {
  return (
    /^denantle-[a-f0-9]{32}$/.test(id ?? '') &&
    /^[a-f0-9]{32}$/.test(token ?? '')
  )
}

function wrapConnection(connection: DataConnection): GamePeer {
  const callbacks: PeerCallbacks = {}
  let dataPeer: GamePeer | null = null
  let closed = false
  const timer = setTimeout(
    () => close(i18n.message('multiplayer.noConnection')),
    30000,
  )
  function close(
    message: unknown = i18n.message('multiplayer.connectionClosed'),
  ) {
    if (closed) return
    closed = true
    clearTimeout(timer)
    dataPeer?.close()
    connection.close()
    callbacks.onClose?.(message)
  }
  connection.on('open', () => {
    if (closed) {
      connection.close()
      return
    }
    clearTimeout(timer)
    dataPeer = createDataPeer(connection.dataChannel, {
      onOpen: () => callbacks.onOpen?.(),
      onClose: (message) => close(message),
      onMessage: (message) => callbacks.onMessage?.(message),
    })
  })
  connection.on('close', () => close(i18n.message('multiplayer.peerLeft')))
  connection.on('error', () =>
    close(i18n.message('multiplayer.connectionFailed')),
  )
  return {
    close,
    get connected() {
      return !closed && Boolean(dataPeer?.connected)
    },
    send(message: MultiplayerMessage) {
      return dataPeer && !closed
        ? dataPeer.send(message)
        : Promise.reject(i18n.error('multiplayer.notOpen'))
    },
    set onOpen(handler: PeerCallbacks['onOpen']) {
      callbacks.onOpen = handler
    },
    set onClose(handler: PeerCallbacks['onClose']) {
      callbacks.onClose = handler
    },
    set onMessage(handler: PeerCallbacks['onMessage']) {
      callbacks.onMessage = handler
    },
  }
}

interface SessionCallbacks {
  hostToken?: string
  onConnection(peer: GamePeer): void
  onOpen(): void
  onUnavailable(): void
}

export function createPeerJsSession(callbacks: SessionCallbacks) {
  const client = new Peer(`denantle-${randomInvitationToken()}`, {
    config: directIceConfiguration(),
    secure: true,
    debug: 0,
  })
  let closed = false
  const connections = new Set<GamePeer>()
  let rejectReady: (error: Error) => void = () => {}
  const ready = new Promise<string>((resolve, reject) => {
    rejectReady = reject
    client.on('open', (id) => {
      if (closed) return
      clearTimeout(timer)
      resolve(id)
      callbacks.onOpen()
    })
  })
  const timer = setTimeout(() => {
    rejectReady(i18n.error('multiplayer.signalingUnavailable'))
    callbacks.onUnavailable()
  }, 20000)
  client.on('connection', (connection) => {
    const metadata: unknown = connection.metadata
    if (
      closed ||
      !callbacks.hostToken ||
      connection.label !== 'denantle' ||
      connection.serialization !== 'raw' ||
      !isRecord(metadata) ||
      metadata.denantle !== 1 ||
      metadata.token !== callbacks.hostToken
    ) {
      connection.close()
      return
    }
    const peer = wrapConnection(connection)
    connections.add(peer)
    connection.on('close', () => connections.delete(peer))
    callbacks.onConnection(peer)
  })
  client.on('call', (call) => call.close())
  client.on('error', (error) => {
    // SDP failures belong to that data connection, not the signaling service.
    // Its own close/error/timeout path cleans it up without blocking other guests.
    if (closed || error.type === 'webrtc') return
    clearTimeout(timer)
    rejectReady(i18n.error('multiplayer.signalingUnavailable'))
    callbacks.onUnavailable()
  })
  client.on('disconnected', () => {
    if (!closed) callbacks.onUnavailable()
  })
  client.on('close', () => {
    if (!closed) callbacks.onUnavailable()
  })
  return {
    ready,
    get destroyed() {
      return client.destroyed
    },
    connect(id: string, token: string) {
      if (closed) throw i18n.error('multiplayer.closed')
      const connection = client.connect(id, {
        label: 'denantle',
        serialization: 'raw',
        reliable: true,
        metadata: { denantle: 1, token },
      })
      const peer = wrapConnection(connection)
      connections.add(peer)
      connection.on('close', () => connections.delete(peer))
      return peer
    },
    reconnect() {
      if (!closed && client.disconnected && !client.destroyed)
        client.reconnect()
    },
    close() {
      if (closed) return
      closed = true
      clearTimeout(timer)
      rejectReady(new DOMException(i18n.t('multiplayer.closed'), 'AbortError'))
      for (const connection of connections) connection.close()
      connections.clear()
      client.destroy()
    },
  }
}
