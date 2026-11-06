// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { MultiplayerMessage } from './contracts.js'
import {
  createDataPeer,
  directIceConfiguration,
  type GamePeer,
  type PeerCallbacks,
} from './data-peer.js'
import { i18n } from './i18n.js'
import { decodeSignalingPayload } from './signaling-payload.js'
import { isRecord } from './validation.js'

// Signaling is manual: each description includes all gathered ICE candidates.
// Google's STUN server discovers public addresses; game data stays peer-to-peer.
export function readSignalingDescription(
  text: string,
  type: 'offer' | 'answer',
): RTCSessionDescriptionInit {
  try {
    const data: unknown = JSON.parse(decodeSignalingPayload(text))
    if (
      !isRecord(data) ||
      data.denantle !== 1 ||
      !isRecord(data.description) ||
      data.description.type !== type ||
      typeof data.description.sdp !== 'string' ||
      !data.description.sdp.startsWith('v=0')
    )
      throw new Error()
    return { type, sdp: data.description.sdp }
  } catch {
    throw i18n.error(
      type === 'offer'
        ? i18n.message('multiplayer.invalidInvite')
        : i18n.message('multiplayer.invalidResponse'),
    )
  }
}

export function createManualPeerConnection({
  onOpen,
  onClose,
  onMessage,
}: PeerCallbacks = {}) {
  const peer = new RTCPeerConnection(directIceConfiguration())
  let dataPeer: GamePeer | null = null
  let closed = false
  let channel: RTCDataChannel | null = null
  let connectionTimeout: ReturnType<typeof setTimeout> | undefined
  let cancelGathering: (() => void) | null = null

  function connected() {
    return !closed && Boolean(dataPeer?.connected)
  }

  function bindChannel(nextChannel: RTCDataChannel) {
    channel = nextChannel
    dataPeer = createDataPeer(nextChannel, {
      onOpen: () => {
        clearTimeout(connectionTimeout)
        onOpen?.()
      },
      onClose: (message) => close(message),
      onMessage: (message) => onMessage?.(message),
    })
  }

  async function localDescription(description: RTCSessionDescriptionInit) {
    await peer.setLocalDescription(description)
    if (peer.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const done = (error?: unknown) => {
          clearTimeout(timer)
          peer.removeEventListener('icegatheringstatechange', changed)
          cancelGathering = null
          if (error) reject(error)
          else resolve()
        }
        const changed = () => {
          if (peer.iceGatheringState === 'complete') done()
        }
        const timer = setTimeout(
          () => done(i18n.error('multiplayer.gatheringTimeout')),
          20000,
        )
        cancelGathering = () =>
          done(new DOMException(i18n.t('multiplayer.closed'), 'AbortError'))
        peer.addEventListener('icegatheringstatechange', changed)
        changed()
      })
    }
    if (closed)
      throw new DOMException(i18n.t('multiplayer.closed'), 'AbortError')
    return JSON.stringify({
      denantle: 1,
      description: peer.localDescription!.toJSON(),
    })
  }

  async function createOffer() {
    bindChannel(peer.createDataChannel('denantle'))
    return localDescription(await peer.createOffer())
  }

  async function acceptOffer(text: string) {
    await peer.setRemoteDescription(readSignalingDescription(text, 'offer'))
    return localDescription(await peer.createAnswer())
  }

  async function acceptAnswer(text: string) {
    await peer.setRemoteDescription(readSignalingDescription(text, 'answer'))
    connectionTimeout = setTimeout(() => {
      if (!connected()) close(i18n.message('multiplayer.noConnection'))
    }, 30000)
  }

  function send(message: MultiplayerMessage) {
    return dataPeer && !closed
      ? dataPeer.send(message)
      : Promise.reject(i18n.error('multiplayer.notOpen'))
  }

  function close(
    message: unknown = i18n.message('multiplayer.connectionClosed'),
  ) {
    if (closed) return
    closed = true
    clearTimeout(connectionTimeout)
    cancelGathering?.()
    dataPeer?.close()
    peer.close()
    onClose?.(message)
  }

  peer.ondatachannel = ({ channel: incomingChannel }) => {
    if (channel || incomingChannel.label !== 'denantle') {
      incomingChannel.close()
      return
    }
    bindChannel(incomingChannel)
  }
  peer.onconnectionstatechange = () => {
    const state = peer.connectionState
    if (state === 'failed' || state === 'closed')
      close(i18n.message('multiplayer.reconnect'))
    if (state === 'connected') clearTimeout(connectionTimeout)
  }
  return {
    createOffer,
    acceptOffer,
    acceptAnswer,
    send,
    close,
    get connected() {
      return connected()
    },
    get signalingState() {
      return peer.signalingState
    },
    set onOpen(handler: PeerCallbacks['onOpen']) {
      onOpen = handler
    },
    set onClose(handler: PeerCallbacks['onClose']) {
      onClose = handler
    },
    set onMessage(handler: PeerCallbacks['onMessage']) {
      onMessage = handler
    },
  }
}
