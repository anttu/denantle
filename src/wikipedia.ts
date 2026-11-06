// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Article, Language, WikipediaSource } from "./contracts.js";
import { errorName, isArray, isRecord } from "./validation.js";

import { elementById } from "./dom.js";
import { i18n } from "./i18n.js";
import { wikipediaSources, isSourceKey } from "./categories.js";
import { articleVectors } from "./embeddings.js";
import { finnishInflections } from "./finnish-inflections.js";
import { createArticleGame } from "./game.js";
import { createMultiplayerGame } from "./multiplayer.js";

const randomButton = elementById("random-article", HTMLButtonElement);
const sourceSelect = elementById("wikipedia-source", HTMLSelectElement);
const guessHint = elementById("guess-hint", HTMLElement);
const status = elementById("status", HTMLElement);
const errorMessage = elementById("error", HTMLElement);
const article = elementById("article", HTMLElement);
const articleSource = elementById("article-source", HTMLElement);
const gameVersion = elementById("game-version", HTMLElement);
const gameVersionLink = elementById("game-version-link", HTMLAnchorElement);
const vectorStatus = elementById("vector-status", HTMLElement);
const articleGame = createArticleGame(articleVectors, finnishInflections);
let currentArticle: Article | null = null;
let articleLoading = false;
let loadRevision = 0;
let loadController: AbortController | null = null;
const multiplayer = createMultiplayerGame(articleGame, {
  getArticle: () => currentArticle,
  showArticle: (data) => {
    if (!isRecord(data) || typeof data.title !== "string" || !data.title || data.title.length > 1000
      || typeof data.body !== "string" || !data.body || data.body.length > 2000000
      || typeof data.session !== "string" || data.session.length > 100
      || typeof data.version !== "string" || !/^(simple|fi|en)-[1-9]\d*$/.test(data.version)
      || data.version.split("-")[0] !== data.sourceKey || !isSourceKey(data.sourceKey)) {
      throw i18n.error("error.articleData");
    }
    cancelArticleLoading();
    articleVectors.clear();
    i18n.text(vectorStatus, i18n.message("vectors.shared"));
    displayArticle({ title: data.title, body: data.body, session: data.session, version: data.version, sourceKey: data.sourceKey });
  },
  cancelLoading: cancelArticleLoading,
  refreshControls: refreshArticleControls,
  resumeSolo: () => {
    if (currentArticle && articleGame.active) {
      void buildArticleVectors(currentArticle.title, currentArticle.body, wikipediaSources[currentArticle.sourceKey].language);
    } else void loadArticle(new URLSearchParams(window.location.search).get("game"));
  },
});

function refreshArticleControls() {
  randomButton.hidden = multiplayer.isGuest;
  randomButton.disabled = articleLoading || multiplayer.isGuest;
  sourceSelect.disabled = articleLoading || multiplayer.isGuest;
  gameVersionLink.setAttribute("aria-disabled", String(multiplayer.isGuest));
}

function cancelArticleLoading() {
  loadRevision += 1;
  loadController?.abort();
  loadController = null;
  articleLoading = false;
  i18n.text(status, "");
  article.setAttribute("aria-busy", "false");
  refreshArticleControls();
}

function displayArticle(data: Article) {
  const source = wikipediaSources[data.sourceKey];
  currentArticle = data;
  sourceSelect.value = data.sourceKey;
  updateGuessHint(source.language);
  articleGame.input.lang = source.language;
  articleGame.start(data.title, data.body, source.language);
  article.lang = source.language;
  i18n.text(articleSource, i18n.message(`source.${data.sourceKey}`));
  const replayUrl = new URL(window.location.href);
  replayUrl.hash = "";
  replayUrl.searchParams.set("game", data.version);
  window.history.replaceState(null, "", replayUrl);
  multiplayer.refreshInviteLink();
  gameVersionLink.textContent = data.version;
  gameVersionLink.href = replayUrl.href;
  gameVersion.hidden = false;
  article.hidden = false;
  i18n.text(errorMessage, "");
}

async function buildArticleVectors(title: string, body: string, language: Language) {
  const revision = loadRevision;
  try {
    const info = await articleVectors.build(title, body, (progress) => {
      if (revision !== loadRevision) return;
      i18n.text(vectorStatus, progress.stage === "model"
        ? i18n.message("vectors.loading")
        : i18n.message("vectors.progress", { completed: progress.completed, total: progress.total }));
    }, language);
    if (revision === loadRevision) i18n.text(vectorStatus, i18n.message("vectors.ready", { count: info.wordCount }));
  } catch (error) {
    if (revision === loadRevision && errorName(error) !== "AbortError") i18n.text(vectorStatus, i18n.errorMessage(error));
  }
}

