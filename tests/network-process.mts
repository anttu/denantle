// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { firefox } from '@playwright/test'

if (process.env.ROLE === 'router') {
  const wan = Object.entries(networkInterfaces()).find(([, addresses]) =>
    addresses?.some((address) => address.address === process.env.WAN_ADDRESS),
  )?.[0]
  if (!wan) throw new Error('No WAN interface')
  execFileSync('ip', [
    'route',
    'replace',
    'default',
    'via',
    '198.51.100.1',
    'dev',
    wan,
  ])
  execFileSync('iptables', ['-P', 'FORWARD', 'ACCEPT'])
  for (const subnet of ['172.28.241.0/24', '172.28.242.0/24'])
    execFileSync('iptables', [
      '-A',
      'FORWARD',
      '-o',
      wan,
      '-d',
      subnet,
      '-j',
      'DROP',
    ])
  execFileSync('iptables', [
    '-t',
    'nat',
    '-A',
    'POSTROUTING',
    '-o',
    wan,
    '-j',
    'MASQUERADE',
  ])
  if (!process.env.FORWARD_UDP_TO) throw new Error('No UDP forwarding target')
  // A permissive 1:1 UDP NAT gives the positive test a reachable mapped address.
  execFileSync('iptables', [
    '-t',
    'nat',
    '-A',
    'PREROUTING',
    '-i',
    wan,
    '-d',
    process.env.WAN_ADDRESS!,
    '-p',
    'udp',
    '-j',
    'DNAT',
    '--to-destination',
    process.env.FORWARD_UDP_TO,
  ])
  writeFileSync('/tmp/denantle-network-ready', '')
  setInterval(() => {}, 60000)
} else if (process.env.ROLE === 'browser') {
  if (!process.env.GATEWAY) throw new Error('No browser gateway')
  execFileSync('ip', [
    'route',
    'replace',
    'default',
    'via',
    process.env.GATEWAY,
  ])
  const server = await firefox.launchServer({
    headless: true,
    host: '0.0.0.0',
    port: 3000,
    wsPath: '/denantle-network-test',
  })
  writeFileSync('/tmp/denantle-network-ready', '')
  console.log('Firefox network namespace:', JSON.stringify(networkInterfaces()))
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => void server.close())
} else throw new Error('Unknown network process role')
