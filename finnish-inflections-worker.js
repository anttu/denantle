// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

// Unmodified Voikko 1.0.1: libvoikko 4.3.2 and the Finnish morpho dictionary.
// License and complete corresponding source: licenses.html#voikko
let analyzer;
let revision = 0;

self.onmessage = async ({ data: message }) => {
  revision = message.revision;
  if (message.type === "clear") return;

  try {
    if (!analyzer) {
      importScripts("vendor/voikko-1.0.1.min.js");
      analyzer = Libvoikko().init("fi");
    }

    const forms = new Map();
    for (let index = 0; index < message.words.length; index += 1) {
      if (message.revision !== revision) return;
      const word = message.words[index];
      for (const analysis of analyzer.analyze(word)) {
        const bases = [analysis.BASEFORM];
        if (analysis.PARTICIPLE) {
          // Voikko reports participles as adjectives; retain their underlying verb too.
          const verb = analysis.FSTOUTPUT?.match(/^\[Lt\]\[Xp\]([^\[]+)\[X\]/)?.[1];
          if (verb) bases.push(verb);
        }
        for (const baseform of bases) {
          if (!baseform) continue;
          const base = baseform.normalize("NFKC").replaceAll("’", "'").toLowerCase();
          if (!forms.has(base)) forms.set(base, new Set());
          forms.get(base).add(word);
        }
      }
      if ((index + 1) % 64 === 0) {
        // Let article changes cancel this job without blocking the page.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    if (message.revision === revision) {
      self.postMessage({
        type: "result", revision,
        forms: [...forms].map(([base, words]) => [base, [...words]]),
      });
    }
  } catch {
    if (message.revision === revision) {
      self.postMessage({ type: "error", revision, error: "Suomen taivutusmuotojen käsittely epäonnistui." });
    }
  }
};
