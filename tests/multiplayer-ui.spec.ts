// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from '@playwright/test'
import { test, useLocalPeerServer } from './peerjs-fixture.js'

test('tuotannon moninpelivalinta avautuu URL-parametrilla ilman asetuksen jakamista kutsussa', async ({
  page,
  context,
  peerServer,
}) => {
  await useLocalPeerServer(context, peerServer)
  await context.unroute('**/src/feature-flags.js')
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto('/?game=invalid')
  await expect(page.locator('#game-mode')).toBeHidden()
  await expect(page.locator('#multiplayer-help')).toBeHidden()
  await expect(page.locator('#multiplayer-panel')).toBeHidden()
  expect(sockets).toEqual([])

  await page.goto('/?game=invalid&multiplayer=1')
  await expect(page.locator('#game-mode')).toBeVisible()
  await expect(page.locator('#multiplayer-enabled')).toBeEnabled()
  await page.getByText('Moninpeli', { exact: true }).click()
  await page.getByLabel('Yhteysverkko').selectOption('lan')
  await page
    .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
    .click()
  const invite = page.locator('#multiplayer-auto-local')
  await expect(invite).not.toHaveValue('')
  const url = new URL(await invite.inputValue())
  expect(url.searchParams.get('game')).toBe('invalid')
  expect(url.searchParams.has('multiplayer')).toBe(false)
  expect(new URLSearchParams(url.hash.slice(1)).get('network')).toBe('lan')
  await page.getByLabel('Kieli', { exact: true }).selectOption('en')
  await expect(page.locator('#game-mode')).toBeVisible()
})

for (const entry of ['navigation', 'hashchange']) {
  test(`kutsulinkki sallii tuotannon vieraan pelata käyttöliittymälipun ollessa pois: ${entry}`, async ({
    page: host,
    context,
    browser,
    peerServer,
  }) => {
    await useLocalPeerServer(context, peerServer)
    await context.route('https://huggingface.co/**', (route) => route.abort())
    await context.route('https://simple.wikipedia.org/w/api.php?**', (route) =>
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
    await host.goto('/?game=simple-12345')
    await expect(host.getByRole('article')).toBeVisible()
    await host.getByText('Moninpeli', { exact: true }).click()
    await host
      .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
      .click()
    const invite = host.locator('#multiplayer-auto-local')
    await expect(invite).not.toHaveValue('')

    const guestContext = await browser.newContext()
    try {
      await useLocalPeerServer(guestContext, peerServer)
      await guestContext.unroute('**/src/feature-flags.js')
      await guestContext.route('https://huggingface.co/**', (route) =>
        route.abort(),
      )
      const guest = await guestContext.newPage()
      const url = new URL(await invite.inputValue())
      if (entry === 'hashchange') {
        await guest.goto('/?game=invalid')
        await expect(guest.locator('#game-mode')).toBeHidden()
        await guest.evaluate((hash) => {
          window.location.hash = hash
        }, url.hash)
      } else await guest.goto(url.href)
      await expect(guest.locator('#multiplayer-connected')).toBeVisible()
      await expect(guest.locator('#game-mode')).toBeHidden()
      await guest
        .getByRole('textbox', { name: 'Arvaa sana', exact: true })
        .fill('river')
      await guest.getByRole('button', { name: 'Arvaa', exact: true }).click()
      for (const player of [host, guest]) {
        await expect(player.locator('#article-title .revealed')).toHaveText([
          'River',
        ])
        await expect(player.locator('#game-progress')).toContainText('1 arvaus')
      }
      await guest
        .getByRole('button', { name: 'Poistu moninpelistä', exact: true })
        .click()
      await expect(guest.locator('#multiplayer-connected')).toBeHidden()
      await expect(guest.locator('#game-mode')).toBeHidden()
      await expect(guest.locator('#multiplayer-auto-create')).toBeHidden()
    } finally {
      await guestContext.close()
    }
  })
}
