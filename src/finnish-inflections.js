// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

class FinnishInflections {
  constructor() {
    this.worker = null;
    this.revision = 0;
    this.pending = null;
    this.forms = new Map();
  }

  clear() {
    this.revision += 1;
    this.forms.clear();
    this.pending?.reject(new DOMException("Artikkeli vaihtui.", "AbortError"));
    this.pending = null;
    this.worker?.postMessage({ type: "clear", revision: this.revision });
  }

  async build(words) {
    this.clear();
    const revision = this.revision;
    const forms = await new Promise((resolve, reject) => {
      this.pending = { resolve, reject };
      if (!this.worker) {
        const worker = this.worker = new Worker("src/finnish-inflections-worker.js");
        worker.onmessage = ({ data }) => {
          if (data.revision !== this.revision || !this.pending) return;
          const pending = this.pending;
          this.pending = null;
          if (data.type === "error") pending.reject(new Error(data.error));
          else pending.resolve(data.forms);
        };
        worker.onerror = () => {
          if (this.worker !== worker) return;
          this.pending?.reject(new Error("Suomen taivutusmuotojen käsittely epäonnistui."));
          this.pending = null;
          worker.terminate();
          this.worker = null;
        };
      }
      this.worker.postMessage({ type: "index", revision, words });
    });
    if (revision !== this.revision) {
      throw new DOMException("Artikkeli vaihtui.", "AbortError");
    }
    this.forms = new Map(forms);
  }

  matchingForms(guess) {
    return new Set([guess, ...(this.forms.get(guess) || [])]);
  }
}

const finnishInflections = new FinnishInflections();
