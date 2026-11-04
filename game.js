// Cosine similarity between the model's normalized word vectors.
const SIMILARITY_THRESHOLD = 0.6;
const DETAIL_SIMILARITY_THRESHOLD = 0.5;

function normalizeGuess(text) {
  return text.normalize("NFKC").replaceAll("’", "'").toLowerCase();
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
    this.revision += 1;
    this.words = new Map();
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

  start(title, body) {
    this.reset();
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

  showRecentGuess(guess) {
    this.recentGuesses = [
      guess,
      ...this.recentGuesses.filter((word) => word !== guess),
    ].slice(0, 10);
    const list = document.createElement("ol");
    for (const word of this.recentGuesses) {
      const chip = document.createElement("li");
      chip.className = "proximity-chip";
      chip.textContent = word;
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
      if (entry.revealed || score < SIMILARITY_THRESHOLD || score <= entry.score) continue;
      entry.score = score;
      entry.guess = guess;
      for (const { node } of entry.occurrences) {
        node.textContent = guess;
        node.style.color = proximityColor(score);
      }
      count += entry.occurrences.length;
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
    if (!/^\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*$/u.test(guess)) {
      this.feedback.textContent = "Syötä yksi sana englanniksi.";
      return;
    }
    if (this.guesses.has(guess) && !this.vectors.info) {
      this.showHints([], guess);
      this.showRecentGuess(guess);
      this.feedback.textContent = `Olet jo arvannut sanan ”${guess}”.`;
      return;
    }
    const exact = this.words.get(guess);
    if (!exact && !this.vectors.info) {
      this.feedback.textContent = "Lähisanojen haku ei ole vielä käytettävissä. Voit arvata tarkkoja sanoja jo nyt.";
      return;
    }

    const revision = this.revision;
    const revealed = exact && !exact.revealed ? this.reveal(exact) : 0;
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
      this.showHints(results, guess);
      this.showRecentGuess(guess);
      this.guesses.set(guess, canSearch);
      this.updateProgress();
      this.input.value = "";
    } catch (error) {
      if (revision !== this.revision || error.name === "AbortError") return;
      if (revealed > 0) {
        this.showHints([], guess);
        this.showRecentGuess(guess);
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
