// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

function validateVectorSearch(info, text, limit) {
  if (!info) throw i18n.error("vectors.notReady");
  if (typeof text !== "string" || !text.trim()) throw i18n.error("vectors.query");
  if (!Number.isInteger(limit) || limit < 1) throw i18n.error("vectors.limit");
}

function createArticleVectors() {
  let worker = null;
  const requests = new Map();
  let nextId = 0;
  let revision = 0;
  let info = null;
  let language = null;

  function clear() {
    revision += 1;
    info = null;
    for (const request of requests.values()) {
      request.reject(new DOMException(i18n.t("article.changed"), "AbortError"));
    }
    requests.clear();
    worker?.postMessage({ type: "clear", revision });
  }

  async function build(title, text, onProgress, nextLanguage = "en") {
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

  async function search(text, limit = 10) {
    validateVectorSearch(info, text, limit);
    return request("search", { text, limit });
  }

  function request(type, data, onProgress) {
    return new Promise((resolve, reject) => {
      if (location.protocol === "file:") {
        reject(i18n.error("vectors.server"));
        return;
      }
      if (!worker) {
        worker = new Worker("src/embedding-worker.js", { type: "module" });
        worker.onmessage = ({ data: message }) => {
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
          worker.terminate();
          worker = null;
        };
      }
      const id = ++nextId;
      requests.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, type, revision, ...data });
    });
  }
  return { clear, build, search, get info() { return info; } };
}

const articleVectors = createArticleVectors();