function removeUnwantedSections(text: string, source: WikipediaSource) {
  const excludedSections = new Set(source.excludedSections);
  const lines = [];
  let skippedLevel: number | null = null;

  for (const line of text.split("\n")) {
    const heading = line.match(/^(={1,6})[ \t]*(.*?)[ \t]*\1[ \t]*$/);
    if (heading) {
      const level = heading[1].length;
      if (skippedLevel !== null && level <= skippedLevel) skippedLevel = null;
      if (skippedLevel === null && excludedSections.has(heading[2].trim().toLowerCase())) {
        skippedLevel = level;
      }
    }
    if (skippedLevel === null) lines.push(heading ? heading[2].trim() : line);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function articleTextFromHtml(html: string, source: WikipediaSource) {
  // A template keeps remote markup inert; only its plain text enters the game.
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll([
    "script", "style", "link", "meta", "table", "figure", "img", "audio", "video",
    "iframe", "object", "embed", "form", ".thumb", ".gallery", ".mw-editsection",
    ".reference", ".reflist", ".navbox", ".infobox", ".metadata", ".noprint",
    ".shortdescription", ".ambox", ".hatnote", ".sistersitebox", ".toc", ".mw-empty-elt",
  ].join(",")).forEach((node) => node.remove());

  function textFromNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
    if (/^H[1-6]$/.test(node.nodeName)) {
      const marker = "=".repeat(Number(node.nodeName[1]));
      return `\n\n${marker} ${(node.textContent || "").trim()} ${marker}\n\n`;
    }
    if (node.nodeName === "BR") return "\n";
    const text = [...node.childNodes].map(textFromNode).join("");
    return /^(P|DIV|SECTION|BLOCKQUOTE|UL|OL|LI|DL|DT|DD|PRE)$/.test(node.nodeName)
      ? `\n\n${text}\n\n` : text;
  }

  return removeUnwantedSections(textFromNode(template.content)
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n"), source);
}

async function queryWikipedia(source: WikipediaSource, parameters: Record<string, string>, signal: AbortSignal): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...parameters,
  });
  const response = await fetch(`${source.baseUrl}/w/api.php?${params}`, { signal });
  if (!response.ok) {
    throw i18n.error(i18n.message("error.http", { status: response.status }));
  }

  const data: unknown = await response.json();
  if (!isRecord(data)) throw i18n.error("error.wikipedia");
  if (isRecord(data.error)) {
    if (typeof data.error.code === "string" && ["missingrev", "nosuchrevid", "missingtitle"].includes(data.error.code)) {
      throw i18n.error("error.revision");
    }
    throw i18n.error("error.wikipedia");
  }
  return data;
}

async function getRandomArticleTitle(source: WikipediaSource, signal: AbortSignal) {
  const candidates = source.categories.map((title) => ({ ns: 14, title }));
  const visited = new Set();

  while (candidates.length > 0) {
    const index = Math.floor(Math.random() * candidates.length);
    const [candidate] = candidates.splice(index, 1);
    if (candidate.ns === 0) return candidate.title;
    if (visited.has(candidate.title)) continue;
    visited.add(candidate.title);

    let continuation: Record<string, string> | undefined;
    do {
      const data = await queryWikipedia(source, {
        list: "categorymembers",
        cmtitle: candidate.title,
        cmnamespace: "0|14",
        cmtype: "page|subcat",
        cmprop: "title|type",
        cmlimit: "max",
        ...continuation,
      }, signal);

      if (!isRecord(data.query) || !isArray(data.query.categorymembers)) throw i18n.error("error.wikipedia");
      for (const member of data.query.categorymembers) {
        if (!isRecord(member) || typeof member.ns !== "number" || typeof member.title !== "string") throw i18n.error("error.wikipedia");
        if (member.ns === 0 || (member.ns === 14
          && member.title !== source.excludedCategory && !visited.has(member.title))) {
          candidates.push({ ns: member.ns, title: member.title });
        }
      }
      continuation = undefined;
      if (data.continue !== undefined) {
        if (!isRecord(data.continue)) throw i18n.error("error.wikipedia");
        continuation = {};
        for (const [key, value] of Object.entries(data.continue)) {
          if (typeof value !== "string") throw i18n.error("error.wikipedia");
          continuation[key] = value;
        }
      }
    } while (continuation);
  }

  throw i18n.error("error.categories");
}

