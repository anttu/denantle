// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test'
import type { InflectionResponse } from '../src/worker-messages.js'

test('moduulit ja Voikko-worker toimivat Pagesin alihakemistossa', async ({
  page,
  context,
}) => {
  // Model the /denantle/ prefix served by GitHub Pages while using the real site files.
  await context.route('**/denantle/**', async (route) => {
    const url = new URL(route.request().url())
    url.pathname = url.pathname.replace(/^\/denantle/, '')
    await route.fulfill({ response: await route.fetch({ url: url.href }) })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/denantle/?game=invalid')
  await expect(page.locator('#singleplayer-enabled')).toBeChecked()
  const response = await page.evaluate(
    () =>
      new Promise<InflectionResponse>((resolve, reject) => {
        const worker = new Worker(
          new URL('src/finnish-inflections-worker.js', location.href),
        )
        worker.onerror = (event) => {
          worker.terminate()
          reject(new Error(event.message))
        }
        worker.onmessage = ({ data }: MessageEvent<InflectionResponse>) => {
          worker.terminate()
          resolve(data)
        }
        worker.postMessage({ type: 'index', revision: 2, words: ['kissat'] })
      }),
  )
  expect(response.type).toBe('result')
  if (response.type !== 'result') throw new Error(response.error)
  expect(new Map(response.forms).get('kissa')).toContain('kissat')
  expect(errors).toEqual([])
})

test('lisenssisivun oma moduuli kääntää sisällön ilman pelin käynnistämistä', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/licenses.html')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fi')
  const source = page.locator(
    'a[href="source/voikko-corresponding-source.tar.gz"]',
  )
  await expect(source).toBeVisible()
  await expect(source).not.toBeEmpty()
  expect(errors).toEqual([])
})
