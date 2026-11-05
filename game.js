// Cosine similarity between the model's normalized word vectors.
const SIMILARITY_THRESHOLD = 0.6;
const DETAIL_SIMILARITY_THRESHOLD = 0.5;
const GUESS_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*$/u;

function normalizeGuess(text) {
  return text.normalize("NFKC").replaceAll("’", "'").toLowerCase();
}

function guessForms(guess, language = "en") {
  const forms = new Set([guess]);
  // Compromise generates English inflections only.
  if (language !== "en") return forms;
  const add = (form) => {
    const word = normalizeGuess(form);
    if (GUESS_PATTERN.test(word)) forms.add(word);
  };
  const word = nlp(guess);
  if (word.has("#Verb") || (word.has("#Noun") && !word.has("#Pronoun"))) {
    // A word can be both a noun and a verb, even if the tagger picks only one.
    const plurals = word.clone().tag("Noun").nouns().toPlural().out("array");
    for (const noun of [guess, ...plurals]) {
      add(noun);
      add(`${noun}'s`);
    }
  }
  for (const conjugation of word.verbs().conjugate()) {
    if (normalizeGuess(conjugation.Infinitive) !== guess) continue;
    for (const form of Object.values(conjugation)) add(form);
  }
  if (guess === "be") {
    for (const form of ["am", "are", "were"]) add(form);
  }
  for (const adjective of word.adjectives().conjugate()) {
    add(adjective.Comparative);
    add(adjective.Superlative);
  }
  return forms;
}

function proximityColor(score) {
  const closeness = Math.max(0, Math.min(1, score));
  return `rgb(${Math.round(80 + 175 * closeness)}, ${Math.round(160 - 64 * closeness)}, ${Math.round(255 - 159 * closeness)})`;
}

