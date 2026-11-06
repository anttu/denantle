// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '@playwright/test'
import type {
  InflectionResponse,
  VectorResponse,
} from '../src/worker-messages.js'

test('suomen worker tunnistaa oikealla Voikolla saman sanan taivutusmuodot', async ({
  page,
}) => {
  await page.goto('/?game=invalid')
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
        worker.postMessage({
          type: 'index',
          revision: 1,
          words: ['kissa', 'kissat', 'kissan'],
        })
      }),
  )
  expect(response.type).toBe('result')
  expect(response.revision).toBe(1)
  if (response.type !== 'result') throw new Error(response.error)
  expect(new Map(response.forms).get('kissa')).toEqual(
    expect.arrayContaining(['kissa', 'kissat', 'kissan']),
  )
})

test('vektoriworker ilmoittaa mallin latausvirheestä samalla pyyntötunnisteella', async ({
  page,
  context,
}) => {
  await context.route('https://huggingface.co/**', (route) => route.abort())
  await page.goto('/?game=invalid')
  const messages = await page.evaluate(
    () =>
      new Promise<VectorResponse[]>((resolve, reject) => {
        const received: VectorResponse[] = []
        const worker = new Worker(
          new URL('src/embedding-worker.js', location.href),
          { type: 'module' },
        )
        worker.onerror = (event) => {
          worker.terminate()
          reject(new Error(event.message))
        }
        worker.onmessage = ({ data }: MessageEvent<VectorResponse>) => {
          received.push(data)
          if (data.type === 'error' || data.type === 'result') {
            worker.terminate()
            resolve(received)
          }
        }
        worker.postMessage({
          type: 'index',
          id: 7,
          revision: 1,
          title: 'River',
          text: 'river water',
          language: 'en',
        })
      }),
  )
  expect(messages).toEqual([
    { type: 'progress', id: 7, stage: 'model' },
    { type: 'error', id: 7, error: 'vectors.processingFailed' },
  ])
})
