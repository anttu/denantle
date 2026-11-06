// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { FinnishForms, FinnishInflections } from './contracts.js'
import { i18n } from './i18n.js'
import type {
  InflectionRequest,
  InflectionResponse,
} from './worker-messages.js'

function matchingFinnishForms(forms: Map<string, string[]>, guess: string) {
  return new Set([guess, ...(forms.get(guess) || [])])
}

function createFinnishInflections(): FinnishInflections {
  let worker: Worker | null = null
  let revision = 0
  let pending: {
    resolve: (forms: FinnishForms) => void
    reject: (reason: unknown) => void
  } | null = null
  let forms = new Map<string, string[]>()

  function clear() {
    revision += 1
    forms = new Map()
    pending?.reject(new DOMException(i18n.t('article.changed'), 'AbortError'))
    pending = null
    worker?.postMessage({ type: 'clear', revision } satisfies InflectionRequest)
  }

  async function build(words: string[]) {
    clear()
    const requestedRevision = revision
    const result = await new Promise<FinnishForms>((resolve, reject) => {
      pending = { resolve, reject }
      if (!worker) {
        const activeWorker = new Worker(
          new URL('./finnish-inflections-worker.js', import.meta.url),
        )
        worker = activeWorker
        activeWorker.onmessage = ({
          data,
        }: MessageEvent<InflectionResponse>) => {
          if (data.revision !== revision || !pending) return
          const request = pending
          pending = null
          if (data.type === 'error') request.reject(i18n.error(data.error))
          else request.resolve(data.forms)
        }
        activeWorker.onerror = () => {
          if (worker !== activeWorker) return
          pending?.reject(i18n.error('inflections.failed'))
          pending = null
          activeWorker.terminate()
          worker = null
        }
      }
      worker.postMessage({
        type: 'index',
        revision: requestedRevision,
        words,
      } satisfies InflectionRequest)
    })
    if (requestedRevision !== revision) {
      throw new DOMException(i18n.t('article.changed'), 'AbortError')
    }
    forms = new Map(result)
  }

  return {
    clear,
    build,
    matchingForms: (guess) => matchingFinnishForms(forms, guess),
  }
}

export const finnishInflections = createFinnishInflections()
