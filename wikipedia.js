const randomButton = document.getElementById("random-article");
const sourceSelect = document.getElementById("wikipedia-source");
const guessHint = document.getElementById("guess-hint");
const status = document.getElementById("status");
const errorMessage = document.getElementById("error");
const article = document.getElementById("article");
const articleSource = document.getElementById("article-source");
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

async function loadRandomArticle() {
  if (randomButton.disabled) return;

  const source = wikipediaSources[sourceSelect.value];
  randomButton.disabled = true;
  sourceSelect.disabled = true;
  guessHint.textContent = source.language === "fi"
    ? "Arvaa peitetyn artikkelin sanoja suomeksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä."
    : "Arvaa peitetyn artikkelin sanoja englanniksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä.";
  document.getElementById("guess-input").lang = source.language;
  articleGame.reset();
  articleVectors.clear();
  vectorStatus.textContent = "";
  article.hidden = true;
  article.setAttribute("aria-busy", "true");
  errorMessage.textContent = "";
  status.textContent = "Haetaan satunnaista artikkelia…";

  try {
    const signal = AbortSignal.timeout(15000);
    const title = await getRandomArticleTitle(source, signal);

    const data = await queryWikipedia(source, {
      prop: "extracts",
      titles: title,
      explaintext: "1",
      exsectionformat: "wiki",
      redirects: "1",
    }, signal);

    const page = data.query?.pages?.[0];
    if (!page || page.missing) {
      throw new Error("Artikkelia ei löytynyt. Kokeile uutta satunnaista artikkelia.");
    }
    const body = typeof page.extract === "string" ? removeUnwantedSections(page.extract, source) : "";
    if (!body) {
      throw new Error("Artikkelissa ei ole näytettävää leipätekstiä.");
    }

    articleGame.start(page.title, body, source.language);
    article.lang = source.language;
    articleSource.textContent = source.name;
    articleSource.href = `${source.baseUrl}/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
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
  void loadRandomArticle();
});

sourceSelect.addEventListener("change", () => {
  void loadRandomArticle();
});

void loadRandomArticle();