class ArticleGuessGame {
  constructor(vectors) {
    this.vectors = vectors;
    this.title = document.getElementById("article-title");
    this.body = document.getElementById("article-body");
    this.form = document.getElementById("guess-form");
    this.input = document.getElementById("guess-input");
    this.button = document.getElementById("guess-submit");
    this.feedback = document.getElementById("guess-feedback");
    this.progress = document.getElementById("game-progress");
    this.celebration = document.getElementById("title-celebration");
    this.recent = document.getElementById("recent-guesses");
    this.tooltip = document.getElementById("word-tooltip");
    this.article = document.getElementById("article");
    this.revision = 0;
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submitGuess();
    });
    this.bindWordDetails();
    this.reset();
  }

  reset() {
    this.hideTooltip();
    this.clearFireworks();
    this.revision += 1;
    this.words = new Map();
    this.titleWords = new Set();
    this.titleSolved = false;
    this.celebration.hidden = true;
    this.celebration.textContent = "";
    this.nodeDetails = new WeakMap();
    this.latestGuess = null;
    this.recentGuesses = [];
    // The value records whether this guess has also been checked for semantic hints.
    this.guesses = new Map();
    this.total = 0;
    this.revealed = 0;
    this.active = false;
    this.form.hidden = true;
    this.setBusy(false);
    this.input.disabled = true;
    this.button.disabled = true;
    this.input.value = "";
    this.feedback.textContent = "";
    this.progress.textContent = "";
    this.recent.replaceChildren();
    this.recent.hidden = true;
    this.title.replaceChildren();
    this.body.replaceChildren();
  }

  start(title, body, language = "en") {
    this.reset();
    this.language = language;
    this.render(this.title, title);
    this.render(this.body, body);
    this.active = true;
    this.form.hidden = false;
    this.setBusy(false);
    this.updateProgress();
  }

  render(element, text) {
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of text.matchAll(/\p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*/gu)) {
      fragment.append(document.createTextNode(text.slice(offset, match.index)));
      const original = match[0];
      const word = normalizeGuess(original);
      const node = document.createElement("span");
      node.className = "redacted";
      node.style.setProperty("--word-length", [...original].length);
      node.setAttribute("role", "button");
      node.tabIndex = 0;
      if (!this.words.has(word)) {
        this.words.set(word, { occurrences: [], revealed: false, score: -1, guess: null, latestScore: null });
      }
      const entry = this.words.get(word);
      if (element === this.title) this.titleWords.add(entry);
      const occurrence = { node, original, entry };
      entry.occurrences.push(occurrence);
      this.nodeDetails.set(node, occurrence);
      node.setAttribute("aria-label", this.wordDetails(node));
      this.total += 1;
      fragment.append(node);
      offset = match.index + original.length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    element.replaceChildren(fragment);
  }

  bindWordDetails() {
    const wordAt = (event) => event.target.closest?.(".redacted");
    this.article.addEventListener("pointerover", (event) => {
      const node = wordAt(event);
      if (node && !this.pinnedWord) this.showTooltip(node);
    });
    this.article.addEventListener("focusin", (event) => {
      const node = wordAt(event);
      if (node) {
        if (this.pinnedWord !== node) this.pinnedWord = null;
        this.showTooltip(node);
      }
    });
    for (const type of ["pointerout", "focusout"]) {
      this.article.addEventListener(type, (event) => {
        const node = wordAt(event);
        if (node && !node.contains(event.relatedTarget) && !this.pinnedWord) this.hideTooltip();
      });
    }
    this.article.addEventListener("click", (event) => {
      const node = wordAt(event);
      if (node) this.toggleTooltip(node);
    });
    this.article.addEventListener("keydown", (event) => {
      const node = wordAt(event);
      if (node && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        this.toggleTooltip(node);
      }
    });
    document.addEventListener("click", (event) => {
      if (!wordAt(event)) this.hideTooltip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.hideTooltip();
    });
    window.addEventListener("resize", () => this.hideTooltip());
    window.addEventListener("scroll", () => this.hideTooltip(), { passive: true });
  }

  wordDetails(node) {
    const { original, entry } = this.nodeDetails.get(node);
    const lines = [`Pituus: ${[...original].length} merkkiä`];
    if (entry.guess && entry.score >= DETAIL_SIMILARITY_THRESHOLD) {
      lines.push(`Vihje ”${entry.guess}”: läheisyys ${Math.round(entry.score * 100)} %`);
    }
    if (this.latestGuess && this.latestGuess !== entry.guess && entry.latestScore >= DETAIL_SIMILARITY_THRESHOLD) {
      lines.push(`Uusin arvaus ”${this.latestGuess}”: läheisyys ${Math.round(entry.latestScore * 100)} %`);
    } else if (!this.latestGuess && !entry.guess) {
      lines.push("Läheisyys: ei vielä arvausta");
    }
    return lines.join("\n");
  }

  showTooltip(node) {
    this.tooltipTarget?.removeAttribute("aria-describedby");
    this.tooltipTarget = node;
    node.setAttribute("aria-describedby", "word-tooltip");
    this.tooltip.textContent = this.wordDetails(node);
    this.tooltip.hidden = false;
    const word = node.getBoundingClientRect();
    const tooltip = this.tooltip.getBoundingClientRect();
    this.tooltip.style.left = `${Math.max(8, Math.min(word.left, window.innerWidth - tooltip.width - 8))}px`;
    const top = word.top - tooltip.height - 8;
    this.tooltip.style.top = `${Math.max(8, Math.min(top >= 8 ? top : word.bottom + 8, window.innerHeight - tooltip.height - 8))}px`;
  }

  toggleTooltip(node) {
    if (this.pinnedWord === node) this.hideTooltip();
    else {
      this.pinnedWord = node;
      this.showTooltip(node);
    }
  }

  hideTooltip() {
    this.tooltipTarget?.removeAttribute("aria-describedby");
    this.tooltipTarget = null;
    this.pinnedWord = null;
    this.tooltip.hidden = true;
  }

  showRecentGuess(guess, matches, nearMatches = 0) {
    this.recentGuesses = [
      { word: guess, matches, nearMatches },
      ...this.recentGuesses.filter(({ word }) => word !== guess),
    ].slice(0, 10);
    const list = document.createElement("ol");
    for (const { word, matches, nearMatches } of this.recentGuesses) {
      const chip = document.createElement("li");
      chip.className = "proximity-chip";
      const count = matches || nearMatches;
      chip.dataset.proximity = matches > 0 ? "exact" : nearMatches > 0 ? "near" : "cold";
      const proximity = matches > 0 ? "tarkka" : nearMatches > 0 ? "lähellä" : "kaukana";
      chip.textContent = `${word} · ${count}`;
      chip.setAttribute("aria-label", `${word} · ${count} · ${proximity}`);
      list.append(chip);
    }
    this.recent.replaceChildren(document.createTextNode("Viimeisimmät arvaukset:"), list);
    this.recent.hidden = false;
  }

  setBusy(busy) {
    this.busy = busy;
    this.input.disabled = busy;
    this.button.disabled = busy;
    this.form.setAttribute("aria-busy", String(busy));
  }

  updateProgress() {
    this.progress.textContent = `Arvauksia: ${this.guesses.size} · Paljastettuja sanoja: ${this.revealed} / ${this.total}`;
  }

  checkTitleCompletion() {
    if (this.titleSolved || this.titleWords.size === 0
      || ![...this.titleWords].every((entry) => entry.revealed)) return;
    this.titleSolved = true;
    this.celebration.hidden = false;
    this.celebration.textContent = "Hienoa! Arvasit koko otsikon oikein!";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const fireworks = document.createElement("div");
    fireworks.className = "fireworks";
    fireworks.setAttribute("aria-hidden", "true");
    const bursts = [
      [22, 35, "#df4a17"], [76, 28, "#137dce"], [48, 45, "#ba268c"],
      [32, 22, "#148754"], [72, 50, "#b07b00"],
    ];
    bursts.forEach(([left, top, color], burstIndex) => {
      const burst = document.createElement("div");
      burst.className = "firework-burst";
      burst.style.left = `${left}%`;
      burst.style.top = `${top}%`;
      burst.style.color = color;
      burst.style.setProperty("--burst-delay", `${burstIndex * 280}ms`);
      for (let index = 0; index < 32; index += 1) {
        const spark = document.createElement("span");
        const angle = index * 2 * Math.PI / 32;
        const distance = 12 + Math.random() * 12;
        spark.style.setProperty("--spark-x", `${Math.cos(angle) * distance}vmin`);
        spark.style.setProperty("--spark-y", `${Math.sin(angle) * distance + 6}vmin`);
        burst.append(spark);
      }
      fireworks.append(burst);
    });
    document.body.append(fireworks);
    this.fireworks = fireworks;
    this.fireworksTimeout = window.setTimeout(() => this.clearFireworks(), 3200);
  }

  clearFireworks() {
    window.clearTimeout(this.fireworksTimeout);
    this.fireworks?.remove();
    this.fireworks = null;
  }

  reveal(entry) {
    entry.revealed = true;
    for (const { node, original } of entry.occurrences) {
      if (this.tooltipTarget === node) this.hideTooltip();
      node.className = "revealed";
      node.textContent = original;
      node.removeAttribute("style");
      node.removeAttribute("role");
      node.removeAttribute("tabindex");
      node.removeAttribute("aria-label");
      node.removeAttribute("title");
    }
    this.revealed += entry.occurrences.length;
    return entry.occurrences.length;
  }

  showHints(results, guess) {
    this.latestGuess = guess;
    for (const entry of this.words.values()) entry.latestScore = null;
    let count = 0;
    for (const { word, score } of results) {
      const entry = this.words.get(word);
      if (!entry) continue;
      entry.latestScore = score;
      if (entry.revealed || score < SIMILARITY_THRESHOLD) continue;
      count += entry.occurrences.length;
      if (score <= entry.score) continue;
      entry.score = score;
      entry.guess = guess;
      for (const { node } of entry.occurrences) {
        node.textContent = guess;
        node.style.color = proximityColor(score);
      }
    }
    for (const entry of this.words.values()) {
      if (entry.revealed) continue;
      for (const { node } of entry.occurrences) node.setAttribute("aria-label", this.wordDetails(node));
    }
    if (this.tooltipTarget) this.showTooltip(this.tooltipTarget);
    return count;
  }

  async submitGuess() {
    if (!this.active || this.busy) return;
    const guess = normalizeGuess(this.input.value.trim());
    if (!GUESS_PATTERN.test(guess)) {
      this.feedback.textContent = this.language === "fi"
        ? "Syötä yksi sana suomeksi."
        : "Syötä yksi sana englanniksi.";
      return;
    }
    const matches = [...guessForms(guess, this.language)].map((form) => this.words.get(form)).filter(Boolean);
    const matchCount = matches.reduce((count, entry) => count + entry.occurrences.length, 0);
    if (this.guesses.has(guess) && !this.vectors.info) {
      this.showHints([], guess);
      this.showRecentGuess(guess, matchCount);
      this.feedback.textContent = `Olet jo arvannut sanan ”${guess}”.`;
      return;
    }
    if (matches.length === 0 && !this.vectors.info) {
      this.feedback.textContent = "Lähisanojen haku ei ole vielä käytettävissä. Voit arvata tarkkoja sanoja jo nyt.";
      return;
    }

    const revision = this.revision;
    const revealed = matches.reduce((count, entry) => count + (entry.revealed ? 0 : this.reveal(entry)), 0);
    this.checkTitleCompletion();
    const canSearch = Boolean(this.vectors.info);
    this.setBusy(true);
    this.updateProgress();
    this.feedback.textContent = "";
    try {
      // Include every article word, since close matches may extend past the top ten.
      const results = this.vectors.info
        ? await this.vectors.search(guess, this.vectors.info.wordCount)
        : [];
      if (revision !== this.revision) return;
      const nearMatches = this.showHints(results, guess);
      this.showRecentGuess(guess, matchCount, nearMatches);
      this.guesses.set(guess, canSearch);
      this.updateProgress();
      this.input.value = "";
    } catch (error) {
      if (revision !== this.revision || error.name === "AbortError") return;
      if (revealed > 0) {
        this.showHints([], guess);
        this.showRecentGuess(guess, matchCount);
        this.guesses.set(guess, false);
        this.updateProgress();
        this.input.value = "";
      }
      this.feedback.textContent = revealed > 0
        ? "Lähisanojen haku epäonnistui."
        : "Lähisanojen haku epäonnistui. Yritä arvausta uudelleen.";
    } finally {
      if (revision === this.revision) {
        this.setBusy(false);
        this.input.focus();
      }
    }
  }
}
