# Denantle

Copyright © 2026 Antero Fagerstedt. The original program is licensed under
**GNU GPL version 3 or later (GPL-3.0-or-later)**; see [LICENSE](LICENSE).
Commercial use, modification and redistribution are allowed under those terms.
The program is supplied without warranty. Original distributed artwork is
CC BY-SA 4.0; see [ARTWORK.md](ARTWORK.md). Third-party software, model weights
and Wikipedia text retain the licenses listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

A word guessing game that hides a Simple English, Finnish or English Wikipedia
article's title and body behind black bars. Word embeddings are computed locally
in the browser. No application server, API key, package installation, or build
step is required.

Keep `index.html` and `favicon.ico` in the repository root, with the application's
JavaScript source files in `src/`, the PNG assets in `images/` and the bundled
language libraries in `vendor/`. For development,
run `./start-local.sh` and open `http://localhost:8000` in a current browser.
For publication, follow the [publishing instructions](#publishing) below.
The page heading displays three separate images: the seven-bar mark
(`images/denantle-mark.png`), the Denantle wordmark
(`images/denantle-wordmark.png`) and the hand-drawn face
(`images/denantle-icon.png`). The smaller icon PNGs and `favicon.ico` provide
browser and touch icons.
The embedding worker requires HTTP(S); opening `index.html` directly
still displays articles but cannot create word vectors. An internet connection
is required to fetch articles and initially download the embedding runtime and model.

The page automatically loads a random Simple English Wikipedia article. Use
**Datalähde** to choose **Simple English Wikipedia**, **Suomenkielinen Wikipedia**
or **English Wikipedia**; changing the source starts a new game with an article
in that language. Click
**Uusi peli** to choose another article from the selected source.
Redirects are followed, and
missing articles and connection failures are shown on the page.

Each loaded game displays a **Pelin tunniste** link such as `fi-123456789`,
`simple-123456789` or `en-123456789`. The prefix identifies the Wikipedia edition;
the number identifies the article revision within that edition. The same ID is
stored in the page address as `?game=fi-123456789`. Bookmark or share the
address to reopen that revision with no guesses, or click the displayed ID
to play it again from the beginning. Reloading the page also restarts that
game. **Uusi peli** and changing the source choose a new random article and
update the link. Invalid IDs and unavailable revisions show an error instead
of silently choosing a different article.
The ID pins the stored article revision, not a complete game snapshot:
Wikipedia template updates, page renames and later changes to game rules or
models can still affect a replay.

The warm paper layout pairs a compact logo and controls with a serif heading and
article text. Guess and revealed-word counts sit above the input, with a progress
bar tracking revealed occurrences. The **?** button opens the playing instructions.

The optional **Moninpeli** checkbox opens a two-player cooperative mode. The
inviter creates an offer and shares an invitation URL. Opening the link enables
multiplayer and accepts the offer; the guest returns an answer for the inviter
to paste. Starting a new game with multiplayer enabled also creates an invitation.
Manual pasting of invitations and answers remains available.
`src/signaling-payload.js` stores invitations in the URL fragment, preserving the
current path and query. Its D2 binary profile reconstructs matching single-host
offers exactly; the D1 dictionary format preserves all other descriptions,
including browser-specific fields and multiple candidates. The codec has no
dependencies and does not require compression APIs. The receiving browser
removes the invitation fragment before starting the handshake. Invitations
remain tied to the inviter's open peer connection.
The optional **payload debug** checkbox reveals the decoded local and remote
JSON descriptions, including every SDP field restored by the codec. It is off by
default; hiding it or disconnecting clears the displayed payloads.
`src/multiplayer.js` uses the browser's native
`RTCPeerConnection` and an ordered, reliable data channel. Both descriptions wait
for ICE gathering to complete, so candidates travel in the copied text and no
signaling service is needed. There are no additional packages or application
servers. No external ICE services or relays are used; game data travels directly
between peers. Expect local-network or directly reachable peers; restrictive
networks may prevent a connection.
This follows the native [WebRTC offer/answer and ICE flow](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity).

The inviter's browser owns the shared article and processes guesses from both
players in order. The guest receives the exact article text and a snapshot of
reveals, hint scores, guess history and counts, including progress made before
joining. Only the inviter builds semantic vectors for the shared game. Messages
are bounded and split into small chunks with send-buffer backpressure to support
large articles. A new article has a fresh session ID, so delayed guesses from an
older board cannot affect it. Joining cancels any pending local article request;
only the inviter can select an article or change the language during a session.
Disabling multiplayer or losing the connection restores solo controls and local
semantic indexing while keeping the current board when available. Reloading a
page closes the connection; reconnection requires a fresh offer/answer exchange.

Enter one word in the article's language in **Arvaa sana** and press Enter or
**Arvaa**. A base-form guess reveals that word and its inflected forms, preserving the original spelling
and case: `dog` reveals `dogs`, `child` reveals `children`, and `run` reveals `ran`
and `running`. Noun possessives and adjective comparatives and superlatives are
also accepted, such as `dog` for `dog's` and `good` for `better` and `best`.
Exact spellings remain accepted. Derived words stay separate: `nation` does not
reveal `national`. English inflections are generated by the local, MIT-licensed
[Compromise 14.19.0](https://github.com/spencermountain/compromise) browser build in
`vendor/compromise-14.19.0.js`; its license is in `vendor/compromise-LICENSE.txt`.
Exact matching works while word vectors are loading or unavailable and does not
use a network service. Language rules can be ambiguous, so exact guesses remain
available for forms the library does not recognize.
For Finnish, a separate Web Worker uses [Voikko 1.0.1](https://www.npmjs.com/package/voikko)
with libvoikko 4.3.2 and its Finnish dictionary to index the base forms of article
words. `vesi` reveals `veden`, `vettä`, and `vedessä`; `juosta` reveals `juoksi`,
`juoksee`, and `juossut`; `koira` reveals possessive forms such as `koirallani`.
Participles are also linked to their underlying verb. Whole compound words and
derived words keep their own base forms: `kansa` does not reveal `kansallinen` or
`kansanmusiikki`. Ambiguous words may have several valid analyses.
The unchanged Voikko 1.0.1 browser build (approximately 6.8 MB, including the
dictionary) is bundled in `vendor/voikko-1.0.1.min.js` and loaded only when
Finnish is selected. It is conveyed under GPL-3.0-or-later. The complete
[corresponding source](source/voikko-corresponding-source.tar.gz), including
the matching Finnish dictionary source and npm build scripts, is bundled too.
All three dictionary files match the data embedded in the WebAssembly byte
for byte. See [the notices](THIRD_PARTY_NOTICES.md) for original licenses,
copyright holders, checksums and build instructions.
Analysis runs locally, separately from semantic hints, and does not
send article text or guesses to a service. Exact guesses work while the dictionary
loads or if it is unavailable. Once indexing finishes, repeating an early base-form
guess reveals its inflections without increasing the guess count. Changing the
article cancels the previous index; the worker reuses the loaded dictionary.
Matching ignores case, Unicode compatibility forms, and curly apostrophes.
Punctuation, numbers, spaces, and line breaks remain visible. The browser tab title
does not reveal the article title.

Revealing every word in the title shows a congratulations message and a short
fireworks animation, once per article. Semantic hints do not count as solved words.
The animation respects the browser's reduced-motion preference. You can continue
guessing body words afterwards; choosing another article clears the celebration.

Once word vectors are ready, guesses also provide semantic hints: a cosine
similarity of at least `0.6` displays the guessed word on the matching black bars.
Hint text changes continuously from blue (farther) to red (closer). Each word keeps
its closest guess so far; hints never replace revealed
words. The threshold is defined by `SIMILARITY_THRESHOLD` in `src/game.js`. Similarity
is a model score, not a probability that the guess is correct. Exact guesses work
while vectors are loading or if the model fails; retry an early exact guess after
indexing to use it for semantic hints too, without increasing the guess count.
The page tracks guesses and
revealed occurrences; choosing another article resets the game and cancels pending
searches. Game progress is not saved across page reloads.

Hover, click, or focus a black bar to see the original word's character count and
its proximity to the displayed hint and latest guess when the similarity is at
least `50 %`. Lower and unavailable scores are omitted from these details,
including screen-reader labels. Click again, click elsewhere, or press Escape to
close the details. Answers are not included in these details.
The ten most recent accepted guesses are also shown below the input, newest first.
Each guess shows its exact matching occurrence count, including inflected forms
and already revealed words. If there are no exact matches, it shows the number of
still-hidden occurrences with a similarity of at least `0.6`, including those that
already have a closer hint; if neither kind matches, it shows zero matches.
Only the word and number are displayed on a white background: black text for
exact matches, orange for near matches, and blue for cold guesses.
Repeating a guess moves it to the front and refreshes its counts and hints without
increasing the guess count. Choosing another article clears the history.

Articles are chosen from the groups listed in
`src/categories.js`, including their subcategories. Both English editions start from
Everyday life, Geography, History, Knowledge, Language, Literature, Religion, and Science;
the People category is skipped. The Finnish search starts from Maantiede, Historia,
Tieto, Kieli, Kirjallisuus, Uskonto, and Tiede; Henkilöt is skipped.
Category branches and articles are chosen at
random, so articles do not all have the same probability of being selected.

Content comes from the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
at `https://simple.wikipedia.org/w/api.php`, `https://fi.wikipedia.org/w/api.php`
or `https://en.wikipedia.org/w/api.php`,
depending on the selected source, using `action=parse` and `prop=text|revid`.
Random games resolve an article title and obtain its revision ID with its
content in the same response; replay links request that revision with `oldid`.
The returned HTML is processed in an inert template and converted to plain
text, including sections after the introduction. Gallery, References, Other
websites, Related pages, and
Bibliography sections and their subsections are removed from Simple English text.
For English Wikipedia, the removed sections are Gallery, References, Notes,
Footnotes, External links, See also, Further reading, and Bibliography, including
subsections. For Finnish text, the removed sections are Kuvia, Kuvagalleria, Galleria, Lähteet,
Viitteet, Aiheesta muualla, Katso myös, and Kirjallisuutta, including subsections.
Images, tables, navigation boxes, reference markers and other non-article
elements are removed before conversion.
Text is rendered as text, preserving line breaks without inserting remote HTML.

Each article names the selected Wikipedia without linking to the answer and includes its
[CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/).
It also identifies the shortening, hidden words and guess substitutions as
modifications. The adapted article text remains CC BY-SA 4.0.

After an article is displayed, a Web Worker builds an in-memory vector database
from the words in its title and displayed body. It uses
[Transformers.js 3.8.1](https://huggingface.co/docs/transformers.js/v3.8.1/index)
and an 8-bit quantized model: [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
for English (approximately 23 MB of weights), or
[onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX](https://huggingface.co/onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX)
for Finnish. Both model publications explicitly state Apache-2.0, and their
download revisions are pinned in `src/embedding-worker.js` and
`third-party-manifest.json`. Their model cards and license are in `licenses/`.
The multilingual model is larger and takes longer to download on first
use. Switching languages releases the previous model and cancels its pending work.
Inference runs on the CPU through
WebAssembly and does not require WebGPU. The model files are downloaded from
Hugging Face and the runtime from jsDelivr, with the browser cache reused when
available. Article text and search terms are processed locally.

Each distinct word has one normalized, 384-dimensional vector and an occurrence
count. For Finnish, both article and query vectors are centered on the model's
empty-input vector and normalized again before comparison. This removes the
shared background that otherwise makes unrelated single words look similar,
especially with broad guesses such as `olla`. The background is computed once
per Finnish worker and reused across articles. English uses the original model
vectors. Case, Unicode compatibility forms, and curly apostrophes are normalized;
punctuation and numbers are excluded, and internal apostrophes and hyphens are
preserved. Words are processed in batches of 32. The page shows progress, accepts
exact guesses while indexing, and lets you choose another article. Choosing another
article clears the previous index and cancels its remaining work; vectors are
not persisted across page reloads. A model failure still allows exact guesses.

The `articleVectors` object provides a search API, also usable in the browser's
developer console after the ready message appears:

```js
articleVectors.info; // { title, wordCount, dimensions, model }, or null before ready
await articleVectors.search("water", 5); // [{ word, count, score }, ...]
```

Search embeds the query with the same model and returns article words ranked by
cosine similarity (highest first). This provides semantic similarity for words;
it does not use their surrounding sentence as context.

## Publishing

Publish directly from the repository root with GitHub Pages:

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/ (root)**, then **Save**.

GitHub Pages publishes updates pushed to `main`. No packaging or build command
is required. The site is available at https://anttu.github.io/denantle/.

Keep `LICENSE`, `licenses.html`, `THIRD_PARTY_NOTICES.md`, `ARTWORK.md`,
`third-party-manifest.json`, `licenses/` and
`source/voikko-corresponding-source.tar.gz` available alongside the game.
Retain the visible license link and Voikko source download. The
[license and source page](licenses.html) links to the
[public GitHub repository](https://github.com/anttu/denantle) and the application
source files served directly with the site.
The application still needs network access to Wikipedia, Hugging Face and
jsDelivr for articles and the embedding runtime/models.

When updating Voikko, preserve the exact new library and dictionary sources,
build scripts, licensing notices and checksums. Model or runtime changes also
require checking and updating their license records.
