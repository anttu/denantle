// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Server } from 'node:http'
import { type BrowserContext, test as base } from '@playwright/test'
import { PeerServer } from 'peer'

// Only redirect the external signaling endpoint. PeerJS, PeerServer and WebRTC
// all run for real, so this suite does not depend on the shared public cloud.
export async function useLocalPeerServer(
  context: BrowserContext,
  address: string,
) {
  await context.addInitScript((host) => {
    const NativeWebSocket = window.WebSocket
    const sockets: WebSocket[] = []
    Object.defineProperty(window, 'denantleTestSignalingSockets', {
      value: sockets,
    })
    window.WebSocket = class extends NativeWebSocket {
      constructor(input: string | URL, protocols?: string | string[]) {
        const url = new URL(input)
        if (url.hostname === '0.peerjs.com') {
          url.protocol = 'ws:'
          url.host = host
        }
        super(url, protocols)
        if (new URL(input).hostname === '0.peerjs.com') sockets.push(this)
      }
    }
  }, address)
}

export const test = base.extend<object, { peerServer: string }>({
  peerServer: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixture dependency list.
    async ({}, use) => {
      const server = await new Promise<Server>((resolve) => {
        PeerServer({ host: '127.0.0.1', port: 0 }, resolve)
      })
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('No signaling address')
      try {
        await use(`127.0.0.1:${address.port}`)
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        )
      }
    },
    { scope: 'worker' },
  ],
})
