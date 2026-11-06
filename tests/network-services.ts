// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync } from 'node:child_process'
import { createSocket } from 'node:dgram'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import { extname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PeerServer } from 'peer'

export const networkSite = 'https://198.51.100.2:9443'
export const networkSignaling = 'wss://198.51.100.2:9000'
export const networkStun = 'stun:198.51.100.2:3478'

export async function startNetworkServices() {
  const temporary = await mkdtemp(join(tmpdir(), 'denantle-network-'))
  const keyFile = join(temporary, 'key.pem')
  const certFile = join(temporary, 'cert.pem')
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyFile,
      '-out',
      certFile,
      '-days',
      '1',
      '-subj',
      '/CN=denantle-network-test',
    ],
    { stdio: 'ignore' },
  )
  const tls = {
    key: await readFile(keyFile, 'utf8'),
    cert: await readFile(certFile, 'utf8'),
  }
  const root = await realpath(
    fileURLToPath(new URL('../dist/', import.meta.url)),
  )
  const mime: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
  }
  const site = createServer(tls, async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url ?? '/', networkSite).pathname,
      )
      const file = await realpath(
        join(root, pathname === '/' ? 'index.html' : pathname),
      )
      if (!file.startsWith(root + sep)) throw new Error('Outside site root')
      response.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(await readFile(file))
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => site.listen(9443, '0.0.0.0', resolve))
  const signaling = await new Promise<import('node:http').Server>((resolve) => {
    PeerServer({ host: '0.0.0.0', port: 9000, ssl: tls }, resolve)
  })
  // Real STUN Binding responses expose the source address after each router's
  // MASQUERADE. No ICE candidates or data channels are mocked by this service.
  const stun = createSocket('udp4')
  stun.on('message', (message, remote) => {
    if (
      message.length < 20 ||
      message.readUInt16BE(0) !== 1 ||
      message.readUInt32BE(4) !== 0x2112a442
    )
      return
    const response = Buffer.alloc(32)
    response.writeUInt16BE(0x0101, 0)
    response.writeUInt16BE(12, 2)
    message.copy(response, 4, 4, 20)
    response.writeUInt16BE(0x0020, 20)
    response.writeUInt16BE(8, 22)
    response[25] = 1
    response.writeUInt16BE(remote.port ^ 0x2112, 26)
    remote.address.split('.').forEach((part, index) => {
      response[28 + index] = Number(part) ^ response[4 + index]
    })
    stun.send(response, remote.port, remote.address)
  })
  await new Promise<void>((resolve) => stun.bind(3478, '0.0.0.0', resolve))
  return async () => {
    stun.close()
    await Promise.all(
      [site, signaling].map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()))
          }),
      ),
    )
    await rm(temporary, { recursive: true, force: true })
  }
}
