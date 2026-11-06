// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { i18n } from "./i18n.js";

function matchingFinnishForms(forms, guess) {
  return new Set([guess, ...(forms.get(guess) || [])]);
}

function createFinnishInflections() {
  let worker = null;
  let revision = 0;
  let pending = null;
  let forms = new Map();

  function clear() {
    revision += 1;
    forms = new Map();
    pending?.reject(new DOMException(i18n.t("article.changed"), "AbortError"));
    pending = null;
    worker?.postMessage({ type: "clear", revision });
  }

  async function build(words) {
    clear();
    const requestedRevision = revision;
    const result = await new Promise((resolve, reject) => {
      pending = { resolve, reject };
      if (!worker) {
        const activeWorker = worker = new Worker(new URL("./finnish-inflections-worker.js", import.meta.url));
        activeWorker.onmessage = ({ data }) => {
          if (data.revision !== revision || !pending) return;
          const request = pending;
          pending = null;
          if (data.type === "error") request.reject(i18n.error(data.error));
          else request.resolve(data.forms);
        };
        activeWorker.onerror = () => {
          if (worker !== activeWorker) return;
          pending?.reject(i18n.error("inflections.failed"));
          pending = null;
          activeWorker.terminate();
          worker = null;
        };
      }
      worker.postMessage({ type: "index", revision: requestedRevision, words });
    });
    if (requestedRevision !== revision) {
      throw new DOMException(i18n.t("article.changed"), "AbortError");
    }
    forms = new Map(result);
  }

  return { clear, build, matchingForms: (guess) => matchingFinnishForms(forms, guess) };
}

export const finnishInflections = createFinnishInflections();
