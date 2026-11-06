// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test'
import { enableManualMultiplayer } from './feature-flags-fixture.js'

test.beforeEach(async ({ page, context }) => {
  await enableManualMultiplayer(context)
  await page.goto('/?game=invalid')
  await page.getByText('Moninpeli', { exact: true }).click()
  await page.getByText('Yhdistä käsin', { exact: true }).click()
})

test('kutsuja näkee molemmat yhteyden muodostamisen vaiheet myös mobiilissa', async ({
  page,
}) => {
  await expect(
    page.getByRole('heading', { name: 'Yksi arvoitus. Kaksi päätä.' }),
  ).toBeVisible()
  await expect(
    page
      .locator('#multiplayer-manual')
      .getByText('Suora yhteys', { exact: true }),
  ).toBeVisible()
  const sendStep = page.getByText('Lähetä kutsu', { exact: true })
  const answerStep = page.getByText('Liitä kaverin vastaus', { exact: true })
  await expect(sendStep).toBeVisible()
  await expect(answerStep).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Luo kutsu', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Hyväksy vastaus', exact: true }),
  ).toBeDisabled()
  // A reply cannot be accepted before the host has created its invitation.
  await page.locator('#multiplayer-remote').fill('vastaus ilman kutsua')
  await expect(
    page.getByRole('button', { name: 'Hyväksy vastaus', exact: true }),
  ).toBeDisabled()

  await page.setViewportSize({ width: 375, height: 850 })
  await expect(sendStep).toBeVisible()
  await expect(answerStep).toBeVisible()
  const sendBox = await sendStep.boundingBox()
  const answerBox = await answerStep.boundingBox()
  expect(sendBox).not.toBeNull()
  expect(answerBox).not.toBeNull()
  expect(answerBox!.y).toBeGreaterThan(sendBox!.y + sendBox!.height)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('kutsun voi liittää käsin ja palata omaan kutsuun virheellisen kutsun jälkeen', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Saitko kutsun? Liity kaverin peliin' })
    .click()
  const accept = page.getByRole('button', {
    name: 'Hyväksy kutsu',
    exact: true,
  })
  await expect(accept).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Luo kutsu', exact: true }),
  ).toBeHidden()
  await page.getByLabel('Liitä kaverin kutsu').fill('virheellinen kutsu')
  await expect(accept).toBeEnabled()
  await accept.click()
  await expect(page.locator('#multiplayer-error')).toContainText(
    'Kutsu ei kelpaa',
  )

  await page
    .getByRole('button', { name: 'Haluan kutsua itse', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Luo kutsu', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Hyväksy vastaus', exact: true }),
  ).toBeDisabled()
  await expect(page.locator('#multiplayer-remote')).toHaveValue('')
  await expect(page.locator('#multiplayer-error')).toBeEmpty()
})

test('kutsulinkki ja vastaus muodostavat moninpeliyhteyden kahden pelaajan välille', async ({
  page: host,
  browser,
}) => {
  const guestContext = await browser.newContext()
  await enableManualMultiplayer(guestContext)
  try {
    const guest = await guestContext.newPage()
    await host.getByRole('button', { name: 'Luo kutsu', exact: true }).click()
    const invitation = host.locator('#multiplayer-local')
    await expect(invitation).toHaveValue(
      /^http:\/\/127\.0\.0\.1:8000\/\?game=invalid#join=.+/,
    )

    // The guest opens the real invitation in an independent browser session.
    await guest.goto(await invitation.inputValue())
    await expect(
      guest.getByRole('radio', { name: 'Moninpeli', exact: true }),
    ).toBeChecked()
    const answer = guest.locator('#multiplayer-local')
    await expect(answer).not.toHaveValue('')
    await expect(host.locator('#multiplayer-connected')).toBeHidden()
    await expect(guest.locator('#multiplayer-connected')).toBeHidden()

    await host
      .getByLabel('Liitä kaverin vastaus')
      .fill(await answer.inputValue())
    await host
      .getByRole('button', { name: 'Hyväksy vastaus', exact: true })
      .click()

    for (const player of [host, guest]) {
      await expect(player.locator('#multiplayer-connected')).toBeVisible()
      await expect(player.locator('#multiplayer-player-count')).toHaveText(
        '2 pelaajaa',
      )
      await expect(player.locator('#multiplayer-local')).toHaveValue('')
      await expect(player.locator('#multiplayer-remote')).toHaveValue('')
      await expect(player.locator('#multiplayer-error')).toBeEmpty()
    }
    await expect(guest.locator('#multiplayer-invitations')).toBeHidden()
    // This status arrives over the real data channel; no article or model is needed.
    await expect(guest.locator('#multiplayer-status')).toHaveText(
      'Kutsuja valitsee uutta artikkelia…',
    )
  } finally {
    await guestContext.close()
  }
})

test('vieraan arvaus paljastaa artikkelin sanat molemmille pelaajille', async ({
  page: host,
  context,
  browser,
}) => {
  await context.route('https://huggingface.co/**', (route) => route.abort())
  await context.route(
    'https://simple.wikipedia.org/w/api.php?**',
    async (route) => {
      const params = new URL(route.request().url()).searchParams
      if (params.get('action') !== 'parse' || params.get('oldid') !== '12345') {
        await route.abort()
        return
      }
      await route.fulfill({
        json: {
          parse: {
            title: 'River valley',
            pageid: 123,
            revid: 12345,
            text: '<div class="mw-parser-output"><p>A river flows through the valley.</p><p>The river is water.</p></div>',
          },
        },
      })
    },
  )
  await host.goto('/?game=simple-12345')
  await expect(host.getByRole('article')).toBeVisible()
  await host.getByText('Moninpeli', { exact: true }).click()
  await host.getByText('Yhdistä käsin', { exact: true }).click()
  const guestContext = await browser.newContext()
  await enableManualMultiplayer(guestContext)
  try {
    const guest = await guestContext.newPage()
    await host.getByRole('button', { name: 'Luo kutsu', exact: true }).click()
    const invitation = host.locator('#multiplayer-local')
    await expect(invitation).not.toHaveValue('')
    await guest.goto(await invitation.inputValue())
    const answer = guest.locator('#multiplayer-local')
    await expect(answer).not.toHaveValue('')
    await host
      .getByLabel('Liitä kaverin vastaus')
      .fill(await answer.inputValue())
    await host
      .getByRole('button', { name: 'Hyväksy vastaus', exact: true })
      .click()

    await expect(guest.getByRole('article')).toBeVisible()
    await expect(guest.locator('#article-body .redacted')).toHaveCount(10)
    await guest
      .getByRole('textbox', { name: 'Arvaa sana', exact: true })
      .fill('river')
    await guest.getByRole('button', { name: 'Arvaa', exact: true }).click()

    for (const player of [host, guest]) {
      await expect(player.locator('#article-title .revealed')).toHaveText([
        'River',
      ])
      await expect(player.locator('#article-body .revealed')).toHaveText([
        'river',
        'river',
      ])
      await expect(
        player.getByRole('progressbar', { name: 'Paljastettuja sanoja' }),
      ).toHaveJSProperty('value', 3)
      await expect(player.locator('#game-progress')).toContainText('1 arvaus')
      await expect(player.locator('#multiplayer-error')).toBeEmpty()
    }
    await expect(
      guest.getByRole('textbox', { name: 'Arvaa sana', exact: true }),
    ).toHaveValue('')
  } finally {
    await guestContext.close()
  }
})
