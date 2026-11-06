// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect } from '@playwright/test'
import { enableManualMultiplayer } from './feature-flags-fixture.js'
import { test, useLocalPeerServer } from './peerjs-fixture.js'

test('sama kutsulinkki yhdistää kaksi vierasta automaattisesti ja säilyy käytössä', async ({
  page: host,
  context,
  browser,
  peerServer,
}) => {
  await enableManualMultiplayer(context)
  await useLocalPeerServer(context, peerServer)
  await host.goto('/?game=invalid')
  await host.getByText('Moninpeli', { exact: true }).click()
  await expect(host.getByLabel('Liitä kaverin vastaus')).toBeHidden()
  await host
    .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
    .click()
  const invitation = host.locator('#multiplayer-auto-local')
  await expect(invitation).toHaveValue(
    /#peer=denantle-[a-f0-9]{32}&token=[a-f0-9]{32}$/,
  )
  const link = await invitation.inputValue()
  await expect(host.locator('#multiplayer-status')).toHaveText('')
  const contexts = []
  try {
    for (let index = 0; index < 2; index++) {
      const guestContext = await browser.newContext()
      contexts.push(guestContext)
      await useLocalPeerServer(guestContext, peerServer)
      const guest = await guestContext.newPage()
      await guest.goto(link)
      await expect(guest.locator('#multiplayer-connected')).toBeVisible()
      await expect(guest.locator('#multiplayer-status')).toHaveText(
        'Kutsuja valitsee uutta artikkelia…',
      )
      await expect(guest.locator('#multiplayer-manual')).toBeHidden()
      await expect(guest).not.toHaveURL(/#peer=/)
      await expect(invitation).toHaveValue(link)
    }
    await expect(host.locator('#multiplayer-player-count')).toHaveText(
      '3 pelaajaa',
    )
    await contexts[0]!.close()
    contexts.shift()
    await expect(host.locator('#multiplayer-player-count')).toHaveText(
      '2 pelaajaa',
    )
    await expect(invitation).toHaveValue(link)
    // A manual guest can join the same host without replacing its shared link.
    await host.getByText('Yhdistä käsin', { exact: true }).click()
    await host
      .getByRole('button', { name: 'Luo uusi kutsu', exact: true })
      .click()
    const manualInvite = host.locator('#multiplayer-local')
    await expect(manualInvite).not.toHaveValue('')
    const manualContext = await browser.newContext()
    await enableManualMultiplayer(manualContext)
    contexts.push(manualContext)
    const manualGuest = await manualContext.newPage()
    await manualGuest.goto(await manualInvite.inputValue())
    const answer = manualGuest.locator('#multiplayer-local')
    await expect(answer).not.toHaveValue('')
    await host
      .getByLabel('Liitä kaverin vastaus')
      .fill(await answer.inputValue())
    await host
      .getByRole('button', { name: 'Hyväksy vastaus', exact: true })
      .click()
    await expect(manualGuest.locator('#multiplayer-connected')).toBeVisible()
    await expect(host.locator('#multiplayer-player-count')).toHaveText(
      '3 pelaajaa',
    )
    await expect(invitation).toHaveValue(link)
    await host.getByText('Yksinpeli', { exact: true }).click()
    await expect(invitation).toHaveValue('')
    await expect(host.locator('#multiplayer-panel')).toBeHidden()
  } finally {
    for (const guestContext of contexts) await guestContext.close()
  }
})

test('virheellinen automaattikutsu ei aloita kättelyä eikä avaa käsinvaihtoa', async ({
  page,
}) => {
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto('/?game=invalid#peer=invalid&token=invalid')
  await expect(page.locator('#multiplayer-error')).toContainText(
    'Kutsu ei kelpaa',
  )
  expect(sockets).toEqual([])
  await expect(page.locator('#multiplayer-manual')).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Luo kutsulinkki', exact: true }),
  ).toBeVisible()
})

