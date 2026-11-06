// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { BrowserContext, Page } from '@playwright/test'
import { networkStun } from './network-services.js'

interface ConnectionRecord {
  pc: RTCPeerConnection
  events: unknown[]
  candidates: string[]
}
interface NetworkWindow extends Window {
  denantleNetworkProbe: { connections: ConnectionRecord[]; signals: string[] }
}

export async function observeNetwork(context: BrowserContext) {
  await context.addInitScript((stunUrl) => {
    const probe = {
      connections: [] as ConnectionRecord[],
      signals: [] as string[],
    }
    ;(window as unknown as NetworkWindow).denantleNetworkProbe = probe
    const NativeSocket = window.WebSocket
    window.WebSocket = class extends NativeSocket {
      constructor(input: string | URL, protocols?: string | string[]) {
        super(input, protocols)
        this.addEventListener('open', () => probe.signals.push('SOCKET_OPEN'))
        this.addEventListener('error', () => probe.signals.push('SOCKET_ERROR'))
        this.addEventListener('close', ({ code, reason }) =>
          probe.signals.push(`SOCKET_CLOSED ${code} ${reason}`),
        )
        this.addEventListener('message', ({ data }) => {
          try {
            probe.signals.push(JSON.parse(data).type)
          } catch {
            /* Non-JSON socket data is irrelevant. */
          }
        })
      }
    }
    window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
      construct(target, args: ConstructorParameters<typeof RTCPeerConnection>) {
        const config = args[0] ?? {}
        args[0] = {
          ...config,
          iceServers: config.iceServers?.map((server) => ({
            ...server,
            urls: (typeof server.urls === 'string'
              ? [server.urls]
              : server.urls
            ).map((url) =>
              url === 'stun:stun.l.google.com:19302' ? stunUrl : url,
            ),
          })),
        }
        const pc = new target(...args)
        const record: ConnectionRecord = { pc, events: [], candidates: [] }
        probe.connections.push(record)
        for (const event of [
          'connectionstatechange',
          'iceconnectionstatechange',
          'signalingstatechange',
        ])
          pc.addEventListener(event, () =>
            record.events.push({
              event,
              connection: pc.connectionState,
              ice: pc.iceConnectionState,
              signaling: pc.signalingState,
            }),
          )
        pc.addEventListener('icecandidate', ({ candidate }) => {
          if (candidate?.candidate) record.candidates.push(candidate.candidate)
        })
        pc.addEventListener('icecandidateerror', (event) =>
          record.events.push({
            event: 'icecandidateerror',
            code: event.errorCode,
            text: event.errorText,
            url: event.url,
          }),
        )
        return pc
      },
    })
  }, networkStun)
}

export async function networkDiagnostics(page: Page) {
  return page.evaluate(async () => {
    const probe = (window as unknown as NetworkWindow).denantleNetworkProbe
    return {
      origin: location.origin,
      secure: isSecureContext,
      status: document.getElementById('multiplayer-status')?.textContent,
      error: document.getElementById('multiplayer-error')?.textContent,
      signals: probe.signals,
      connections: await Promise.all(
        probe.connections.map(async ({ pc, events, candidates }) => {
          const stats = Array.from((await pc.getStats()).values())
          const transport = stats.find(
            (stat) => stat.type === 'transport' && stat.selectedCandidatePairId,
          )
          const pair = transport
            ? stats.find(
                (stat) => stat.id === transport.selectedCandidatePairId,
              )
            : stats.find(
                (stat) =>
                  stat.type === 'candidate-pair' &&
                  stat.nominated &&
                  stat.state === 'succeeded',
              )
          const candidate = (id: string) => {
            const entry = stats.find((stat) => stat.id === id)
            return entry
              ? {
                  type: entry.candidateType,
                  address: entry.address ?? entry.ip,
                  port: entry.port,
                  protocol: entry.protocol,
                }
              : null
          }
          return {
            state: pc.connectionState,
            events,
            candidates,
            selected: pair
              ? {
                  local: candidate(pair.localCandidateId),
                  remote: candidate(pair.remoteCandidateId),
                }
              : null,
          }
        }),
      ),
    }
  })
}
