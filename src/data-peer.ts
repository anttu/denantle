// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { MultiplayerMessage } from './contracts.js'
import { i18n } from './i18n.js'
import { isRecord } from './validation.js'

export interface PeerCallbacks {
  onOpen?: () => void
  onClose?: (message: unknown) => void
  onMessage?: (message: unknown) => void
}

export interface GamePeer extends PeerCallbacks {
  readonly connected: boolean
  send(message: MultiplayerMessage): Promise<void>
  close(message?: unknown): void
}

export function directIceConfiguration(): RTCConfiguration {
  return { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
}

// Both connection methods use the same bounded, ordered JSON framing.
export function createDataPeer(
  channel: RTCDataChannel,
  callbacks: PeerCallbacks,
): GamePeer {
  let closed = false
  let opened = false
  let received = ''
  let sendQueue = Promise.resolve()
  channel.bufferedAmountLowThreshold = 65536

  function connected() {
    return !closed && channel.readyState === 'open'
  }
  function open() {
    if (closed || opened) return
    opened = true
    callbacks.onOpen?.()
  }
  function close(
    message: unknown = i18n.message('multiplayer.connectionClosed'),
  ) {
    if (closed) return
    closed = true
    received = ''
    channel.removeEventListener('open', open)
    channel.removeEventListener('message', receive)
    channel.removeEventListener('close', onClose)
    channel.removeEventListener('error', onError)
    channel.close()
    callbacks.onClose?.(message)
  }
  function onClose() {
    close(i18n.message('multiplayer.peerLeft'))
  }
  function onError() {
    close(i18n.message('multiplayer.connectionFailed'))
  }
  function receive({ data }: MessageEvent<unknown>) {
    try {
      if (typeof data !== 'string' || data.length > 20000) throw new Error()
      const chunk: unknown = JSON.parse(data)
      if (
        !isRecord(chunk) ||
        typeof chunk.part !== 'string' ||
        typeof chunk.last !== 'boolean'
      )
        throw new Error()
      received += chunk.part
      if (received.length > 4 * 1024 * 1024) throw new Error()
      if (!chunk.last) return
      const message: unknown = JSON.parse(received)
      received = ''
      callbacks.onMessage?.(message)
    } catch {
      close(i18n.message('multiplayer.invalidMessage'))
    }
  }
  function send(message: MultiplayerMessage) {
    const task = sendQueue.then(async () => {
      if (!connected()) throw i18n.error('multiplayer.notOpen')
      const text = JSON.stringify(message)
      if (text.length > 4 * 1024 * 1024)
        throw i18n.error('multiplayer.tooLarge')
      // Keep every frame below browsers' 16 KiB limit, including Unicode.
      for (let offset = 0; offset < text.length; offset += 2000) {
        if (!connected()) throw i18n.error('multiplayer.interrupted')
        if (channel.bufferedAmount > 131072) {
          await new Promise<void>((resolve, reject) => {
            const finish = (error?: unknown) => {
              clearTimeout(timer)
              channel.removeEventListener('bufferedamountlow', ready)
              channel.removeEventListener('close', stopped)
              if (error) reject(error)
              else resolve()
            }
            const ready = () => finish()
            const stopped = () => finish(i18n.error('multiplayer.interrupted'))
            const timer = setTimeout(
              () => finish(i18n.error('multiplayer.sendTimeout')),
              15000,
            )
            channel.addEventListener('bufferedamountlow', ready, { once: true })
            channel.addEventListener('close', stopped, { once: true })
            if (channel.bufferedAmount <= 65536) ready()
          })
        }
        if (!connected()) throw i18n.error('multiplayer.interrupted')
        channel.send(
          JSON.stringify({
            part: text.slice(offset, offset + 2000),
            last: offset + 2000 >= text.length,
          }),
        )
      }
    })
    sendQueue = task.catch(() => {})
    return task
  }
  channel.addEventListener('open', open)
  channel.addEventListener('message', receive)
  channel.addEventListener('close', onClose)
  channel.addEventListener('error', onError)
  if (channel.readyState === 'open') queueMicrotask(open)
  return {
    send,
    close,
    get connected() {
      return connected()
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