test('automaattinen liittyminen jakaa arvaukset ja myöhemmin liittyvä saa nykyisen pelitilan', async ({
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
          text: '<div class="mw-parser-output"><p>A river flows through the valley.</p><p>The river is water.</p></div>',
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
  const invitation = host.locator('#multiplayer-auto-local')
  await expect(invitation).not.toHaveValue('')
  const link = await invitation.inputValue()
  const contexts = []
  try {
    for (let index = 0; index < 2; index++) {
      const guestContext = await browser.newContext()
      contexts.push(guestContext)
      await useLocalPeerServer(guestContext, peerServer)
      await guestContext.route('https://huggingface.co/**', (route) =>
        route.abort(),
      )
      const guest = await guestContext.newPage()
      await guest.goto(link)
      await expect(guest.getByRole('article')).toBeVisible()
      if (index === 0) {
        // Drop only signaling: the existing game channel must keep working.
        await host.evaluate(() => {
          const sockets = (
            window as unknown as { denantleTestSignalingSockets: WebSocket[] }
          ).denantleTestSignalingSockets
          sockets[0]!.close()
        })
        await expect(host.locator('#multiplayer-auto-status')).toContainText(
          'Automaattinen liittyminen ei onnistu',
        )
        await guest
          .getByRole('textbox', { name: 'Arvaa sana', exact: true })
          .fill('river')
        await guest.getByRole('button', { name: 'Arvaa', exact: true }).click()
      }
      for (const player of [host, guest]) {
        await expect(player.locator('#article-title .revealed')).toHaveText([
          'River',
        ])
        await expect(player.locator('#article-body .revealed')).toHaveText([
          'river',
          'river',
        ])
        await expect(player.locator('#game-progress')).toContainText('1 arvaus')
        if (index !== 0 || player !== host)
          await expect(player.locator('#multiplayer-error')).toBeEmpty()
      }
      if (index === 0) {
        await host
          .getByRole('button', { name: 'Yritä uudelleen', exact: true })
          .click()
        await expect(host.locator('#multiplayer-auto-status')).toContainText(
          'Linkki on valmis',
        )
        await expect(invitation).toHaveValue(link)
        await expect(host.locator('#multiplayer-error')).toBeEmpty()
      }
    }
    await expect(host.locator('#multiplayer-player-count')).toHaveText(
      '3 pelaajaa',
    )
    await expect(invitation).toHaveValue(link)
  } finally {
    for (const guestContext of contexts) await guestContext.close()
  }
})

test('artikkelin vaihto ei avaa signalointiyhteyttä ennen kutsulinkin luomista', async ({
  page,
  context,
  peerServer,
}) => {
  await useLocalPeerServer(context, peerServer)
  await context.route('https://huggingface.co/**', (route) => route.abort())
  await context.route('https://simple.wikipedia.org/w/api.php?**', (route) => {
    const action = new URL(route.request().url()).searchParams.get('action')
    return route.fulfill({
      json:
        action === 'parse'
          ? {
              parse: {
                title: 'River valley',
                pageid: 123,
                revid: 12345,
                text: '<div class="mw-parser-output"><p>A river flows through the valley.</p></div>',
              },
            }
          : { query: { categorymembers: [{ ns: 0, title: 'River valley' }] } },
    })
  })
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto('/?game=invalid')
  await page.getByText('Moninpeli', { exact: true }).click()
  await page.locator('#random-article').click()
  await expect(page.getByRole('article')).toBeVisible()
  await expect(page.locator('#multiplayer-auto-local-panel')).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Luo kutsulinkki', exact: true }),
  ).toBeVisible()
  expect(sockets).toEqual([])
})

test('vieraan kättelyvirhe ei merkitse kutsujan signalointia katkenneeksi', async ({
  page: host,
  context,
  browser,
  peerServer,
}) => {
  await useLocalPeerServer(context, peerServer)
  await context.addInitScript(() => {
    const setRemoteDescription =
      RTCPeerConnection.prototype.setRemoteDescription
    let failNextOffer = true
    RTCPeerConnection.prototype.setRemoteDescription = function (description) {
      if (description?.type === 'offer' && failNextOffer) {
        failNextOffer = false
        return Promise.reject(
          new DOMException('Invalid incoming SDP', 'OperationError'),
        )
      }
      return Reflect.apply(setRemoteDescription, this, [
        description,
      ]) as Promise<void>
    }
  })
  await host.goto('/?game=invalid')
  await host.getByText('Moninpeli', { exact: true }).click()
  await host
    .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
    .click()
  const invitation = host.locator('#multiplayer-auto-local')
  await expect(invitation).not.toHaveValue('')
  const link = await invitation.inputValue()
  const contexts = []
  try {
    for (let index = 0; index < 2; index++) {
      const guestContext = await browser.newContext()
      contexts.push(guestContext)
      await useLocalPeerServer(guestContext, peerServer)
      const guest = await guestContext.newPage()
      await guest.goto(link)
      if (index === 0) {
        await expect(guest.locator('#multiplayer-connected')).toBeHidden()
      } else {
        await expect(guest.locator('#multiplayer-connected')).toBeVisible()
        await expect(host.locator('#multiplayer-player-count')).toHaveText(
          '2 pelaajaa',
        )
        await expect(host.locator('#multiplayer-auto-status')).toContainText(
          'Linkki on valmis',
        )
        await expect(host.locator('#multiplayer-error')).toBeEmpty()
      }
    }
  } finally {
    for (const guestContext of contexts) await guestContext.close()
  }
})

test('suljetun pelin kutsu näyttää virheen tarjoamatta käsin yhdistämistä', async ({
  page: host,
  context,
  browser,
  peerServer,
}) => {
  await useLocalPeerServer(context, peerServer)
  await host.goto('/?game=invalid')
  await host.getByText('Moninpeli', { exact: true }).click()
  await host
    .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
    .click()
  const invitation = host.locator('#multiplayer-auto-local')
  await expect(invitation).not.toHaveValue('')
  const link = await invitation.inputValue()
  await host.getByText('Yksinpeli', { exact: true }).click()
  const guestContext = await browser.newContext()
  try {
    await useLocalPeerServer(guestContext, peerServer)
    const guest = await guestContext.newPage()
    await guest.goto(link)
    await expect(guest.locator('#multiplayer-error')).toContainText(
      'Automaattinen liittyminen ei onnistu',
      { timeout: 15000 },
    )
    await expect(guest.locator('#multiplayer-connected')).toBeHidden()
    await expect(guest.locator('#multiplayer-manual')).toBeHidden()
    await expect(guest.locator('#multiplayer-error')).not.toContainText('käsin')
    await guest.getByLabel('Kieli', { exact: true }).selectOption('en')
    await expect(guest.locator('#multiplayer-error')).toHaveText(
      'Automatic joining is unavailable. Try again.',
    )
  } finally {
    await guestContext.close()
  }
})
