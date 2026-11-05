// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const randomButton = document.getElementById("random-article");
const sourceSelect = document.getElementById("wikipedia-source");
const guessHint = document.getElementById("guess-hint");
const status = document.getElementById("status");
const errorMessage = document.getElementById("error");
const article = document.getElementById("article");
const articleSource = document.getElementById("article-source");
const gameVersion = document.getElementById("game-version");
const gameVersionLink = document.getElementById("game-version-link");
const vectorStatus = document.getElementById("vector-status");
const articleGame = new ArticleGuessGame(articleVectors, finnishInflections);

async function buildArticleVectors(title, body, language) {
  try {
    const info = await articleVectors.build(title, body, (progress) => {
      vectorStatus.textContent = progress.stage === "model"
        ? "Valmistellaan sanavektorimallia… Ensimmäinen lataus voi kestää hetken."
        : `Luodaan sanavektoreita: ${progress.completed} / ${progress.total} sanaa…`;
    }, language);
    vectorStatus.textContent = `Sanavektorit valmiina: ${info.wordCount} eri sanaa.`;
  } catch (error) {
    if (error.name !== "AbortError") vectorStatus.textContent = error.message;
  }
}

function removeUnwantedSections(text, source) {
  const excludedSections = new Set(source.excludedSections);
  const lines = [];
  let skippedLevel = null;

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

function articleTextFromHtml(html, source) {
  // A template keeps remote markup inert; only its plain text enters the game.
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll([
    "script", "style", "link", "meta", "table", "figure", "img", "audio", "video",
    "iframe", "object", "embed", "form", ".thumb", ".gallery", ".mw-editsection",
    ".reference", ".reflist", ".navbox", ".infobox", ".metadata", ".noprint",
    ".shortdescription", ".ambox", ".hatnote", ".sistersitebox", ".toc", ".mw-empty-elt",
  ].join(",")).forEach((node) => node.remove());

  function textFromNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent.replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return "";
    if (/^H[1-6]$/.test(node.nodeName)) {
      const marker = "=".repeat(Number(node.nodeName[1]));
      return `\n\n${marker} ${node.textContent.trim()} ${marker}\n\n`;
    }
    if (node.nodeName === "BR") return "\n";
    const text = [...node.childNodes].map(textFromNode).join("");
    return /^(P|DIV|SECTION|BLOCKQUOTE|UL|OL|LI|DL|DT|DD|PRE)$/.test(node.nodeName)
      ? `\n\n${text}\n\n` : text;
  }

  return removeUnwantedSections(textFromNode(template.content)
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n"), source);
}

async function queryWikipedia(source, parameters, signal) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...parameters,
  });
  const response = await fetch(`${source.baseUrl}/w/api.php?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Artikkelin haku epäonnistui (HTTP ${response.status}). Yritä uudelleen.`);
  }

  const data = await response.json();
  if (data.error) {
    if (["missingrev", "nosuchrevid", "missingtitle"].includes(data.error.code)) {
      throw new Error("Artikkeliversiota ei löytynyt. Tarkista pelin linkki tai valitse uusi peli.");
    }
    throw new Error("Wikipedia ei voinut käsitellä hakua. Yritä uudelleen.");
  }
  return data;
}

async function getRandomArticleTitle(source, signal) {
  const candidates = source.categories.map((title) => ({ ns: 14, title }));
  const visited = new Set();

  while (candidates.length > 0) {
    const index = Math.floor(Math.random() * candidates.length);
    const [candidate] = candidates.splice(index, 1);
    if (candidate.ns === 0) return candidate.title;
    if (visited.has(candidate.title)) continue;
    visited.add(candidate.title);

    let continuation;
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

      for (const member of data.query.categorymembers) {
        if (member.ns === 0 || (member.ns === 14
          && member.title !== source.excludedCategory && !visited.has(member.title))) {
          candidates.push(member);
        }
      }
      continuation = data.continue;
    } while (continuation);
  }

  throw new Error("Valituista kategorioista ei löytynyt artikkeleita. Yritä uudelleen.");
}

async function loadArticle(gameId = null) {
  if (randomButton.disabled) return;

  randomButton.disabled = true;
  sourceSelect.disabled = true;
  articleGame.reset();
  articleVectors.clear();
  vectorStatus.textContent = "";
  gameVersion.hidden = true;
  gameVersionLink.removeAttribute("href");
  gameVersionLink.textContent = "";
  article.hidden = true;
  article.setAttribute("aria-busy", "true");
  errorMessage.textContent = "";
  status.textContent = gameId === null ? "Haetaan satunnaista artikkelia…" : "Haetaan tallennettua peliä…";

  try {
    const savedGame = gameId === null ? null : gameId.match(/^(simple|fi)-([1-9]\d*)$/);
    if (gameId !== null && (!savedGame || !Number.isSafeInteger(Number(savedGame[2])))) {
      throw new Error("Pelin tunniste ei kelpaa. Tarkista pelin linkki tai valitse uusi peli.");
    }
    const sourceKey = savedGame ? savedGame[1] : sourceSelect.value;
    const source = wikipediaSources[sourceKey];
    sourceSelect.value = sourceKey;
    guessHint.textContent = source.language === "fi"
      ? "Arvaa peitetyn artikkelin sanoja suomeksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä."
      : "Arvaa peitetyn artikkelin sanoja englanniksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä.";
    document.getElementById("guess-input").lang = source.language;
    const signal = AbortSignal.timeout(15000);
    const selection = savedGame
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

    const page = data.parse;
    if (!page || !page.title || !Number.isSafeInteger(page.revid) || page.revid <= 0
      || (savedGame && page.revid !== Number(savedGame[2]))) {
      throw new Error("Artikkeliversiota ei löytynyt. Tarkista pelin linkki tai valitse uusi peli.");
    }
    const body = typeof page.text === "string" ? articleTextFromHtml(page.text, source) : "";
    if (!body) {
      throw new Error("Artikkelissa ei ole näytettävää leipätekstiä.");
    }

    articleGame.start(page.title, body, source.language);
    article.lang = source.language;
    articleSource.textContent = source.name;
    articleSource.href = `${source.baseUrl}/w/index.php?oldid=${page.revid}`;
    const version = `${sourceKey}-${page.revid}`;
    const replayUrl = new URL(window.location.href);
    replayUrl.hash = "";
    replayUrl.searchParams.set("game", version);
    window.history.replaceState(null, "", replayUrl);
    gameVersionLink.textContent = version;
    gameVersionLink.href = replayUrl.href;
    gameVersion.hidden = false;
    article.hidden = false;
    void buildArticleVectors(page.title, body, source.language);
  } catch (error) {
    errorMessage.textContent = error.name === "TimeoutError"
      ? "Haku kesti liian kauan. Yritä uudelleen."
      : error.name === "TypeError"
        ? "Wikipediaan ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen."
        : error.message || "Artikkelin haku epäonnistui. Yritä uudelleen.";
  } finally {
    status.textContent = "";
    article.setAttribute("aria-busy", "false");
    randomButton.disabled = false;
    sourceSelect.disabled = false;
  }
}

randomButton.addEventListener("click", () => {
  void loadArticle();
});

sourceSelect.addEventListener("change", () => {
  void loadArticle();
});

void loadArticle(new URLSearchParams(window.location.search).get("game"));
