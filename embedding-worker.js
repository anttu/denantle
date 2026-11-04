const MODEL = "Xenova/all-MiniLM-L6-v2";
const BATCH_SIZE = 32;
let extractorPromise;
let revision = 0;
let database = null;
let queue = Promise.resolve();

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
      env.allowLocalModels = false;
      // A single WASM thread also works without cross-origin isolation or WebGPU.
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline("feature-extraction", MODEL, { dtype: "q8", device: "wasm" });
    })().catch((error) => {
      extractorPromise = null;
      throw error;
    });
  }
  return extractorPromise;
}

function normalizeText(text) {
  return text.normalize("NFKC").replaceAll("’", "'").toLowerCase();
}

async function indexArticle(message) {
  const counts = new Map();
  const words = normalizeText(`${message.title}\n${message.text}`).match(/\p{L}+(?:['-]\p{L}+)*/gu) || [];
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  if (counts.size === 0) throw new Error("Artikkelissa ei ole vektoroitavia sanoja.");

  self.postMessage({ id: message.id, type: "progress", stage: "model" });
  const extractor = await getExtractor();
  if (message.revision !== revision) return;

  const entries = [];
  const vocabulary = [...counts.keys()];
  let dimensions = 0;
  for (let offset = 0; offset < vocabulary.length; offset += BATCH_SIZE) {
    if (message.revision !== revision) return;
    const batch = vocabulary.slice(offset, offset + BATCH_SIZE);
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    if (message.revision !== revision) return;
    dimensions = output.dims[1];
    for (let i = 0; i < batch.length; i += 1) {
      const word = batch[i];
      entries.push({ word, count: counts.get(word), vector: new Float32Array(output.data.subarray(i * dimensions, (i + 1) * dimensions)) });
    }
    self.postMessage({ id: message.id, type: "progress", stage: "index", completed: entries.length, total: vocabulary.length });
    // Let new article/clear messages cancel this job between batches.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (message.revision !== revision) return;
  database = { entries, dimensions };
  return { title: message.title, wordCount: entries.length, dimensions, model: MODEL };
}

async function search(message) {
  if (!database) throw new Error("Artikkelin sanavektorit eivät ole vielä valmiit.");
  const extractor = await getExtractor();
  const output = await extractor([normalizeText(message.text.trim())], { pooling: "mean", normalize: true });
  if (message.revision !== revision) return;

  // Both vectors are unit length, so their dot product is cosine similarity.
  return database.entries.map(({ word, count, vector }) => {
    let score = 0;
    for (let i = 0; i < vector.length; i += 1) score += vector[i] * output.data[i];
    return { word, count, score: Math.max(-1, Math.min(1, score)) };
  }).sort((a, b) => b.score - a.score).slice(0, message.limit);
}

self.onmessage = ({ data: message }) => {
  if (message.type === "clear" || message.type === "index") {
    revision = message.revision;
    database = null;
  }
  if (message.type === "clear") return;

  // Serialize inference so a new article never runs concurrently with an old job.
  queue = queue.then(async () => {
    if (message.revision !== revision) return;
    try {
      const result = message.type === "index" ? await indexArticle(message) : await search(message);
      if (message.revision === revision) self.postMessage({ id: message.id, type: "result", result });
    } catch (error) {
      if (message.revision === revision) {
        self.postMessage({ id: message.id, type: "error", error: "Sanavektorien käsittely epäonnistui. Tarkista verkkoyhteys ja kokeile uutta artikkelia.", });
        console.error("Embedding error:", error);
      }
    }
  });
};
