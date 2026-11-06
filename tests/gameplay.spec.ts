// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test'

test('artikkeli latautuu peitettynä ja arvaus paljastaa sanan kaikki esiintymät', async ({
  page,
  context,
}) => {
  // Exact guesses work without the remotely downloaded semantic hint model.
  await context.route('https://cdn.jsdelivr.net/**', (route) => route.abort())
  await page.route(
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

  await page.goto('/?game=simple-12345')

  const article = page.getByRole('article')
  await expect(article).toBeVisible()
  await expect(article).toHaveAttribute('aria-busy', 'false')
  await expect(
    page.getByRole('link', { name: 'simple-12345', exact: true }),
  ).toBeVisible()
  await expect(page.locator('#article-source')).toHaveText(
    'Simple English Wikipedia',
  )
  await expect(page.locator('#article-title .redacted')).toHaveCount(2)
  await expect(page.locator('#article-body .redacted')).toHaveCount(10)
  await expect(article.locator('.revealed')).toHaveCount(0)
  await expect(page.locator('#article-title')).toHaveText('')
  await expect(page.locator('#article-body')).not.toContainText('river')
  await expect(
    page.getByRole('progressbar', { name: 'Paljastettuja sanoja' }),
  ).toHaveJSProperty('value', 0)

  await page
    .getByRole('textbox', { name: 'Arvaa sana', exact: true })
    .fill('river')
  await page.getByRole('button', { name: 'Arvaa', exact: true }).click()

  await expect(page.locator('#article-title .revealed')).toHaveText(['River'])
  await expect(page.locator('#article-body .revealed')).toHaveText([
    'river',
    'river',
  ])
  await expect(article.locator('.redacted')).toHaveCount(9)
  await expect(
    page.getByRole('progressbar', { name: 'Paljastettuja sanoja' }),
  ).toHaveJSProperty('value', 3)
  await expect(page.locator('#game-progress')).toContainText('1 arvaus')
  await expect(
    page.locator('#recent-guesses').getByRole('listitem'),
  ).toHaveAccessibleName('river · 3 · tarkka')
  await expect(
    page.getByRole('textbox', { name: 'Arvaa sana', exact: true }),
  ).toHaveValue('')
  await expect(page.locator('#error')).toBeEmpty()
  await expect(page.locator('#guess-feedback')).toBeEmpty()
})
