// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { type BrowserContext, expect } from '@playwright/test'
import { test, useLocalPeerServer } from './peerjs-fixture.js'

async function observePeerConnections(context: BrowserContext) {
  await context.addInitScript(() => {
    const connections: RTCPeerConnection[] = []
    Object.defineProperty(window, 'denantleTestPeerConnections', {
      value: connections,
    })
    window.RTCPeerConnection = new Proxy(window.RTCPeerConnection, {
      construct(target, args: ConstructorParameters<typeof RTCPeerConnection>) {
        const connection = new target(...args)
        connections.push(connection)
        return connection
      },
    })
  })
}

for (const { name, network, legacy, iceUrls } of [
  { name: 'lähiverkkokutsu', network: 'lan', legacy: false, iceUrls: [] },
  {
    name: 'internetkutsu',
    network: 'internet',
    legacy: false,
    iceUrls: ['stun:stun.l.google.com:19302'],
  },
  {
    name: 'vanha kutsu ilman verkkovalintaa',
    network: 'internet',
    legacy: true,
    iceUrls: ['stun:stun.l.google.com:19302'],
  },
]) {
  test(`${name} yhdistää pelaajat kutsujan valitsemilla verkkoasetuksilla`, async ({
    page: host,
    context,
    browser,
    peerServer,
  }) => {
    await useLocalPeerServer(context, peerServer)
    await observePeerConnections(context)
    await host.goto('/?game=invalid')
    await host.getByText('Moninpeli', { exact: true }).click()
    const choice = host.getByRole('combobox', { name: 'Yhteysverkko' })
    await expect(choice).toHaveValue('internet')
    await choice.selectOption(network)
    await host
      .getByRole('button', { name: 'Luo kutsulinkki', exact: true })
      .click()
    const invitation = host.locator('#multiplayer-auto-local')
    await expect(invitation).not.toHaveValue('')
    const url = new URL(await invitation.inputValue())
    const params = new URLSearchParams(url.hash.slice(1))
    expect(params.get('network') ?? 'internet').toBe(network)
    await expect(choice).toBeDisabled()
    if (legacy) {
      params.delete('network')
      url.hash = params.toString()
    }
    const guestContext = await browser.newContext()
    try {
      await useLocalPeerServer(guestContext, peerServer)
      await observePeerConnections(guestContext)
      const guest = await guestContext.newPage()
      await guest.goto(url.href)
      await expect(guest.locator('#multiplayer-connected')).toBeVisible()
      await expect(guest.locator('#multiplayer-status')).toHaveText(
        'Kutsuja valitsee uutta artikkelia…',
      )
      await expect(
        guest.getByRole('combobox', { name: 'Yhteysverkko' }),
      ).toBeHidden()
      await expect(guest).not.toHaveURL(/#.*(?:peer|token|network)=/)
      for (const player of [host, guest]) {
        const connectedUrls = await player.evaluate(() => {
          const connections = (
            window as unknown as {
              denantleTestPeerConnections: RTCPeerConnection[]
            }
          ).denantleTestPeerConnections
          return connections
            .filter((connection) => connection.connectionState === 'connected')
            .map((connection) =>
              (connection.getConfiguration().iceServers ?? []).flatMap(
                (server) => server.urls,
              ),
            )
        })
        expect(connectedUrls).toEqual([iceUrls])
      }
      await host.getByText('Yksinpeli', { exact: true }).click()
      await host.getByText('Moninpeli', { exact: true }).click()
      await expect(choice).toBeEnabled()
      await choice.selectOption(network === 'lan' ? 'internet' : 'lan')
      await expect(invitation).toHaveValue('')
      await host.getByLabel('Kieli', { exact: true }).selectOption('en')
      await expect(
        host.getByRole('combobox', { name: 'Connection network' }),
      ).toBeVisible()
    } finally {
      await guestContext.close()
    }
  })
}

test('tuntematon verkkovalinta hylätään ennen signalointiyhteyttä', async ({
  page,
}) => {
  const sockets: string[] = []
  page.on('websocket', (socket) => sockets.push(socket.url()))
  await page.goto(
    '/?game=invalid#peer=denantle-11111111111111111111111111111111&token=22222222222222222222222222222222&network=unknown',
  )
  await expect(page.locator('#multiplayer-error')).toContainText(
    'Kutsu ei kelpaa',
  )
  expect(sockets).toEqual([])
})
