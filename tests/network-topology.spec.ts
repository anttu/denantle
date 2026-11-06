// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { mkdir, writeFile } from 'node:fs/promises'
import { type Browser, test as base, expect, firefox } from '@playwright/test'
import { networkDiagnostics, observeNetwork } from './network-diagnostics.js'
import {
  networkSignaling,
  networkSite,
  startNetworkServices,
} from './network-services.js'
import { useLocalPeerServer } from './peerjs-fixture.js'

const enabled = process.env.DENANTLE_NETWORK_TESTS === '1'
const test = base.extend<
  object,
  { topology: { host: Browser; lan: Browser; internet: Browser } }
>({
  topology: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires fixture dependencies to be destructured.
    async ({}, use) => {
      const stop = await startNetworkServices()
      const browsers = await Promise.all(
        ['firefox-host', 'firefox-lan', 'firefox-internet'].map((name) =>
          firefox.connect(`ws://${name}:3000/denantle-network-test`),
        ),
      )
      try {
        await use({
          host: browsers[0]!,
          lan: browsers[1]!,
          internet: browsers[2]!,
        })
      } finally {
        await Promise.all(browsers.map((browser) => browser.close()))
        await stop()
      }
    },
    { scope: 'worker' },
  ],
})
test.skip(
  !enabled,
  'Separate Firefox network namespaces are provided by tests/compose.yaml',
)

