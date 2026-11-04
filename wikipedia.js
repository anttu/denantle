const form = document.getElementById("article-form");
const input = document.getElementById("article-name");
const button = document.getElementById("load-article");
const status = document.getElementById("status");
const errorMessage = document.getElementById("error");
const article = document.getElementById("article");
const articleTitle = document.getElementById("article-title");
const articleBody = document.getElementById("article-body");
const articleSource = document.getElementById("article-source");

async function loadArticle() {
  if (button.disabled) return;

  const title = input.value.trim();
  if (!title) {
    errorMessage.textContent = "Anna artikkelin nimi englanniksi.";
    return;
  }

  input.disabled = true;
  button.disabled = true;
  article.hidden = true;
  article.setAttribute("aria-busy", "true");
  errorMessage.textContent = "";
  status.textContent = "Haetaan artikkelia…";

  try {
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      titles: title,
      explaintext: "1",
      exsectionformat: "plain",
      redirects: "1",
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const response = await fetch(`https://simple.wikipedia.org/w/api.php?${params}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw new Error(`Artikkelin haku epäonnistui (HTTP ${response.status}). Yritä uudelleen.`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error("Wikipedia ei voinut käsitellä hakua. Yritä uudelleen.");
    }

    const page = data.query?.pages?.[0];
    if (!page || page.missing) {
      throw new Error("Artikkelia ei löytynyt. Tarkista englanninkielinen nimi.");
    }
    if (typeof page.extract !== "string" || !page.extract.trim()) {
      throw new Error("Artikkelissa ei ole näytettävää leipätekstiä.");
    }

    articleTitle.textContent = page.title;
    articleBody.textContent = page.extract;
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
    input.disabled = false;
    button.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadArticle();
});

void loadArticle();
