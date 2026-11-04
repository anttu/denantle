# Wikipedia reader

A static page that fetches a Simple English Wikipedia article and displays its
title and body text. Word embeddings are computed locally in the browser. No
application server, API key, package installation, or build step is required.

Keep `index.html`, `wikipedia.js`, `categories.js`, `embeddings.js`,
`embedding-worker.js`, and `favicon.ico` in the same directory, with the icon PNGs
in `images/`. Run `./start-local.sh` and open `http://localhost:8000` in a current
browser, or upload these files and the icon PNGs to a static web host.
`images/denantle-icon.png` is the transparent face icon displayed beside the page
heading; the smaller PNGs and `favicon.ico` provide browser and touch icons.
The embedding worker requires HTTP(S); opening `index.html` directly
still displays articles but cannot create word vectors. An internet connection
is required to fetch articles and initially download the embedding runtime and model.

The page automatically loads a random Simple English Wikipedia article. Click
**Satunnainen artikkeli** to choose another one. Redirects are followed, and
missing articles and connection failures are shown on the page.

Articles are chosen from the groups listed in
`categories.js`, including their subcategories. The search starts from Everyday
life, Geography, History, Knowledge, Language, Literature, Religion, and Science;
the People category is skipped. Category branches and articles are chosen at
random, so articles do not all have the same probability of being selected.

Content comes from the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
at `https://simple.wikipedia.org/w/api.php`, using `prop=extracts` and
`explaintext=1`. The page requests the full text extract, including sections
after the introduction. Gallery, References, Other websites, Related pages, and
Bibliography sections and their subsections are removed from the displayed text.
Images, tables, and other content excluded by
[TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts) are not displayed.
Text is rendered as text, preserving line breaks without inserting remote HTML.

Each article includes a link to the original Simple English Wikipedia page and its
[CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/).

After an article is displayed, a Web Worker builds an in-memory vector database
from the words in its title and displayed body. It uses
[Transformers.js 3.8.1](https://huggingface.co/docs/transformers.js/v3.8.1/index)
and the 8-bit quantized [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
model (approximately 23 MB of weights). Inference runs on the CPU through
WebAssembly and does not require WebGPU. The model files are downloaded from
Hugging Face and the runtime from jsDelivr, with the browser cache reused when
available. Article text and search terms are processed locally.

Each distinct word has one normalized, 384-dimensional vector and an occurrence
count. Case, Unicode compatibility forms, and curly apostrophes are normalized;
punctuation and numbers are excluded, and internal apostrophes and hyphens are
preserved. Words are processed in batches of 32. The page shows progress, stays
readable while indexing, and lets you choose another article. Choosing another
article clears the previous index and cancels its remaining work; vectors are
not persisted across page reloads. A model failure leaves the article readable.

The `articleVectors` object provides a search API, also usable in the browser's
developer console after the ready message appears:

```js
articleVectors.info; // { title, wordCount, dimensions, model }, or null before ready
await articleVectors.search("water", 5); // [{ word, count, score }, ...]
```

Search embeds the query with the same model and returns article words ranked by
cosine similarity (highest first). This provides semantic similarity for words;
it does not use their surrounding sentence as context.
