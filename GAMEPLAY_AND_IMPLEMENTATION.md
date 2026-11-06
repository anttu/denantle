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
in the browser. The TypeScript sources are compiled into a static site; no
application server or API key is required by the published game.

Keep `index.html` and `favicon.ico` in the repository root, with the application's
TypeScript source files in `src/`, the PNG assets in `images/` and the bundled
language libraries in `vendor/`. For development,
run `./start-local.sh` and open `http://localhost:8000` in Firefox. The script
selects the pinned Node.js version with NVM, installs npm dependencies
on first use, builds `dist/`, serves that output and rebuilds on source changes.
For publication, follow the [publishing instructions](#publishing) below.
The page heading displays three separate images: the seven-bar mark
(`images/denantle-mark.png`), the Denantle wordmark
(`images/denantle-wordmark.png`) and the hand-drawn face
(`images/denantle-icon.png`). The smaller icon PNGs and `favicon.ico` provide
browser and touch icons.
Serve the generated `dist/` directory over HTTP(S); native browser modules and
workers require a web server. An internet connection
is required to fetch articles and initially download the embedding model.
The embedding runtime is shipped with the static site.

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

Feature flags are managed in `src/feature-flags.ts`. `featureFlags` contains the
production defaults; `developmentFeatureFlags` overrides them for local work.
`multiplayer` is `false` in production and `true` in development.
`npm run build` emits the production flags into `dist/src/feature-flags.js`;
`npm run dev` and `./start-local.sh` pass `--development` to the build instead.
The deployment pipeline continues to publish the same production artifact that
the Firefox tests exercised. Production hides and disables the game-mode
controls and hides multiplayer help. The `multiplayer` flag controls UI
discovery only: automatic invitation URLs still join the host when it is off,
showing connection status and the leave button. Host controls stay hidden for
these guests after they leave. Ordinary solo visits do not contact signaling.
The URL parameter `multiplayer=1` enables the UI for that page, including in
production, without changing the build or persisting a browser setting. Invite
links omit this parameter so recipients keep their own UI defaults. To enable
the UI for everyone, set `featureFlags.multiplayer` to `true` and rebuild and
publish normally. Flag defaults are build-time settings: rebuild and reload
after changing them.

With multiplayer enabled, the game-mode radio buttons default to **Yksinpeli**.
Selecting **Moninpeli**
shows the automatic invite card. **Luo kutsulinkki** opens a PeerJS identity on
the shared public PeerJS Cloud signaling service; it needs no account or personal
API key. The reusable URL contains a random host identity and a 128-bit invite
capability in its fragment. Each visitor creates an independent reliable data
connection to the host. The same link remains valid as guests join and leave,
and changing the article updates the URL without changing the host identity.
The host must keep the game page open. Ending multiplayer, switching to solo,
or reloading the host page ends that identity and invalidates its link.

Before creating an automatic invite, the host chooses **Yhteysverkko**:
**Lähiverkko** (`lan`) gathers interface candidates without STUN, while
**Internet** (`internet`, the default) also discovers public NAT mappings through
STUN. Local-network invitations include `network=lan` in the fragment; internet
invitations keep the existing URL format. Both peers use the chosen setting.
Incoming connection metadata must match the host's
network choice; omitted network values in old invites and metadata default to
`internet`. Unknown values are rejected before signaling. The choice is locked
while the automatic session exists; end multiplayer before changing it.
The network selection controls ICE discovery, not access control: an interface
may itself have a globally routable IPv6 address. Local-network mode still needs
internet access for PeerJS Cloud signaling. The page URL must also be reachable
by guests; a `localhost` invitation only loads on the same machine.

`src/peerjs-session.ts` uses the pinned PeerJS npm package, bundled locally by
esbuild. It validates the invite capability on incoming connections and rejects
media calls and unsolicited connections on guests. The application does not
contact the signaling service in solo play or just from opening the multiplayer
panel. A signaling outage displays an error while established data channels
remain usable. Manual connection is offered only when its feature flag is
enabled. The host can retry signaling with the
same identity when the connection to PeerJS Cloud is temporarily lost.
An unavailable host identity (`peer-unavailable`) asks the guest for a new invite.
Other signaling failures retain the original PeerJS error code in the translated
message; a subsequent close event cannot overwrite the first cause. These errors
are distinct from the data connection's ICE/SDP failure path.

`src/feature-flags.ts` sets `manualMultiplayer` to `false` for both local
development and production builds. This hides **Yhdistä käsin**, disables manual
negotiation and manual invitation URLs, and omits manual fallback instructions.
Set the flag to `true` and rebuild to enable the following manual flow. The
`multiplayer` flag or `multiplayer=1` URL parameter exposes the host controls;
incoming manual invites do not require that UI flag.

The collapsed **Yhdistä käsin** disclosure preserves manual offer/answer
exchange. Its invitation and reply are shown side by side, stacking on mobile.
Each manual invitation accepts one guest; additional guests need separate
manual invitations. Opening an old invitation URL automatically opens these
controls. The host can cancel a pending manual invitation without closing
established connections, and automatic and manual guests can share a game.
`src/signaling-payload.ts` preserves the path and query when adding a manual
invitation to the URL fragment. Its binary profiles and dictionary format
reconstruct SDP exactly, including multiple candidates and browser-specific
fields. The receiving browser removes invite fragments from the address bar
before connecting. Manual descriptions wait until ICE gathering completes,
so no external signaling service is needed for this connection method.
The optional **payload debug** checkbox reveals decoded manual descriptions.

`src/data-peer.ts` implements the same bounded JSON framing, small chunks and
send-buffer backpressure for both connection methods. `src/manual-peer.ts`
owns native manual WebRTC connections. Internet mode and manual connections use
Google's public STUN server at `stun:stun.l.google.com:19302`; local-network mode
sets an empty ICE server list. No TURN relay is configured.
Game data travels directly between browsers. STUN enables different-network
connections when NATs and firewalls permit them; restrictive networks may still
prevent a direct connection.
This follows the native [WebRTC offer/answer and ICE flow](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity).

The inviter's browser owns the shared article and one peer connection per guest.
It processes all players' guesses in order and broadcasts state to connected
guests. Request acknowledgements go only to the requesting guest, since each
guest has its own request counter. Player counts are updated when guests join
or leave. Each guest receives the exact article text and a snapshot of
reveals, hint scores, guess history and counts, including progress made before
joining. Only the inviter builds semantic vectors for the shared game. Messages
are bounded and split into small chunks with send-buffer backpressure to support
large articles. A new article has a fresh session ID, so delayed guesses from an
older board cannot affect it. Joining cancels any pending local article request;
only the inviter can select an article or change the language during a session.
Disabling multiplayer or losing the host connection restores a guest's solo
controls and local semantic indexing while keeping the current board when
available. A guest disconnect or invalid message closes only that guest's
connection; other guests and pending invitations remain unaffected. The host
can disconnect everyone explicitly. Reloading a page closes that browser's
connections. An automatic guest can reopen the reusable link while its host
identity remains active; a manual guest needs a fresh offer/answer exchange.

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
words. The threshold is defined by `SIMILARITY_THRESHOLD` in `src/game.ts`. Similarity
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
`src/categories.ts`, including their subcategories. Both English editions start from
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
download revisions are pinned in `src/embedding-worker.ts` and
`third-party-manifest.json`. Their model cards and license are in `licenses/`.
The multilingual model is larger and takes longer to download on first
use. Switching languages releases the previous model and cancels its pending work.
Inference runs on the CPU through
WebAssembly and does not require WebGPU. The model files are downloaded from
Hugging Face, with the browser cache reused when available. Transformers.js is
an npm dependency pinned in `package-lock.json`, bundled into the embedding
worker with esbuild. Its matching ONNX WebAssembly runtime and loader are copied
from the installed package to `dist/vendor/onnx/` and loaded relative to the
worker, including when the site is served from a subdirectory. No runtime files
are fetched from a CDN. Article text and search terms are processed locally.

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
const { articleVectors } = await import(new URL("src/embeddings.js", location.href).href);
articleVectors.info; // { title, wordCount, dimensions, model }, or null before ready
await articleVectors.search("water", 5); // [{ word, count, score }, ...]
```

Search embeds the query with the same model and returns article words ranked by
cosine similarity (highest first). This provides semantic similarity for words;
it does not use their surrounding sentence as context.

## Publishing

Use **GitHub Actions** as the repository's Pages publishing source.
`.github/workflows/playwright.yaml` runs the same command used locally:

```sh
docker compose -f tests/compose.yaml run --build --rm playwright
```

The container installs the root lockfile with `npm ci`, checks formatting, lint
rules and import organization with the pinned Biome version, strictly typechecks the
browser code, both worker environments, Node.js tools and Playwright tests, then
builds the complete `dist/` site and runs all tests in Firefox. On successful
pushes to `main`, the test job uploads that exact tested directory as the Pages
artifact. The deployment job publishes it without rebuilding. A failing check
leaves the currently published version in place.

The Compose topology also runs three remote Firefox servers, each attached to
a single LAN, and two routing containers. Tests cover a shared LAN, two LANs
behind separate NATs, and a LAN-only invitation that cannot cross those routers.
HTTPS site delivery, PeerServer signaling and STUN run inside the test topology;
the browsers use real ICE and data channels to replicate a guest's guess.
The positive NAT case uses permissive UDP forwarding, so it proves the mapped
address path without claiming support for restrictive real-world NATs. Docker's
bridge masquerade is disabled: only the routing containers translate addresses.
Assertions check the selected ICE candidate types, both remote WAN addresses and
reciprocal ports. State transitions and selected paths are saved in
`tests/reports/network-*.json` and attached to the tests. Failed tests also print
the complete diagnostic report. CI stops the containers with
`docker compose -f tests/compose.yaml down --remove-orphans`; run the same cleanup
after a local Docker test. A plain `npm test` skips the topology-specific cases.

For a local production build, use `npm ci --ignore-scripts --no-audit --no-fund`
and `npm run build`. Preview it with `node tools/serve.mts`. `npm test` builds
and runs the TypeScript Playwright tests; a local run needs Playwright's Firefox
installed with `npx playwright install firefox`. `npm run typecheck` checks
application, worker, tool and test types without emitting files.

The published site is available at https://anttu.github.io/denantle/.

Keep `LICENSE`, `licenses.html`, `THIRD_PARTY_NOTICES.md`, `ARTWORK.md`,
`third-party-manifest.json`, `licenses/` and
`source/voikko-corresponding-source.tar.gz` available alongside the game.
Retain the visible license link and Voikko source download. The
[license and source page](licenses.html) links to the
[public GitHub repository](https://github.com/anttu/denantle) and the application
source files served directly with the site.
The application still needs network access to Wikipedia and Hugging Face for
articles and embedding models.

When updating Voikko, preserve the exact new library and dictionary sources,
build scripts, licensing notices and checksums. Model or runtime changes also
require checking and updating their license records.