async function loadArticle(gameId: string | null = null, { invite = false } = {}) {
  if (articleLoading || multiplayer.isGuest) return;

  const revision = ++loadRevision;
  loadController?.abort();
  loadController = new AbortController();
  articleLoading = true;
  refreshArticleControls();
  currentArticle = null;
  articleGame.reset();
  multiplayer.shareGame();
  articleVectors.clear();
  i18n.text(vectorStatus, "");
  gameVersion.hidden = true;
  gameVersionLink.removeAttribute("href");
  gameVersionLink.textContent = "";
  article.hidden = true;
  article.setAttribute("aria-busy", "true");
  i18n.text(errorMessage, "");
  i18n.text(status, gameId === null ? i18n.message("article.loadingRandom") : i18n.message("article.loadingSaved"));

  try {
    const savedGame = gameId === null ? null : gameId.match(/^(simple|fi|en)-([1-9]\d*)$/);
    if (gameId !== null && (!savedGame || !Number.isSafeInteger(Number(savedGame[2])))) {
      throw i18n.error("error.gameId");
    }
    const sourceKey = savedGame ? savedGame[1] : sourceSelect.value;
    if (!isSourceKey(sourceKey)) throw i18n.error("error.gameId");
    const source = wikipediaSources[sourceKey];
    sourceSelect.value = sourceKey;
    const signal = AbortSignal.any([loadController.signal, AbortSignal.timeout(15000)]);
    const selection: Record<string, string> = savedGame
      ? { oldid: savedGame[2] }
      : { page: await getRandomArticleTitle(source, signal), redirects: "1" };
    const data = await queryWikipedia(source, {
      action: "parse",
      prop: "text|revid",
      disabletoc: "1",
      disableeditsection: "1",
      disablelimitreport: "1",
      ...selection,
    }, signal);
    if (revision !== loadRevision) return;

    const page = data.parse;
    if (!isRecord(page) || typeof page.title !== "string" || !page.title || typeof page.revid !== "number" || !Number.isSafeInteger(page.revid) || page.revid <= 0
      || (savedGame && page.revid !== Number(savedGame[2]))) {
      throw i18n.error("error.revision");
    }
    const body = typeof page.text === "string" ? articleTextFromHtml(page.text, source) : "";
    if (!body) {
      throw i18n.error("error.emptyArticle");
    }

    // getRandomValues also works on local-network HTTP origins.
    displayArticle({ title: page.title, body, sourceKey,
      version: `${sourceKey}-${page.revid}`, session: crypto.getRandomValues(new Uint32Array(4)).join("-") });
    multiplayer.shareGame();
    if (invite && multiplayer.enabled.checked && !multiplayer.connected && !multiplayer.peer && !multiplayer.negotiating) {
      void multiplayer.negotiate(true);
    }
    void buildArticleVectors(page.title, body, source.language);
  } catch (error) {
    if (revision !== loadRevision || errorName(error) === "AbortError") return;
    multiplayer.send({ type: "unavailable" });
    i18n.text(errorMessage, errorName(error) === "TimeoutError"
      ? i18n.message("error.timeout")
      : errorName(error) === "TypeError"
        ? i18n.message("error.network")
        : i18n.errorMessage(error) || i18n.message("error.article"));
  } finally {
    if (revision !== loadRevision) return;
    i18n.text(status, "");
    article.setAttribute("aria-busy", "false");
    articleLoading = false;
    refreshArticleControls();
  }
}

randomButton.addEventListener("click", () => {
  void loadArticle(null, { invite: true });
});

sourceSelect.addEventListener("change", () => {
  void loadArticle(null, { invite: true });
});

gameVersionLink.addEventListener("click", (event) => {
  if (multiplayer.isGuest) event.preventDefault();
});

if (!multiplayer.acceptInviteFromLocation()) {
  void loadArticle(new URLSearchParams(window.location.search).get("game"));
}

function updateGuessHint(language: Language = wikipediaSources[isSourceKey(sourceSelect.value) ? sourceSelect.value : "simple"].language) {
  i18n.text(guessHint, i18n.message(language === "fi" ? "help.guessFinnish" : "help.guessEnglish"));
}
document.addEventListener("denantle:languagechange", () => updateGuessHint());
