const randomButton = document.getElementById("random-article");
const status = document.getElementById("status");
const errorMessage = document.getElementById("error");
const article = document.getElementById("article");
const articleTitle = document.getElementById("article-title");
const articleBody = document.getElementById("article-body");
const articleSource = document.getElementById("article-source");

function removeUnwantedSections(text) {
  const excludedSections = new Set(["gallery", "references", "other websites"]);
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

async function queryWikipedia(parameters, signal) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    ...parameters,
  });
  const response = await fetch(`https://simple.wikipedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) {
    throw new Error(`Artikkelin haku epäonnistui (HTTP ${response.status}). Yritä uudelleen.`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error("Wikipedia ei voinut käsitellä hakua. Yritä uudelleen.");
  }
  return data;
}

async function getRandomArticleTitle(signal) {
  const candidates = categories.map((name) => ({ ns: 14, title: `Category:${name}` }));
  const visited = new Set();

  while (candidates.length > 0) {
    const index = Math.floor(Math.random() * candidates.length);
    const [candidate] = candidates.splice(index, 1);
    if (candidate.ns === 0) return candidate.title;
    if (visited.has(candidate.title)) continue;
    visited.add(candidate.title);

    let continuation;
    do {
      const data = await queryWikipedia({
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
          && member.title !== "Category:People" && !visited.has(member.title))) {
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

  randomButton.disabled = true;
  article.hidden = true;
  article.setAttribute("aria-busy", "true");
  errorMessage.textContent = "";
  status.textContent = "Haetaan satunnaista artikkelia…";

  try {
    const signal = AbortSignal.timeout(15000);
    const title = await getRandomArticleTitle(signal);

    const data = await queryWikipedia({
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
    const body = typeof page.extract === "string" ? removeUnwantedSections(page.extract) : "";
    if (!body) {
      throw new Error("Artikkelissa ei ole näytettävää leipätekstiä.");
    }

    articleTitle.textContent = page.title;
    articleBody.textContent = body;
    articleSource.href = `https://simple.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
    document.title = `${page.title} | Wikipedia-lukija`;
    article.hidden = false;
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
  }
}

randomButton.addEventListener("click", () => {
  void loadRandomArticle();
});

void loadRandomArticle();