for (const scenario of [
  { name: 'same-lan', network: 'lan', guest: 'lan', candidateType: 'host' },
  {
    name: 'separate-nat',
    network: 'internet',
    guest: 'internet',
    candidateType: 'srflx',
  },
  {
    name: 'separate-nat-lan-selection',
    network: 'lan',
    guest: 'internet',
    candidateType: 'host',
  },
] as const) {
  const description =
    scenario.name === 'separate-nat-lan-selection'
      ? 'väärä lähiverkkovalinta epäonnistuu hallitusti'
      : 'erilliset Firefox-kontit jakavat pelitilan'
  test(`${scenario.name}: ${description}`, async ({ topology }, testInfo) => {
    test.setTimeout(60000)
    const contexts = await Promise.all(
      [topology.host, topology[scenario.guest]].map((browser) =>
        browser.newContext({ locale: 'fi-FI', ignoreHTTPSErrors: true }),
      ),
    )
    const pages = []
    let verified = false
    try {
      for (const context of contexts) {
        await useLocalPeerServer(context, networkSignaling)
        await observeNetwork(context)
        await context.route('https://huggingface.co/**', (route) =>
          route.abort(),
        )
        await context.route(
          'https://simple.wikipedia.org/w/api.php?**',
          (route) =>
            route.fulfill({
              json: {
                parse: {
                  title: 'River valley',
                  pageid: 123,
                  revid: 12345,
                  text: '<div class="mw-parser-output"><p>A river flows through the valley.</p></div>',
                },
              },
            }),
        )
        pages.push(await context.newPage())
      }
      const [host, guest] = pages
      await host!.goto(`${networkSite}/?game=simple-12345`)
      await expect(host!.getByRole('article')).toBeVisible()
      await host!.getByText('Moninpeli', { exact: true }).click()
      await host!.getByLabel('Yhteysverkko').selectOption(scenario.network)
      await host!
        .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
        .click()
      const invite = host!.locator('#multiplayer-auto-local')
      await expect(invite).not.toHaveValue('', { timeout: 25000 })
      if (scenario.name === 'separate-nat-lan-selection') {
        await host!
          .getByRole('textbox', { name: 'Arvaa sana', exact: true })
          .fill('river')
        await host!.getByRole('button', { name: 'Arvaa', exact: true }).click()
        await expect(host!.locator('#game-progress')).toContainText('1 arvaus')
      }
      await guest!.goto(await invite.inputValue())
      const outcome = await guest!.waitForFunction(
        () => {
          if (!document.getElementById('multiplayer-connected')!.hidden)
            return 'connected'
          if (
            document
              .getElementById('multiplayer-status')!
              .textContent?.trim() ||
            document.getElementById('multiplayer-error')!.textContent?.trim()
          )
            return 'failed'
          return false
        },
        null,
        { timeout: 35000 },
      )
      if (scenario.name === 'separate-nat-lan-selection') {
        expect(await outcome.jsonValue()).toBe('failed')
        await expect(guest!.locator('#multiplayer-status')).toHaveText(
          'Yhteys epäonnistui. Kokeile uutta kutsua tai toista verkkoa.',
        )
        // The invite URL loads the same article independently. The host's
        // existing guess must remain absent without a data channel.
        await expect(host!.locator('#game-progress')).toContainText('1 arvaus')
        await expect(guest!.locator('#article-title .revealed')).toHaveCount(0)
        await expect(guest!.locator('#game-progress')).toContainText(
          '0 arvausta',
        )
        const diagnostics = await Promise.all(pages.map(networkDiagnostics))
        expect(diagnostics[0]!.signals).toContain('OFFER')
        expect(diagnostics[1]!.signals).toContain('ANSWER')
        for (const [index, page] of pages.entries()) {
          await expect(page.locator('#multiplayer-connected')).toBeHidden()
          await expect(page.locator('#multiplayer-error')).toBeEmpty()
          const endpoint = diagnostics[index]!
          expect(endpoint.signals).toContain('SOCKET_OPEN')
          expect(endpoint.signals).toContain('OPEN')
          expect(endpoint.signals).not.toContain('SOCKET_ERROR')
          const candidates = endpoint.connections.flatMap(
            (connection) => connection.candidates,
          )
          expect(
            candidates.some((candidate) => candidate.includes('typ host')),
          ).toBe(true)
          expect(
            candidates.some((candidate) => /typ (srflx|relay)/.test(candidate)),
          ).toBe(false)
          for (const connection of endpoint.connections) {
            expect(connection.state).not.toBe('connected')
            expect(connection.selected).toBeNull()
          }
        }
        verified = true
        return
      }
      expect(await outcome.jsonValue()).toBe('connected')
      await expect(guest!.getByRole('article')).toBeVisible()
      await guest!
        .getByRole('textbox', { name: 'Arvaa sana', exact: true })
        .fill('river')
      await guest!.getByRole('button', { name: 'Arvaa', exact: true }).click()
      const selectedPaths = []
      for (const page of pages) {
        await expect(page.locator('#article-title .revealed')).toHaveText([
          'River',
        ])
        await expect(page.locator('#game-progress')).toContainText('1 arvaus')
        const diagnostics = await networkDiagnostics(page)
        const selected = diagnostics.connections.find(
          (connection) => connection.selected,
        )?.selected
        selectedPaths.push(selected)
        expect(
          scenario.name === 'separate-nat'
            ? ['srflx', 'prflx']
            : [scenario.candidateType],
        ).toContain(selected?.local?.type)
        expect([scenario.candidateType, 'prflx']).toContain(
          selected?.remote?.type,
        )
        expect(selected?.local?.protocol).toBe('udp')
        expect(selected?.remote?.protocol).toBe('udp')
      }
      if (scenario.name === 'separate-nat') {
        // Firefox may redact a local peer-reflexive address. Each remote view
        // still exposes the other router's actual WAN endpoint.
        expect(selectedPaths.map((path) => path?.remote?.address)).toEqual([
          '198.51.100.20',
          '198.51.100.10',
        ])
        expect(selectedPaths[0]?.local?.port).toBe(
          selectedPaths[1]?.remote?.port,
        )
        expect(selectedPaths[1]?.local?.port).toBe(
          selectedPaths[0]?.remote?.port,
        )
      }
      verified = true
    } finally {
      const diagnostics = await Promise.all(pages.map(networkDiagnostics))
      await mkdir(new URL('./reports/', import.meta.url), { recursive: true })
      const report = JSON.stringify(diagnostics, null, 2)
      await writeFile(
        new URL(`./reports/network-${scenario.name}.json`, import.meta.url),
        report,
      )
      await testInfo.attach('network-diagnostics', {
        body: report,
        contentType: 'application/json',
      })
      console.log(
        `Network diagnostics ${scenario.name}: ${
          verified
            ? JSON.stringify(
                diagnostics.map((endpoint) =>
                  endpoint.connections.flatMap((connection) =>
                    connection.selected ? [connection.selected] : [],
                  ),
                ),
              )
            : report
        }`,
      )
      await Promise.all(contexts.map((context) => context.close()))
    }
  })
}
