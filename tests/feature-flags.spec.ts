// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test'
import { enableMultiplayer } from './feature-flags-fixture.js'

test('käsin yhdistäminen on oletuksena pois käytöstä molemmilla kielillä', async ({
  page,
  context,
}) => {
  await enableMultiplayer(context)
  await page.goto('/?game=invalid')
  await page.getByText('Moninpeli', { exact: true }).click()
  await expect(page.locator('#multiplayer-manual')).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Luo kutsulinkki', exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('[data-i18n="help.multiplayer"]'),
  ).not.toContainText('käsin')
  await page.getByLabel('Kieli', { exact: true }).selectOption('en')
  await expect(page.locator('#multiplayer-manual')).toBeHidden()
  await expect(
    page.locator('[data-i18n="help.multiplayer"]'),
  ).not.toContainText('manually')
})

test('vanha käsinkutsu ei aloita moninpeliä lipun ollessa pois päältä', async ({
  page,
  context,
}) => {
  await enableMultiplayer(context)
  await page.goto('/?game=invalid#join=invalid')
  await expect(
    page.getByRole('radio', { name: 'Yksinpeli', exact: true }),
  ).toBeChecked()
  await expect(page.locator('#multiplayer-panel')).toBeHidden()
  await expect(page.locator('#multiplayer-error')).toBeEmpty()
  await page.evaluate(() => {
    window.location.hash = 'join=another-invite'
  })
  await expect(page.locator('#multiplayer-panel')).toBeHidden()
  await expect(page.locator('#multiplayer-local')).toHaveValue('')
})
