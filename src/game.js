// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { i18n } from "./i18n.js";

// Cosine similarity between the model's normalized word vectors.
const SIMILARITY_THRESHOLD = 0.6;
const DETAIL_SIMILARITY_THRESHOLD = 0.5;
export const GUESS_PATTERN = /^\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*$/u;

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

// Game data contains no DOM nodes. Each transition returns a new state.
function gameTextTokens(text) {
  const tokens = [];
  let offset = 0;
  for (const match of text.matchAll(/\p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*/gu)) {
    tokens.push({ text: text.slice(offset, match.index), word: null });
    tokens.push({ text: match[0], word: normalizeGuess(match[0]) });
    offset = match.index + match[0].length;
  }
  return [...tokens, { text: text.slice(offset), word: null }];
}

function createGameState(title = "", body = "", language = "en") {
  const titleTokens = gameTextTokens(title);
  const words = new Map();
  for (const { word } of [...titleTokens, ...gameTextTokens(body)]) {
    if (word === null) continue;
    const previous = words.get(word);
    words.set(word, { count: (previous?.count || 0) + 1,
      revealed: false, score: -1, guess: null, latestScore: null });
  }
  return {
    language, words, titleWords: new Set(titleTokens.filter(({ word }) => word !== null).map(({ word }) => word)),
    titleSolved: false, latestGuess: null, recentGuesses: [], guesses: new Map(),
    total: [...words.values()].reduce((count, entry) => count + entry.count, 0),
    revealed: 0, active: false, busy: false, inflectionsLoading: false,
  };
}

function revealGameWords(state, forms) {
  const words = new Map(state.words);
  let matchCount = 0;
  let revealedCount = 0;
  for (const word of forms) {
    const entry = words.get(word);
    if (!entry) continue;
    matchCount += entry.count;
    if (entry.revealed) continue;
    revealedCount += entry.count;
    words.set(word, { ...entry, revealed: true });
  }
  return { state: { ...state, words, revealed: state.revealed + revealedCount }, matchCount, revealedCount };
}

function applyGameHints(state, results, guess) {
  const words = new Map([...state.words].map(([word, entry]) => [word, { ...entry, latestScore: null }]));
  let nearMatches = 0;
  for (const { word, score } of results) {
    const entry = words.get(word);
    if (!entry) continue;
    const close = !entry.revealed && score >= SIMILARITY_THRESHOLD;
    if (close) nearMatches += entry.count;
    words.set(word, { ...entry, latestScore: score,
      ...(close && score > entry.score ? { score, guess } : {}) });
  }
  return { state: { ...state, words, latestGuess: guess }, nearMatches };
}

function recentGameGuesses(recent, guess, matches, nearMatches) {
  return [{ word: guess, matches, nearMatches }, ...recent.filter(({ word }) => word !== guess)].slice(0, 10);
}

function exportGameState(state) {
  return {
    guesses: [...state.guesses], recent: state.recentGuesses.map((item) => ({ ...item })), latestGuess: state.latestGuess,
    words: [...state.words].map(([word, { revealed, score, guess, latestScore }]) => ({ word, revealed, score, guess, latestScore })),
  };
}

function validateSharedGameState(shared, words) {
  const validWord = (word) => typeof word === "string" && word.length <= 200 && GUESS_PATTERN.test(word);
  const validScore = (score) => Number.isFinite(score) && score >= -1 && score <= 1;
  if (!shared || !Array.isArray(shared.guesses) || shared.guesses.length > 10000
    || !shared.guesses.every((item) => Array.isArray(item) && validWord(item[0]) && typeof item[1] === "boolean")
    || !Array.isArray(shared.recent) || shared.recent.length > 10
    || !shared.recent.every((item) => item && validWord(item.word)
      && Number.isSafeInteger(item.matches) && item.matches >= 0
      && Number.isSafeInteger(item.nearMatches) && item.nearMatches >= 0)
    || !(shared.latestGuess === null || validWord(shared.latestGuess))
    || !Array.isArray(shared.words) || shared.words.length !== words.size
    || new Set(shared.words.map((item) => item?.word)).size !== words.size
    || !shared.words.every((item) => item && words.has(item.word)
      && typeof item.revealed === "boolean" && validScore(item.score)
      && (item.latestScore === null || validScore(item.latestScore))
      && (item.guess === null || validWord(item.guess)))) {
    throw i18n.error("error.sharedState");
  }
}

function mergeSharedGameState(state, shared) {
  validateSharedGameState(shared, state.words);
  const words = new Map(shared.words.map(({ word, revealed, score, guess, latestScore }) => {
    const previous = state.words.get(word);
    return [word, { ...previous, revealed: previous.revealed || revealed, score, guess, latestScore }];
  }));
  return { ...state, words, guesses: new Map(shared.guesses),
    recentGuesses: shared.recent.map((item) => ({ ...item })), latestGuess: shared.latestGuess,
    revealed: [...words.values()].reduce((count, entry) => count + (entry.revealed ? entry.count : 0), 0) };
}

