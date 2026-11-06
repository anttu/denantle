// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { VectorRequest, VectorResponse } from "./worker-messages.js";

import type { ArticleVectors, Language, VectorInfo, VectorProgress, SearchResult } from "./contracts.js";

import { i18n } from "./i18n.js";

function validateVectorSearch(info: VectorInfo | null, text: string, limit: number) {
  if (!info) throw i18n.error("vectors.notReady");
  if (typeof text !== "string" || !text.trim()) throw i18n.error("vectors.query");
  if (!Number.isInteger(limit) || limit < 1) throw i18n.error("vectors.limit");
}

function createArticleVectors(): ArticleVectors {
  let worker: Worker | null = null;
  const requests = new Map<number, { resolve: (result: VectorInfo | SearchResult[]) => void; reject: (reason: unknown) => void; onProgress?: (progress: VectorProgress) => void }>();
  let nextId = 0;
  let revision = 0;
  let info: VectorInfo | null = null;
  let language: Language | null = null;

  function clear() {
    revision += 1;
    info = null;
    for (const request of requests.values()) {
      request.reject(new DOMException(i18n.t("article.changed"), "AbortError"));
    }
    requests.clear();
    worker?.postMessage({ type: "clear", revision } satisfies VectorRequest);
  }

  async function build(title: string, text: string, onProgress?: (progress: VectorProgress) => void, nextLanguage: Language = "en") {
    clear();
    if (language !== nextLanguage) {
      // Release the old model and cancel inference when the article language changes.
      worker?.terminate();
      worker = null;
      language = nextLanguage;
    }
    const requestedRevision = revision;
    const result = await request("index", { title, text, language }, onProgress);
    if (requestedRevision !== revision) {
      throw new DOMException(i18n.t("article.changed"), "AbortError");
    }
    info = result;
    return result;
  }

  async function search(text: string, limit = 10) {
    validateVectorSearch(info, text, limit);
    return request("search", { text, limit });
  }

  function request(type: "index", data: { title: string; text: string; language: Language }, onProgress?: (progress: VectorProgress) => void): Promise<VectorInfo>;
  function request(type: "search", data: { text: string; limit: number }): Promise<SearchResult[]>;
  function request(type: "index" | "search", data: { title: string; text: string; language: Language } | { text: string; limit: number }, onProgress?: (progress: VectorProgress) => void): Promise<VectorInfo | SearchResult[]> {
    return new Promise((resolve, reject) => {
      if (location.protocol === "file:") {
        reject(i18n.error("vectors.server"));
        return;
      }
      if (!worker) {
        worker = new Worker(new URL("./embedding-worker.js", import.meta.url), { type: "module" });
        worker.onmessage = ({ data: message }: MessageEvent<VectorResponse>) => {
          const pending = requests.get(message.id);
          if (!pending) return;
          if (message.type === "progress") {
            pending.onProgress?.(message);
            return;
          }
          requests.delete(message.id);
          if (message.type === "error") pending.reject(i18n.error(message.error));
          else pending.resolve(message.result);
        };
        worker.onerror = () => {
          for (const request of requests.values()) {
            request.reject(i18n.error("vectors.failed"));
          }
          requests.clear();
          info = null;
          worker?.terminate();
          worker = null;
        };
      }
      const id = ++nextId;
      requests.set(id, { resolve, reject, onProgress });
      const message: VectorRequest = "title" in data
        ? { id, type: "index", revision, ...data }
        : { id, type: "search", revision, ...data };
      worker.postMessage(message);
    });
  }
  return { clear, build, search, get info() { return info; } };
}

export const articleVectors = createArticleVectors();
