# Denantle: third-party software and content

Denantle's original code is copyright © 2026 Antero Fagerstedt and is
licensed under **GPL-3.0-or-later**; see [LICENSE](LICENSE). It is provided
without warranty. Upstream components retain their own copyright notices
and licenses. The application is conveyed as a GPL-3.0-or-later combination;
this does not replace upstream permissions or relicense Wikipedia or model weights.

## Voikko 1.0.1, libvoikko 4.3.2 and Finnish morphology

The unchanged `vendor/voikko-1.0.1.min.js` is from the
[voikko 1.0.1 npm publication](https://www.npmjs.com/package/voikko/v/1.0.1),
packaged by Aattola; its recorded git revision is
`f86f6117aa6e6d7d49d43de33e1d8380c27982ec`.
It embeds libvoikko 4.3.2 and the Finnish `morpho` dictionary.

All corevoikko content is available under GPL-3.0-or-later. The library
also carries alternative component licenses, retained in
[Voikko-Core-LICENSE.txt](licenses/Voikko-Core-LICENSE.txt) and
[Voikko-COPYING.txt](licenses/Voikko-COPYING.txt).
The Finnish dictionary is GPL-2.0-or-later, copyright © 2006–2022
Hannu Väisänen, Harri Pitkänen, Teemu Likonen and other contributors.
See [the original dictionary license](licenses/Voikko-Finnish-GPL-2.0.txt)
and the CONTRIBUTORS files inside the source archives for complete attribution.
The library, dictionary and combination are conveyed under GPL version 3
or later, as their upstream terms permit.

[Download the complete corresponding source](source/voikko-corresponding-source.tar.gz).
The archive includes the original corevoikko 4.3.2 source, the original
2024-06-18 dictionary source snapshot (including vocabulary), the exact
dictionary binaries, and the npm build scripts and TypeScript API source.
Its README explains how to rebuild and modify the components.
All three dictionary files were compared byte-for-byte with the dictionary
embedded in the published WebAssembly. File hashes are recorded inside the
archive and in [third-party-manifest.json](third-party-manifest.json).
The archive is served with the application; access does not depend on
the continuing availability of an upstream repository or snapshot URL.

The Emscripten 4.0.0 runtime is covered by
[its original license and third-party notices](licenses/Emscripten-LICENSE.txt).
The build is unmodified. No warranty is provided.

## Compromise 14.19.0

Copyright © 2026 Spencer Kelly. MIT license; the full notice is in
[vendor/compromise-LICENSE.txt](vendor/compromise-LICENSE.txt).
The bundled build is unchanged from
https://cdn.jsdelivr.net/npm/compromise@14.19.0/builds/compromise.js.
Source: https://github.com/spencermountain/compromise/tree/14.19.0.
Keep the accompanying copyright and permission notice when redistributing it.

## Transformers.js 3.8.1 and its browser runtime

Transformers.js is provided by Hugging Face under
[Apache License 2.0](licenses/Apache-2.0.txt).
Source: https://github.com/huggingface/transformers.js/tree/3.8.1.
The versioned browser build is downloaded from
https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1.

Its browser bundle includes Hugging Face Jinja 0.5.3 (MIT) and
ONNX Runtime (MIT), including onnxruntime-common 1.21.0 and
onnxruntime-web 1.22.0-dev.20250409-89f8206ba4. Copyright holders include
Hugging Face and Microsoft Corporation. Preserve these full notices:

* [Hugging Face Jinja license](licenses/Hugging-Face-Jinja-LICENSE.txt).
* [ONNX Runtime license](licenses/ONNX-Runtime-LICENSE.txt).
* [ONNX Runtime third-party notices](licenses/ONNX-Runtime-ThirdPartyNotices.txt),
  from the exact ONNX Runtime source revision `89f8206ba4`, covering
  the runtime's third-party components, including its WebAssembly build.

The application does not use the Node.js-only Sharp or onnxruntime-node packages.

## Embedding models

Both models are used unmodified as 8-bit quantized ONNX models and are
downloaded from Hugging Face at the immutable revisions below. The model
weights retain their [Apache-2.0 license](licenses/Apache-2.0.txt).
Model cards are included locally to preserve the authors' attribution.

| Use | Model | Revision | Model card |
| --- | --- | --- | --- |
| English | [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) | `751bff37182d3f1213fa05d7196b954e230abad9` | [Saved card](licenses/model-en-README.md) |
| Finnish | [onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX](https://huggingface.co/onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX) | `d4c06bf0d7680171ac30042a1387e1fdb7a90021` | [Saved card](licenses/model-fi-README.md) |

The source models are by the Sentence Transformers project;
ONNX conversions are by Xenova and ONNX Community respectively. The Finnish
conversion replaces the previously referenced Xenova conversion whose own
model card did not state a license. Apache-2.0 permits commercial use and
distribution subject to its notice and other terms; it grants no trademark rights.

## Wikipedia text

Article text is by the contributors to Simple English Wikipedia or Finnish
Wikipedia, and is reused under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The full [license text](licenses/CC-BY-SA-4.0.txt) is included locally.
Each article links to the original page, whose history identifies its authors.
The displayed adaptation remains available under CC BY-SA 4.0.

The game removes selected sections and heading markup, hides words and may
display guesses in their place. These modifications are disclosed beside
each article. The software's GPL license does not change the article license.
Images from Wikipedia are not retrieved or redistributed.
Wikimedia's [reuse conditions](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content)
require preserving any additional attribution attached to imported content.

## Original artwork

See [ARTWORK.md](ARTWORK.md). The original distributed icon, wordmark and
favicon assets are licensed separately under CC BY-SA 4.0.

## When publishing or redistributing

Run `python3 tools/prepare_release.py` and publish the complete generated
directory, including `licenses/` and `source/`. The generated source archive
contains the exact application source files shipped by that invocation, all
notices, the release tool and the complete Voikko corresponding-source archive.
Do not remove source downloads or legal notices from an existing publication.
Regenerate the release after changing source files. If replacing any dependency,
update its license, corresponding source where required, version and checksums.
