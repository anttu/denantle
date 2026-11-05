// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const MODELS = {
  en: "Xenova/all-MiniLM-L6-v2",
  fi: "onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX",
};
// Keep the downloaded model and its audited license at the same revision.
const MODEL_REVISIONS = {
  [MODELS.en]: "751bff37182d3f1213fa05d7196b954e230abad9",
  [MODELS.fi]: "d4c06bf0d7680171ac30042a1387e1fdb7a90021",
};
const BATCH_SIZE = 32;
let extractorPromise;
let finnishBackground = null;
let revision = 0;
let database = null;
let queue = Promise.resolve();

async function getExtractor(model) {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
      env.allowLocalModels = false;
      // A single WASM thread also works without cross-origin isolation or WebGPU.
      env.backends.onnx.wasm.numThreads = 1;
      return pipeline("feature-extraction", model, {
        revision: MODEL_REVISIONS[model], dtype: "q8", device: "wasm",
      });
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

function wordVector(data, background) {
  const vector = new Float32Array(data);
  if (!background) return vector;

  // The multilingual sentence model has a strong common component even for
  // unrelated single words. Center on empty input so that it cannot dominate
  // word similarity, then restore unit length for cosine comparisons.
  let squaredLength = 0;
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] -= background[i];
    squaredLength += vector[i] * vector[i];
  }
  const length = Math.sqrt(squaredLength);
  if (length > 0) {
    for (let i = 0; i < vector.length; i += 1) vector[i] /= length;
  }
  return vector;
}

async function indexArticle(message) {
  const counts = new Map();
  const words = normalizeText(`${message.title}\n${message.text}`).match(/\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*/gu) || [];
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  if (counts.size === 0) throw new Error("Artikkelissa ei ole vektoroitavia sanoja.");

  self.postMessage({ id: message.id, type: "progress", stage: "model" });
  const model = MODELS[message.language] || MODELS.en;
  const extractor = await getExtractor(model);
  if (message.revision !== revision) return;
  if (model === MODELS.fi && !finnishBackground) {
    const output = await extractor([""], { pooling: "mean", normalize: true });
    finnishBackground = new Float32Array(output.data);
  }
  if (message.revision !== revision) return;
  const background = model === MODELS.fi ? finnishBackground : null;

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
      entries.push({ word, count: counts.get(word), vector: wordVector(output.data.subarray(i * dimensions, (i + 1) * dimensions), background) });
    }
    self.postMessage({ id: message.id, type: "progress", stage: "index", completed: entries.length, total: vocabulary.length });
    // Let new article/clear messages cancel this job between batches.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (message.revision !== revision) return;
  database = { entries, dimensions, model, background };
  return { title: message.title, wordCount: entries.length, dimensions, model };
}

async function search(message) {
  if (!database) throw new Error("Artikkelin sanavektorit eivät ole vielä valmiit.");
  const extractor = await getExtractor(database.model);
  const output = await extractor([normalizeText(message.text.trim())], { pooling: "mean", normalize: true });
  if (message.revision !== revision) return;
  const query = wordVector(output.data, database.background);

  // Both vectors are unit length, so their dot product is cosine similarity.
  return database.entries.map(({ word, count, vector }) => {
    let score = 0;
    for (let i = 0; i < vector.length; i += 1) score += vector[i] * query[i];
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
