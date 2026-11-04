class ArticleVectorDatabase {
  constructor() {
    this.worker = null;
    this.requests = new Map();
    this.nextId = 0;
    this.revision = 0;
    this.info = null;
  }

  clear() {
    this.revision += 1;
    this.info = null;
    for (const request of this.requests.values()) {
      request.reject(new DOMException("Artikkeli vaihtui.", "AbortError"));
    }
    this.requests.clear();
    this.worker?.postMessage({ type: "clear", revision: this.revision });
  }

  async build(title, text, onProgress) {
    this.clear();
    const revision = this.revision;
    const info = await this.request("index", { title, text }, onProgress);
    if (revision !== this.revision) {
      throw new DOMException("Artikkeli vaihtui.", "AbortError");
    }
    this.info = info;
    return info;
  }

  async search(text, limit = 10) {
    if (!this.info) throw new Error("Artikkelin sanavektorit eivät ole vielä valmiit.");
    if (typeof text !== "string" || !text.trim()) throw new Error("Anna hakusana.");
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Tulosten määrän pitää olla positiivinen kokonaisluku.");
    return this.request("search", { text, limit });
  }

  request(type, data, onProgress) {
    return new Promise((resolve, reject) => {
      if (location.protocol === "file:") {
        reject(new Error("Sanavektorit vaativat HTTP-palvelimen. Käynnistä ./start-local.sh ja avaa http://localhost:8000."));
        return;
      }
      if (!this.worker) {
        this.worker = new Worker("embedding-worker.js", { type: "module" });
        this.worker.onmessage = ({ data: message }) => {
          const request = this.requests.get(message.id);
          if (!request) return;
          if (message.type === "progress") {
            request.onProgress?.(message);
            return;
          }
          this.requests.delete(message.id);
          if (message.type === "error") request.reject(new Error(message.error));
          else request.resolve(message.result);
        };
        this.worker.onerror = () => {
          for (const request of this.requests.values()) {
            request.reject(new Error("Sanavektorien laskentaa ei voitu käynnistää. Tarkista verkkoyhteys ja kokeile uutta artikkelia."));
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
