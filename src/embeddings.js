// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

class ArticleVectorDatabase {
  constructor() {
    this.worker = null;
    this.requests = new Map();
    this.nextId = 0;
    this.revision = 0;
    this.info = null;
    this.language = null;
  }

  clear() {
    this.revision += 1;
    this.info = null;
    for (const request of this.requests.values()) {
      request.reject(new DOMException(i18n.t("article.changed"), "AbortError"));
    }
    this.requests.clear();
    this.worker?.postMessage({ type: "clear", revision: this.revision });
  }

  async build(title, text, onProgress, language = "en") {
    this.clear();
    if (this.language !== language) {
      // Release the old model and cancel inference when the article language changes.
      this.worker?.terminate();
      this.worker = null;
      this.language = language;
    }
    const revision = this.revision;
    const info = await this.request("index", { title, text, language }, onProgress);
    if (revision !== this.revision) {
      throw new DOMException(i18n.t("article.changed"), "AbortError");
    }
    this.info = info;
    return info;
  }

  async search(text, limit = 10) {
    if (!this.info) throw i18n.error("vectors.notReady");
    if (typeof text !== "string" || !text.trim()) throw i18n.error("vectors.query");
    if (!Number.isInteger(limit) || limit < 1) throw i18n.error("vectors.limit");
    return this.request("search", { text, limit });
  }

  request(type, data, onProgress) {
    return new Promise((resolve, reject) => {
      if (location.protocol === "file:") {
        reject(i18n.error("vectors.server"));
        return;
      }
      if (!this.worker) {
        this.worker = new Worker("src/embedding-worker.js", { type: "module" });
        this.worker.onmessage = ({ data: message }) => {
          const request = this.requests.get(message.id);
          if (!request) return;
          if (message.type === "progress") {
            request.onProgress?.(message);
            return;
          }
          this.requests.delete(message.id);
          if (message.type === "error") request.reject(i18n.error(message.error));
          else request.resolve(message.result);
        };
        this.worker.onerror = () => {
          for (const request of this.requests.values()) {
            request.reject(i18n.error("vectors.failed"));
          }
          this.requests.clear();
          this.info = null;
          this.worker.terminate();
          this.worker = null;
        };
      }
      const id = ++this.nextId;
      this.requests.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, type, revision: this.revision, ...data });
    });
  }
}

const articleVectors = new ArticleVectorDatabase();