export function createArticleGame(vectors, inflections = null) {
  const elements = {
    inflectionStatus: document.getElementById("inflection-status"),
    title: document.getElementById("article-title"),
    body: document.getElementById("article-body"),
    form: document.getElementById("guess-form"),
    input: document.getElementById("guess-input"),
    button: document.getElementById("guess-submit"),
    feedback: document.getElementById("guess-feedback"),
    progress: document.getElementById("game-progress"),
    completion: document.getElementById("game-completion"),
    celebration: document.getElementById("title-celebration"),
    recent: document.getElementById("recent-guesses"),
    tooltip: document.getElementById("word-tooltip"),
    article: document.getElementById("article"),
  };
  let state = createGameState();
  let revision = 0;
  let nodeDetails = new WeakMap();
  let wordOccurrences = new Map();
  let tooltipTarget = null;
  let pinnedWord = null;
  let fireworks = null;
  let fireworksTimeout;
  let onGuessRequest = null;

  function reset() {
    hideTooltip();
    clearFireworks();
    revision += 1;
    inflections?.clear();
    state = createGameState("", "", state.language);
    nodeDetails = new WeakMap();
    wordOccurrences = new Map();
    i18n.text(elements.inflectionStatus, "");
    elements.celebration.hidden = true;
    i18n.text(elements.celebration, "");
    elements.form.hidden = true;
    setBusy(false);
    elements.input.disabled = true;
    elements.button.disabled = true;
    elements.input.value = "";
    i18n.text(elements.feedback, "");
    i18n.text(elements.progress, "");
    elements.completion.hidden = true;
    elements.completion.value = 0;
    elements.recent.replaceChildren();
    elements.recent.hidden = true;
    elements.title.replaceChildren();
    elements.body.replaceChildren();
  }

  function start(title, body, language = "en") {
    reset();
    state = { ...createGameState(title, body, language), active: true };
    render(elements.title, title);
    render(elements.body, body);
    elements.form.hidden = false;
    setBusy(false);
    updateProgress();
    if (language === "fi" && inflections) void buildFinnishInflections();
  }

  async function buildFinnishInflections() {
    const requestedRevision = revision;
    state = { ...state, inflectionsLoading: true };
    i18n.text(elements.inflectionStatus, i18n.message("inflections.loading"));
    try {
      await inflections.build([...state.words.keys()]);
      if (requestedRevision !== revision) return;
      i18n.text(elements.inflectionStatus, i18n.message("inflections.ready"));
    } catch (error) {
      if (requestedRevision !== revision || error.name === "AbortError") return;
      i18n.text(elements.inflectionStatus, i18n.message("inflections.unavailable"));
    } finally {
      if (requestedRevision === revision) state = { ...state, inflectionsLoading: false };
    }
  }

  function render(element, text) {
    const fragment = document.createDocumentFragment();
    for (const { text: original, word } of gameTextTokens(text)) {
      if (word === null) {
        fragment.append(document.createTextNode(original));
        continue;
      }
      const node = document.createElement("span");
      node.className = "redacted";
      node.lang = i18n.language;
      node.style.setProperty("--word-length", [...original].length);
      node.setAttribute("role", "button");
      node.tabIndex = 0;
      const occurrence = { node, original, word };
      if (!wordOccurrences.has(word)) wordOccurrences.set(word, []);
      wordOccurrences.get(word).push(occurrence);
      nodeDetails.set(node, occurrence);
      node.setAttribute("aria-label", wordDetails(node));
      fragment.append(node);
    }
    element.replaceChildren(fragment);
  }

  function bindWordDetails() {
    const wordAt = (event) => event.target.closest?.(".redacted");
    elements.article.addEventListener("pointerover", (event) => {
      const node = wordAt(event);
      if (node && !pinnedWord) showTooltip(node);
    });
    elements.article.addEventListener("focusin", (event) => {
      const node = wordAt(event);
      if (node) {
        if (pinnedWord !== node) pinnedWord = null;
        showTooltip(node);
      }
    });
    for (const type of ["pointerout", "focusout"]) {
      elements.article.addEventListener(type, (event) => {
        const node = wordAt(event);
        if (node && !node.contains(event.relatedTarget) && !pinnedWord) hideTooltip();
      });
    }
    elements.article.addEventListener("click", (event) => {
      const node = wordAt(event);
      if (node) toggleTooltip(node);
    });
    elements.article.addEventListener("keydown", (event) => {
      const node = wordAt(event);
      if (node && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        toggleTooltip(node);
      }
    });
    document.addEventListener("click", (event) => {
      if (!wordAt(event)) hideTooltip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    });
    window.addEventListener("resize", () => hideTooltip());
    window.addEventListener("scroll", () => hideTooltip(), { passive: true });
  }

  function wordDetails(node) {
    const { original, word } = nodeDetails.get(node);
    const entry = state.words.get(word);
    const lines = [i18n.t("word.length", { length: [...original].length })];
    if (entry.guess && entry.score >= DETAIL_SIMILARITY_THRESHOLD) {
      lines.push(i18n.t("word.hint", { guess: entry.guess, score: Math.round(entry.score * 100) }));
    }
    if (state.latestGuess && state.latestGuess !== entry.guess && entry.latestScore >= DETAIL_SIMILARITY_THRESHOLD) {
      lines.push(i18n.t("word.latest", { guess: state.latestGuess, score: Math.round(entry.latestScore * 100) }));
    } else if (!state.latestGuess && !entry.guess) {
      lines.push(i18n.t("word.noGuess"));
    }
    return lines.join("\n");
  }

  function showTooltip(node) {
    tooltipTarget?.removeAttribute("aria-describedby");
    tooltipTarget = node;
    node.setAttribute("aria-describedby", "word-tooltip");
    i18n.text(elements.tooltip, wordDetails(node));
    elements.tooltip.hidden = false;
    const word = node.getBoundingClientRect();
    const tooltip = elements.tooltip.getBoundingClientRect();
    elements.tooltip.style.left = `${Math.max(8, Math.min(word.left, window.innerWidth - tooltip.width - 8))}px`;
    const top = word.top - tooltip.height - 8;
    elements.tooltip.style.top = `${Math.max(8, Math.min(top >= 8 ? top : word.bottom + 8, window.innerHeight - tooltip.height - 8))}px`;
  }

  function toggleTooltip(node) {
    if (pinnedWord === node) hideTooltip();
    else {
      pinnedWord = node;
      showTooltip(node);
    }
  }

  function hideTooltip() {
    tooltipTarget?.removeAttribute("aria-describedby");
    tooltipTarget = null;
    pinnedWord = null;
    elements.tooltip.hidden = true;
  }

  function showRecentGuess(guess, matches, nearMatches = 0) {
    state = { ...state, recentGuesses: recentGameGuesses(state.recentGuesses, guess, matches, nearMatches) };
    renderRecentGuesses();
  }

  function renderRecentGuesses() {
    const list = document.createElement("ol");
    for (const { word, matches, nearMatches } of state.recentGuesses) {
      const chip = document.createElement("li");
      chip.className = "proximity-chip";
      const count = matches || nearMatches;
      chip.dataset.proximity = matches > 0 ? "exact" : nearMatches > 0 ? "near" : "cold";
      const proximity = i18n.t(matches > 0 ? "proximity.exact" : nearMatches > 0 ? "proximity.near" : "proximity.cold").toLocaleLowerCase(i18n.language);
      chip.textContent = `${word} · ${count}`;
      chip.setAttribute("aria-label", `${word} · ${count} · ${proximity}`);
      list.append(chip);
    }
    elements.recent.replaceChildren(document.createTextNode(i18n.t("guess.recent")), list);
    elements.recent.hidden = false;
  }

  function exportSharedState() {
    return exportGameState(state);
  }

  function applySharedState(shared) {
    state = mergeSharedGameState(state, shared);
    renderWords();
    renderRecentGuesses();
    elements.recent.hidden = state.recentGuesses.length === 0;
    updateProgress();
    checkTitleCompletion();
    if (tooltipTarget) showTooltip(tooltipTarget);
  }

  function setBusy(busy) {
    state = { ...state, busy };
    elements.input.disabled = busy;
    elements.button.disabled = busy;
    elements.form.setAttribute("aria-busy", String(busy));
  }

  function updateProgress() {
    const guesses = document.createElement("span");
    const guessCount = document.createElement("strong");
    guessCount.textContent = String(state.guesses.size);
    guesses.append(guessCount, document.createTextNode(state.guesses.size === 1 ? i18n.t("guess.singular") : i18n.t("guess.plural")));
    const words = document.createElement("span");
    const revealedCount = document.createElement("strong");
    revealedCount.textContent = String(state.revealed);
    words.append(revealedCount, document.createTextNode(i18n.t("game.wordCount", { total: state.total })));
    elements.progress.replaceChildren(guesses, words);
    elements.completion.max = state.total || 1;
    elements.completion.value = state.revealed;
    elements.completion.hidden = false;
  }

  function checkTitleCompletion() {
    if (state.titleSolved || state.titleWords.size === 0
      || ![...state.titleWords].every((word) => state.words.get(word).revealed)) return;
    state = { ...state, titleSolved: true };
    elements.celebration.hidden = false;
    i18n.text(elements.celebration, i18n.message("game.solved"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    fireworks = document.createElement("div");
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
    fireworksTimeout = window.setTimeout(() => clearFireworks(), 3200);
  }

  function clearFireworks() {
    window.clearTimeout(fireworksTimeout);
    fireworks?.remove();
    fireworks = null;
  }

  function renderWords() {
    for (const [word, entry] of state.words) {
      for (const { node, original } of wordOccurrences.get(word) || []) {
        if (entry.revealed) {
          if (tooltipTarget === node) hideTooltip();
          node.className = "revealed";
          node.textContent = original;
          for (const attribute of ["style", "role", "tabindex", "aria-label", "title", "lang"]) node.removeAttribute(attribute);
        } else {
          node.lang = i18n.language;
          node.textContent = entry.guess || "";
          node.style.color = entry.guess ? proximityColor(entry.score) : "";
          node.setAttribute("aria-label", wordDetails(node));
        }
      }
    }
  }

  function showHints(results, guess) {
    const update = applyGameHints(state, results, guess);
    state = update.state;
    renderWords();
    if (tooltipTarget) showTooltip(tooltipTarget);
    return update.nearMatches;
  }

  async function submitGuess(value = elements.input.value, { shared = false, focus = true, clearInput = true } = {}) {
    if (!state.active || state.busy) return false;
    const guess = normalizeGuess(value.trim());
    if (guess.length > 200 || !GUESS_PATTERN.test(guess)) {
      i18n.text(elements.feedback, state.language === "fi"
        ? i18n.message("guess.invalidFinnish")
        : i18n.message("guess.invalidEnglish"));
      return false;
    }
    if (!shared && onGuessRequest) return onGuessRequest(guess);
    const forms = state.language === "fi" && inflections
      ? inflections.matchingForms(guess)
      : guessForms(guess, state.language);
    const matches = [...forms].map((form) => state.words.get(form)).filter(Boolean);
    const matchCount = matches.reduce((count, entry) => count + entry.count, 0);
    if (state.guesses.has(guess) && !vectors.info && matches.every((entry) => entry.revealed)) {
      showHints([], guess);
      showRecentGuess(guess, matchCount);
      i18n.text(elements.feedback, i18n.message("guess.duplicate", { guess }));
      return;
    }
    if (matches.length === 0 && !vectors.info) {
      i18n.text(elements.feedback, state.inflectionsLoading
        ? i18n.message("guess.inflectionsPending")
        : i18n.message("guess.hintsPending"));
      return;
    }

    const requestedRevision = revision;
    const update = revealGameWords(state, forms);
    state = update.state;
    const revealed = update.revealedCount;
    renderWords();
    checkTitleCompletion();
    const canSearch = Boolean(vectors.info);
    setBusy(true);
    updateProgress();
    i18n.text(elements.feedback, "");
    try {
      // Include every article word, since close matches may extend past the top ten.
      const results = vectors.info
        ? await vectors.search(guess, vectors.info.wordCount)
        : [];
      if (requestedRevision !== revision) return;
      const nearMatches = showHints(results, guess);
      showRecentGuess(guess, matchCount, nearMatches);
      state = { ...state, guesses: new Map([...state.guesses, [guess, canSearch]]) };
      updateProgress();
      if (clearInput) elements.input.value = "";
      return true;
    } catch (error) {
      if (requestedRevision !== revision || error.name === "AbortError") return;
      if (revealed > 0) {
        showHints([], guess);
        showRecentGuess(guess, matchCount);
        state = { ...state, guesses: new Map([...state.guesses, [guess, false]]) };
        updateProgress();
        if (clearInput) elements.input.value = "";
      }
      i18n.text(elements.feedback, revealed > 0
        ? i18n.message("guess.hintsFailed")
        : i18n.message("guess.retry"));
      return revealed > 0;
    } finally {
      if (requestedRevision === revision) {
        setBusy(false);
        if (focus) elements.input.focus();
      }
    }
  }
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitGuess();
  });
  document.addEventListener("denantle:languagechange", () => {
    if (!state.active) return;
    updateProgress();
    renderWords();
    renderRecentGuesses();
    elements.recent.hidden = state.recentGuesses.length === 0;
    if (tooltipTarget) showTooltip(tooltipTarget);
  });
  bindWordDetails();
  reset();

  return {
    start, reset, setBusy, submitGuess, exportSharedState, applySharedState,
    get active() { return state.active; },
    get busy() { return state.busy; },
    get input() { return elements.input; },
    get feedback() { return elements.feedback; },
    set onGuessRequest(handler) { onGuessRequest = handler; },
  };
}
