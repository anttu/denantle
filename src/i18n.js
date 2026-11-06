// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

// All interface copy lives here. Article content keeps its own language.
const translations = {
  "language.label": {
    "fi": "Kieli",
    "en": "Language"
  },
  "language.fi": {
    "fi": "Suomi",
    "en": "Suomi"
  },
  "language.en": {
    "fi": "English",
    "en": "English"
  },
  "page.description": {
    "fi": "Arvaa peitetyn Wikipedia-artikkelin sanat. Läheiset arvaukset auttavat paljastamaan tekstin.",
    "en": "Guess the words in a hidden Wikipedia article. Close guesses help reveal the text."
  },
  "help.title": {
    "fi": "Näin pelaat",
    "en": "How to play"
  },
  "help.guessEnglish": {
    "fi": "Arvaa peitetyn artikkelin sanoja englanniksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä.",
    "en": "Guess words in the hidden article in English. A word’s base form also reveals its inflected forms. A guess with a similar meaning appears on the black bar."
  },
  "help.guessFinnish": {
    "fi": "Arvaa peitetyn artikkelin sanoja suomeksi. Sanan perusmuoto paljastaa myös taivutusmuodot. Merkitykseltään läheinen arvaus näkyy mustan palkin päällä.",
    "en": "Guess words in the hidden article in Finnish. A word’s base form also reveals its inflected forms. A guess with a similar meaning appears on the black bar."
  },
  "help.proximity": {
    "fi": "Tekstin palkkien vihjeissä sininen on kaukana ja punainen lähellä. Vie osoitin palkin päälle tai klikkaa sitä nähdäksesi sanan pituuden ja läheisyyden.",
    "en": "Hints on the bars are blue for distant meanings and red for close ones. Hover over or click a bar to see the word’s length and similarity."
  },
  "help.history": {
    "fi": "Arvaushistoriassa musta on tarkka, oranssi lähellä ja sininen kaukana. Numero kertoo löytyneiden sanojen määrän.",
    "en": "In the guess history, black means exact, orange means close and blue means distant. The number shows how many words matched."
  },
  "help.replay": {
    "fi": "Pelin tunnisteesta voit aloittaa saman pelin uudelleen. Tallenna tai jaa sen linkki pelataksesi saman artikkeliversion myöhemmin.",
    "en": "Use the game ID to restart the same game. Save or share its link to play the same article revision later."
  },
  "help.multiplayer": {
    "fi": "Moninpelissä pelaajat paljastavat samaa artikkelia yhdessä. Valitse moninpeli samassa lähiverkossa ja jaa kutsulinkki pelikaverille. Hän lähettää vastauksen takaisin kutsujalle. Voit kutsua lisää pelaajia yhteyden avauduttua.",
    "en": "In multiplayer, players reveal the same article together. Choose multiplayer on the same local network and share an invite link with a friend. They send a response back to the host. You can invite more players once connected."
  },
  "welcome.tagline": {
    "fi": "Pieni arvoitus. Sana kerrallaan.",
    "en": "A little mystery. One word at a time."
  },
  "welcome.firstLine": {
    "fi": "Mitä rivien",
    "en": "What lies hidden"
  },
  "welcome.secondLine": {
    "fi": "väliin kätkeytyy?",
    "en": "between the lines?"
  },
  "welcome.description": {
    "fi": "Paljasta Wikipedia-artikkeli arvaamalla sanoja.",
    "en": "Reveal a Wikipedia article by guessing words."
  },
  "source.label": {
    "fi": "Datalähde",
    "en": "Article source"
  },
  "source.simple": {
    "fi": "Simple English Wikipedia",
    "en": "Simple English Wikipedia"
  },
  "source.fi": {
    "fi": "Suomenkielinen Wikipedia",
    "en": "Finnish Wikipedia"
  },
  "source.en": {
    "fi": "English Wikipedia",
    "en": "English Wikipedia"
  },
  "game.new": {
    "fi": "Uusi peli",
    "en": "New game"
  },
  "game.newDescription": {
    "fi": "Valitse uusi satunnainen artikkeli",
    "en": "Choose a new random article"
  },
  "game.mode": {
    "fi": "Pelimuoto",
    "en": "Game mode"
  },
  "game.settings": {
    "fi": "Peliasetukset",
    "en": "Game settings"
  },
  "game.singleplayer": {
    "fi": "Yksinpeli",
    "en": "Single player"
  },
  "game.multiplayer": {
    "fi": "Moninpeli samassa lähiverkossa",
    "en": "Multiplayer on the same local network"
  },
  "multiplayer.connected": {
    "fi": "Yhteys muodostettu",
    "en": "Connected"
  },
  "multiplayer.inviteMore": {
    "fi": "Kutsu lisää pelaajia",
    "en": "Invite more players"
  },
  "multiplayer.title": {
    "fi": "Yksi arvoitus. Kaksi päätä.",
    "en": "One mystery. Two minds."
  },
  "multiplayer.description": {
    "fi": "Pelatkaa samaa artikkelia yhdessä.",
    "en": "Reveal the same article together."
  },
  "multiplayer.network": {
    "fi": "Sama lähiverkko",
    "en": "Same local network"
  },
  "multiplayer.sendInvite": {
    "fi": "Lähetä kutsu",
    "en": "Send an invite"
  },
  "multiplayer.sendInviteHelp": {
    "fi": "Kopioi kutsulinkki ja lähetä se pelikaverillesi.",
    "en": "Copy the invite link and send it to your friend."
  },
  "multiplayer.singleUse": {
    "fi": "Kertakäyttöinen linkki yhdelle henkilölle.",
    "en": "A single-use link for one person."
  },
  "multiplayer.singleUseHelp": {
    "fi": "Tällä linkillä voi liittyä vain yksi henkilö. Luo jokaiselle muulle pelaajalle oma kutsulinkki.",
    "en": "Only one person can join with this link. Create a separate invite link for each additional player."
  },
  "multiplayer.create": {
    "fi": "Luo kutsu",
    "en": "Create invite"
  },
  "multiplayer.link": {
    "fi": "Kutsulinkki",
    "en": "Invite link"
  },
  "multiplayer.copyLink": {
    "fi": "Kopioi kutsulinkki",
    "en": "Copy invite link"
  },
  "multiplayer.pasteResponse": {
    "fi": "Liitä kaverin vastaus",
    "en": "Paste your friend’s response"
  },
  "multiplayer.responseHelp": {
    "fi": "Kaveri avaa linkin ja lähettää sinulle vastauksen.",
    "en": "Your friend opens the link and sends you a response."
  },
  "multiplayer.responsePlaceholder": {
    "fi": "Liitä vastaus tähän…",
    "en": "Paste the response here…"
  },
  "multiplayer.acceptResponse": {
    "fi": "Hyväksy vastaus",
    "en": "Accept response"
  },
  "multiplayer.initial": {
    "fi": "Luo kutsu aloittaaksesi yhteisen pelin.",
    "en": "Create an invite to start playing together."
  },
  "multiplayer.reset": {
    "fi": "Aloita alusta",
    "en": "Start over"
  },
  "multiplayer.joinToggle": {
    "fi": "Saitko kutsun? Liity kaverin peliin",
    "en": "Got an invite? Join your friend’s game"
  },
  "multiplayer.technical": {
    "fi": "Yhteyden tekniset tiedot",
    "en": "Connection details"
  },
  "multiplayer.debug": {
    "fi": "payload debug",
    "en": "Payload debug"
  },
  "multiplayer.localPayload": {
    "fi": "Oma payload (JSON)",
    "en": "Your payload (JSON)"
  },
  "multiplayer.remotePayload": {
    "fi": "Pelikaverin payload (JSON)",
    "en": "Your friend’s payload (JSON)"
  },
  "multiplayer.localPayloadLabel": {
    "fi": "Oma payload JSON-muodossa",
    "en": "Your payload as JSON"
  },
  "multiplayer.remotePayloadLabel": {
    "fi": "Pelikaverin payload JSON-muodossa",
    "en": "Your friend’s payload as JSON"
  },
  "multiplayer.disconnectReset": {
    "fi": "Katkaise / aloita alusta",
    "en": "Disconnect / start over"
  },
  "game.version": {
    "fi": "Pelin tunniste:",
    "en": "Game ID:"
  },
  "game.replay": {
    "fi": "Pelaa sama peli uudelleen alusta",
    "en": "Play the same game again from the beginning"
  },
  "game.revealed": {
    "fi": "Paljastettuja sanoja",
    "en": "Revealed words"
  },
  "guess.label": {
    "fi": "Arvaa sana",
    "en": "Guess a word"
  },
  "guess.placeholder": {
    "fi": "Arvaa seuraava sana…",
    "en": "Guess the next word…"
  },
  "guess.submit": {
    "fi": "Arvaa",
    "en": "Guess"
  },
  "proximity.exact": {
    "fi": "Tarkka",
    "en": "Exact"
  },
  "proximity.near": {
    "fi": "Lähellä",
    "en": "Close"
  },
  "proximity.cold": {
    "fi": "Kaukana",
    "en": "Distant"
  },
  "proximity.label": {
    "fi": "Arvausten värit",
    "en": "Guess colours"
  },
  "article.label": {
    "fi": "Artikkeli",
    "en": "Article"
  },
  "article.source": {
    "fi": "Lähde:",
    "en": "Source:"
  },
  "article.adaptation": {
    "fi": "Tekstiä on lyhennetty ja muokattu peliä varten. Sanoja peitetään ja niiden tilalla voidaan näyttää arvauksia.",
    "en": "The text has been shortened and adapted for the game. Words are hidden and may be replaced with guesses."
  },
  "page.javascript": {
    "fi": "Satunnaisen artikkelin näyttäminen edellyttää JavaScriptin sallimista selaimessa.",
    "en": "Enable JavaScript in your browser to display a random article."
  },
  "licenses.title": {
    "fi": "Lisenssit ja lähdekoodi",
    "en": "Licences and source code"
  },
  "licenses.footer": {
    "fi": "Vapaa ohjelmisto: saat käyttää, muokata ja jakaa sitä lisenssin ehdoilla. Ohjelmalla ei ole takuuta.",
    "en": "Free software: you may use, modify and share it under the licence terms. This program comes without warranty."
  },
  "licenses.pageTitle": {
    "fi": "Lisenssit ja lähdekoodi – Denantle",
    "en": "Licences and source code – Denantle"
  },
  "licenses.back": {
    "fi": "← Takaisin peliin",
    "en": "← Back to the game"
  },
  "licenses.intro": {
    "fi": "© 2026 Antero Fagerstedt. Denantlen oma ohjelmakoodi on vapaata ohjelmistoa, joka on julkaistu",
    "en": "© 2026 Antero Fagerstedt. Denantle’s own code is free software, released under"
  },
  "licenses.gpl": {
    "fi": "GNU GPL:n version 3 tai uudemman",
    "en": "GNU GPL version 3 or later"
  },
  "licenses.terms": {
    "fi": "ehdoilla (GPL-3.0-or-later). Saat käyttää, tutkia, muokata ja jakaa sitä, myös kaupallisesti, lisenssin ehtojen mukaisesti.",
    "en": "(GPL-3.0-or-later). You may use, study, modify and share it, including commercially, under the licence terms."
  },
  "licenses.warranty": {
    "fi": "Ohjelma tarjotaan ilman takuuta, mukaan lukien takuut myyntikelpoisuudesta tai soveltuvuudesta tiettyyn tarkoitukseen. Tarkat oikeudet, ehdot ja vastuunrajoitukset ovat lisenssitekstissä.",
    "en": "The program is provided without warranty, including warranties of merchantability or fitness for a particular purpose. The licence text contains the full rights, terms and limitations of liability."
  },
  "licenses.source": {
    "fi": "Lähdekoodi",
    "en": "Source code"
  },
  "licenses.repositoryIntro": {
    "fi": "Pelin lähdekoodi ja muutoshistoria ovat saatavilla",
    "en": "The game’s source code and change history are available in the"
  },
  "licenses.repository": {
    "fi": "GitHub-repositoriossa",
    "en": "GitHub repository"
  },
  "licenses.files": {
    "fi": "Pelin selaimelle toimitettavat lähdetiedostot ovat myös suoraan luettavissa:",
    "en": "The source files delivered to your browser can also be read directly:"
  },
  "licenses.gameLogic": {
    "fi": "pelilogiikka",
    "en": "game logic"
  },
  "licenses.wikipedia": {
    "fi": "Wikipedia-haku",
    "en": "Wikipedia queries"
  },
  "licenses.categories": {
    "fi": "kategoriat",
    "en": "categories"
  },
  "licenses.vectors": {
    "fi": "sanavektorit",
    "en": "word vectors"
  },
  "licenses.model": {
    "fi": "mallin käyttö",
    "en": "model runtime"
  },
  "licenses.inflections": {
    "fi": "suomen taivutusmuodot",
    "en": "Finnish inflections"
  },
  "licenses.and": {
    "fi": "ja",
    "en": "and"
  },
  "licenses.voikkoRuntime": {
    "fi": "Voikon käyttö",
    "en": "Voikko runtime"
  },
  "licenses.voikkoTitle": {
    "fi": "Voikko ja suomen sanasto",
    "en": "Voikko and the Finnish dictionary"
  },
  "licenses.voikko": {
    "fi": "Suomen taivutusmuotoihin käytetään Voikko 1.0.1 -pakettia, joka sisältää libvoikko 4.3.2:n ja suomen morpho-sanaston. Kokonaisuus toimitetaan GPL-3.0-or-later-ehdoin. Alkuperäiset tekijänoikeus- ja vaihtoehtoiset lisenssimerkinnät säilyvät lähdepaketissa.",
    "en": "Finnish inflections use the Voikko 1.0.1 package, which includes libvoikko 4.3.2 and the Finnish morpho dictionary. The bundle is distributed under GPL-3.0-or-later. Original copyright and alternative licence notices are preserved in the source archive."
  },
  "licenses.voikkoDownload": {
    "fi": "Lataa Voikon ja sanaston vastaava lähdekoodi ja käännösohjeet",
    "en": "Download the corresponding source code and build instructions for Voikko and the dictionary"
  },
  "licenses.voikkoAuthors": {
    "fi": ". Sanaston tekijöitä ovat Hannu Väisänen, Harri Pitkänen, Teemu Likonen ja muut lähdepaketissa nimetyt tekijät.",
    "en": ". The dictionary’s authors include Hannu Väisänen, Harri Pitkänen, Teemu Likonen and others named in the source archive."
  },
  "licenses.libraries": {
    "fi": "Muut kirjastot ja mallit",
    "en": "Other libraries and models"
  },
  "licenses.mit": {
    "fi": "MIT-lisenssi",
    "en": "MIT licence"
  },
  "licenses.transformers": {
    "fi": "Hugging Facen Transformers.js 3.8.1 ja molemmat sanavektorimallit:",
    "en": "Hugging Face Transformers.js 3.8.1 and both word vector models:"
  },
  "licenses.models": {
    "fi": ". Mallit ovat Xenova/all-MiniLM-L6-v2 ja onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX.",
    "en": ". The models are Xenova/all-MiniLM-L6-v2 and onnx-community/paraphrase-multilingual-MiniLM-L12-v2-ONNX."
  },
  "licenses.thirdParty": {
    "fi": "kolmansien osapuolten ilmoitukset",
    "en": "third-party notices"
  },
  "licenses.notices": {
    "fi": "lisenssit ja ilmoitukset",
    "en": "licences and notices"
  },
  "licenses.origins": {
    "fi": "Tarkat alkuperät, versiot ja lisenssitiedot",
    "en": "Detailed origins, versions and licence information"
  },
  "licenses.checksums": {
    "fi": "Lukitut versiot ja tiedostojen tarkistussummat",
    "en": "Pinned versions and file checksums"
  },
  "licenses.artworkTitle": {
    "fi": "Wikipedia-artikkelit ja kuvitus",
    "en": "Wikipedia articles and artwork"
  },
  "licenses.articles": {
    "fi": "Artikkelit ovat Wikipedian kirjoittajien tekstiä. Artikkelin yhteydessä oleva lähdelinkki johtaa alkuperäiseen sivuun, jonka historiasta tekijät löytyvät. Tekstiä on lyhennetty ja muokattu peliä varten: osioita poistetaan, sanoja peitetään ja niiden tilalla voidaan näyttää arvauksia. Muokattu artikkeliteksti on saatavilla",
    "en": "The articles are written by Wikipedia contributors. The source link accompanying an article leads to the original page, whose history lists its authors. The text has been shortened and adapted for the game: sections are removed, words are hidden and guesses may appear in their place. The adapted article text is available under"
  },
  "licenses.articleLicence": {
    "fi": "-lisenssillä. Artikkeleiden lisenssi on erillinen ohjelmakoodin lisenssistä.",
    "en": ". The article licence is separate from the software licence."
  },
  "licenses.artwork": {
    "fi": "Pelin omien kuvakkeiden ja nimilogon tekijä on Antero Fagerstedt. Niiden lisenssi on CC BY-SA 4.0.",
    "en": "The game’s own icons and wordmark were created by Antero Fagerstedt. They are licensed under CC BY-SA 4.0."
  },
  "licenses.artworkDetails": {
    "fi": "Kuvituksen tiedot",
    "en": "Artwork details"
  },
  "error.sharedState": {
    "fi": "Toisen pelaajan pelitiedot eivät kelpaa.",
    "en": "The other player’s game data is invalid."
  },
  "inflections.loading": {
    "fi": "Valmistellaan suomen taivutusmuotoja… Voit jo arvata tarkkoja kirjoitusasuja.",
    "en": "Preparing Finnish inflections… You can already guess exact word forms."
  },
  "inflections.ready": {
    "fi": "Suomen taivutusmuodot valmiina. Voit arvata sanan perusmuodon.",
    "en": "Finnish inflections are ready. You can guess a word’s base form."
  },
  "inflections.unavailable": {
    "fi": "Suomen taivutusmuotoja ei voitu ladata. Voit edelleen arvata sanojen tarkkoja kirjoitusasuja.",
    "en": "Finnish inflections could not be loaded. You can still guess exact word forms."
  },
  "word.length": {
    "fi": "Pituus: {length} merkkiä",
    "en": "Length: {length} characters"
  },
  "word.hint": {
    "fi": "Vihje ”{guess}”: läheisyys {score} %",
    "en": "Hint “{guess}”: similarity {score}%"
  },
  "word.latest": {
    "fi": "Uusin arvaus ”{guess}”: läheisyys {score} %",
    "en": "Latest guess “{guess}”: similarity {score}%"
  },
  "word.noGuess": {
    "fi": "Läheisyys: ei vielä arvausta",
    "en": "Similarity: no guesses yet"
  },
  "guess.recent": {
    "fi": "Viimeisimmät arvaukset:",
    "en": "Recent guesses:"
  },
  "guess.singular": {
    "fi": " arvaus",
    "en": " guess"
  },
  "guess.plural": {
    "fi": " arvausta",
    "en": " guesses"
  },
  "game.wordCount": {
    "fi": " / {total} sanaa",
    "en": " / {total} words"
  },
  "game.solved": {
    "fi": "Hienoa! Arvasit koko otsikon oikein!",
    "en": "Well done! You guessed the entire title!"
  },
  "guess.invalidFinnish": {
    "fi": "Syötä yksi sana suomeksi.",
    "en": "Enter one word in Finnish."
  },
  "guess.invalidEnglish": {
    "fi": "Syötä yksi sana englanniksi.",
    "en": "Enter one word in English."
  },
  "guess.duplicate": {
    "fi": "Olet jo arvannut sanan ”{guess}”.",
    "en": "You have already guessed “{guess}”."
  },
  "guess.inflectionsPending": {
    "fi": "Taivutusmuotoja valmistellaan. Voit arvata tarkkoja sanoja jo nyt ja kokeilla perusmuotoa uudelleen hetken kuluttua.",
    "en": "Inflections are being prepared. You can guess exact word forms now and try the base form again shortly."
  },
  "guess.hintsPending": {
    "fi": "Lähisanojen haku ei ole vielä käytettävissä. Voit arvata tarkkoja sanoja jo nyt.",
    "en": "Semantic hints are not available yet. You can already guess exact words."
  },
  "guess.hintsFailed": {
    "fi": "Lähisanojen haku epäonnistui.",
    "en": "Searching for related words failed."
  },
  "guess.retry": {
    "fi": "Lähisanojen haku epäonnistui. Yritä arvausta uudelleen.",
    "en": "Searching for related words failed. Try your guess again."
  },
  "error.articleData": {
    "fi": "Artikkelin tiedot eivät kelpaa.",
    "en": "The article data is invalid."
  },
  "vectors.shared": {
    "fi": "Lähisanavihjeet jaetaan kutsujan selaimesta.",
    "en": "Semantic hints are shared from the host’s browser."
  },
  "vectors.loading": {
    "fi": "Valmistellaan sanavektorimallia… Ensimmäinen lataus voi kestää hetken.",
    "en": "Preparing the word vector model… The first download may take a moment."
  },
  "vectors.progress": {
    "fi": "Luodaan sanavektoreita: {completed} / {total} sanaa…",
    "en": "Creating word vectors: {completed} / {total} words…"
  },
  "vectors.ready": {
    "fi": "Sanavektorit valmiina: {count} eri sanaa.",
    "en": "Word vectors ready: {count} distinct words."
  },
  "error.http": {
    "fi": "Artikkelin haku epäonnistui (HTTP {status}). Yritä uudelleen.",
    "en": "Fetching the article failed (HTTP {status}). Try again."
  },
  "error.revision": {
    "fi": "Artikkeliversiota ei löytynyt. Tarkista pelin linkki tai valitse uusi peli.",
    "en": "The article revision was not found. Check the game link or start a new game."
  },
  "error.wikipedia": {
    "fi": "Wikipedia ei voinut käsitellä hakua. Yritä uudelleen.",
    "en": "Wikipedia could not process the request. Try again."
  },
  "error.categories": {
    "fi": "Valituista kategorioista ei löytynyt artikkeleita. Yritä uudelleen.",
    "en": "No articles were found in the selected categories. Try again."
  },
  "article.loadingRandom": {
    "fi": "Haetaan satunnaista artikkelia…",
    "en": "Fetching a random article…"
  },
  "article.loadingSaved": {
    "fi": "Haetaan tallennettua peliä…",
    "en": "Fetching the saved game…"
  },
  "error.gameId": {
    "fi": "Pelin tunniste ei kelpaa. Tarkista pelin linkki tai valitse uusi peli.",
    "en": "The game ID is invalid. Check the game link or start a new game."
  },
  "error.emptyArticle": {
    "fi": "Artikkelissa ei ole näytettävää leipätekstiä.",
    "en": "The article has no body text to display."
  },
  "error.timeout": {
    "fi": "Haku kesti liian kauan. Yritä uudelleen.",
    "en": "The request took too long. Try again."
  },
  "error.network": {
    "fi": "Wikipediaan ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.",
    "en": "Could not connect to Wikipedia. Check your network connection and try again."
  },
  "error.article": {
    "fi": "Artikkelin haku epäonnistui. Yritä uudelleen.",
    "en": "Fetching the article failed. Try again."
  },
  "vectors.notReady": {
    "fi": "Artikkelin sanavektorit eivät ole vielä valmiit.",
    "en": "The article’s word vectors are not ready yet."
  },
  "vectors.query": {
    "fi": "Anna hakusana.",
    "en": "Enter a search word."
  },
  "vectors.limit": {
    "fi": "Tulosten määrän pitää olla positiivinen kokonaisluku.",
    "en": "The result limit must be a positive integer."
  },
  "vectors.server": {
    "fi": "Sanavektorit vaativat HTTP-palvelimen. Käynnistä ./start-local.sh ja avaa http://localhost:8000.",
    "en": "Word vectors require an HTTP server. Run ./start-local.sh and open http://localhost:8000."
  },
  "vectors.failed": {
    "fi": "Sanavektorien laskentaa ei voitu käynnistää. Tarkista verkkoyhteys ja kokeile uutta artikkelia.",
    "en": "Word vector processing could not start. Check your network connection and try a new article."
  },
  "vectors.processingFailed": {
    "fi": "Sanavektorien käsittely epäonnistui. Tarkista verkkoyhteys ja kokeile uutta artikkelia.",
    "en": "Word vector processing failed. Check your network connection and try a new article."
  },
  "vectors.empty": {
    "fi": "Artikkelissa ei ole vektoroitavia sanoja.",
    "en": "The article has no words to vectorise."
  },
  "inflections.failed": {
    "fi": "Suomen taivutusmuotojen käsittely epäonnistui.",
    "en": "Processing Finnish inflections failed."
  },
  "article.changed": {
    "fi": "Artikkeli vaihtui.",
    "en": "The article changed."
  },
  "multiplayer.invalidInvite": {
    "fi": "Kutsu ei kelpaa. Liitä koko Denantle-kutsu.",
    "en": "The invite is invalid. Paste the complete Denantle invite."
  },
  "multiplayer.invalidResponse": {
    "fi": "Vastaus ei kelpaa. Liitä kutsuun saatu koko Denantle-vastaus.",
    "en": "The response is invalid. Paste the complete Denantle response to your invite."
  },
  "multiplayer.peerLeft": {
    "fi": "Toinen pelaaja katkaisi yhteyden. Voit jatkaa yksin tai luoda uuden kutsun.",
    "en": "The other player disconnected. You can continue alone or create a new invite."
  },
  "multiplayer.connectionFailed": {
    "fi": "Yhteys epäonnistui. Kokeile uutta kutsua tai toista verkkoa.",
    "en": "The connection failed. Try a new invite or another network."
  },
  "multiplayer.invalidMessage": {
    "fi": "Toisen pelaajan viesti ei kelpaa. Tarkista, että käytätte samaa peliversiota.",
    "en": "The other player’s message is invalid. Make sure you are using the same game version."
  },
  "multiplayer.gatheringTimeout": {
    "fi": "Yhteystietojen keruu kesti liian kauan. Kokeile uudelleen.",
    "en": "Gathering connection details took too long. Try again."
  },
  "multiplayer.closed": {
    "fi": "Yhteys suljettiin.",
    "en": "The connection was closed."
  },
  "multiplayer.noConnection": {
    "fi": "Yhteyttä ei saatu. Kokeile samaa lähiverkkoa tai luo uusi kutsu.",
    "en": "Could not connect. Try the same local network or create a new invite."
  },
  "multiplayer.notOpen": {
    "fi": "Yhteys ei ole auki.",
    "en": "The connection is not open."
  },
  "multiplayer.tooLarge": {
    "fi": "Pelitiedot ovat liian suuret lähetettäviksi.",
    "en": "The game data is too large to send."
  },
  "multiplayer.interrupted": {
    "fi": "Yhteys katkesi.",
    "en": "The connection was lost."
  },
  "multiplayer.sendTimeout": {
    "fi": "Tietojen lähetys aikakatkaistiin.",
    "en": "Sending the data timed out."
  },
  "multiplayer.connectionClosed": {
    "fi": "Yhteys suljettu.",
    "en": "Connection closed."
  },
  "multiplayer.reconnect": {
    "fi": "Yhteys katkesi. Luo uusi kutsu yhdistääksesi uudelleen.",
    "en": "The connection was lost. Create a new invite to reconnect."
  },
  "multiplayer.players": {
    "fi": "{count} pelaajaa",
    "en": "{count} players"
  },
  "multiplayer.guestConnected": {
    "fi": "Olet mukana kutsujan pelissä.",
    "en": "You have joined the host’s game."
  },
  "multiplayer.friendConnected": {
    "fi": "Pelikaveri on mukana pelissäsi.",
    "en": "Your friend has joined your game."
  },
  "multiplayer.friendsConnected": {
    "fi": "Pelikaverit ovat mukana pelissäsi.",
    "en": "Your friends have joined your game."
  },
  "multiplayer.guestTitle": {
    "fi": "Sait kutsun yhteiseen peliin.",
    "en": "You’re invited to play together."
  },
  "multiplayer.joinTitle": {
    "fi": "Liity kaverin peliin.",
    "en": "Join your friend’s game."
  },
  "multiplayer.hostTitle": {
    "fi": "Kutsu pelikaveri mukaan.",
    "en": "Invite a friend to join."
  },
  "multiplayer.guestDescription": {
    "fi": "Yhteys avautuu, kun kutsuja hyväksyy vastauksesi.",
    "en": "You will connect when the host accepts your response."
  },
  "multiplayer.joinDescription": {
    "fi": "Avaa yhteinen peli liittämällä saamasi kutsu.",
    "en": "Paste your invite to open the shared game."
  },
  "multiplayer.hostDescription": {
    "fi": "Jokainen uusi pelaaja tarvitsee oman kutsun. Nykyinen peli jatkuu.",
    "en": "Each new player needs a separate invite. The current game continues."
  },
  "multiplayer.sendResponse": {
    "fi": "Lähetä vastaus kutsujalle",
    "en": "Send a response to the host"
  },
  "multiplayer.sendResponseHelp": {
    "fi": "Kopioi vastaus ja lähetä se takaisin kutsujalle.",
    "en": "Copy the response and send it back to the host."
  },
  "multiplayer.inviteUsed": {
    "fi": "Liittynyt pelaaja käytti oman kutsunsa.",
    "en": "The player who joined has used their invite."
  },
  "multiplayer.inviteUsedHelp": {
    "fi": "Kutsu seuraava henkilö uudella, kertakäyttöisellä linkillä.",
    "en": "Invite the next person with a new single-use link."
  },
  "multiplayer.pasteInvite": {
    "fi": "Liitä kaverin kutsu",
    "en": "Paste your friend’s invite"
  },
  "multiplayer.inviteHelp": {
    "fi": "Liitä koko kutsulinkki tai kaverilta saamasi yhteystieto.",
    "en": "Paste the complete invite link or connection details from your friend."
  },
  "multiplayer.invitePlaceholder": {
    "fi": "Liitä kutsu tähän…",
    "en": "Paste the invite here…"
  },
  "multiplayer.hostToggle": {
    "fi": "Haluan kutsua itse",
    "en": "I want to send an invite"
  },
  "multiplayer.createAnother": {
    "fi": "Luo uusi kutsu",
    "en": "Create another invite"
  },
  "multiplayer.acceptInvite": {
    "fi": "Hyväksy kutsu",
    "en": "Accept invite"
  },
  "multiplayer.cancelInvite": {
    "fi": "Peru kutsu",
    "en": "Cancel invite"
  },
  "multiplayer.leave": {
    "fi": "Poistu moninpelistä",
    "en": "Leave multiplayer"
  },
  "multiplayer.disconnect": {
    "fi": "Katkaise yhteydet",
    "en": "Disconnect players"
  },
  "multiplayer.invalidDebug": {
    "fi": "Yhteystietoa ei voi purkaa JSON-muotoon.",
    "en": "The connection details cannot be decoded as JSON."
  },
  "multiplayer.disconnectFirst": {
    "fi": "Katkaise nykyinen yhteys ennen uuden kutsun avaamista.",
    "en": "Disconnect the current connection before opening a new invite."
  },
  "multiplayer.createFirst": {
    "fi": "Luo ensin uusi kutsu pelaajalle.",
    "en": "Create a new invite for the player first."
  },
  "multiplayer.gathering": {
    "fi": "Kerätään yhteystietoja…",
    "en": "Gathering connection details…"
  },
  "multiplayer.linkLabel": {
    "fi": "Kutsulinkki – kopioi ja lähetä pelikaverille",
    "en": "Invite link – copy and send it to your friend"
  },
  "multiplayer.waiting": {
    "fi": "Odotetaan pelikaverin vastausta",
    "en": "Waiting for your friend’s response"
  },
  "multiplayer.responseLabel": {
    "fi": "Vastaus – kopioi ja lähetä kutsujalle",
    "en": "Response – copy and send it to the host"
  },
  "multiplayer.copyResponse": {
    "fi": "Kopioi vastaus",
    "en": "Copy response"
  },
  "multiplayer.responseReady": {
    "fi": "Kopioi vastaus kutsujalle. Yhteys avautuu, kun kutsuja hyväksyy sen.",
    "en": "Copy the response to the host. You will connect when the host accepts it."
  },
  "multiplayer.connecting": {
    "fi": "Yhdistetään pelaajaan…",
    "en": "Connecting to the player…"
  },
  "multiplayer.negotiationFailed": {
    "fi": "Yhteyden muodostaminen epäonnistui. Voit kokeilla uudelleen.",
    "en": "Could not establish the connection. You can try again."
  },
  "multiplayer.localLabel": {
    "fi": "Oma yhteystieto – kopioi ja lähetä pelikaverille",
    "en": "Your connection details – copy and send them to your friend"
  },
  "multiplayer.continues": {
    "fi": "Peli jatkuu mukana olevien pelaajien kanssa. {message}",
    "en": "The game continues with the remaining players. {message}"
  },
  "multiplayer.responseCopied": {
    "fi": "Vastaus kopioitu. Lähetä se kutsujalle.",
    "en": "Response copied. Send it to the host."
  },
  "multiplayer.inviteCopied": {
    "fi": "Kutsulinkki kopioitu. Lähetä se toiselle pelaajalle.",
    "en": "Invite link copied. Send it to the other player."
  },
  "multiplayer.copyManually": {
    "fi": "Kopioi valittu teksti näppäimistöllä tai selaimen valikosta.",
    "en": "Copy the selected text using your keyboard or browser menu."
  },
  "multiplayer.guessTimeout": {
    "fi": "Pelaajan vastausta ei saatu. Voit jatkaa yksin tai yhdistää uudelleen.",
    "en": "The player did not respond. You can continue alone or reconnect."
  },
  "multiplayer.guessFailed": {
    "fi": "Arvauksen käsittely epäonnistui. Voit jatkaa yksin.",
    "en": "Processing the guess failed. You can continue alone."
  },
  "multiplayer.hostLoading": {
    "fi": "Kutsuja valitsee uutta artikkelia…",
    "en": "The host is choosing a new article…"
  },
  "multiplayer.hostLoadFailed": {
    "fi": "Kutsujan artikkelin lataus epäonnistui. Odotetaan uutta peliä.",
    "en": "The host could not load the article. Waiting for a new game."
  },
  "multiplayer.invalidGame": {
    "fi": "Pelitiedot eivät kelpaa. Tarkista, että käytätte samaa peliversiota.",
    "en": "The game data is invalid. Make sure you are using the same game version."
  },
  "multiplayer.ended": {
    "fi": "Moninpeli suljettu. Voit jatkaa yksin tai muodostaa uuden yhteyden.",
    "en": "Multiplayer closed. You can continue alone or connect again."
  },
  "multiplayer.unsupported": {
    "fi": "Selain ei tue WebRTC-yhteyksiä. Käytä ajantasaista Firefoxia.",
    "en": "Your browser does not support WebRTC connections. Use an up-to-date Firefox."
  },
  "multiplayer.cancelled": {
    "fi": "Kutsu peruttu. Voit luoda uuden kutsun.",
    "en": "Invite cancelled. You can create a new invite."
  },
  "multiplayer.pasteDetails": {
    "fi": "Liitä saamasi kutsulinkki tai yhteystieto.",
    "en": "Paste the invite link or connection details you received."
  }
};

export const i18n = (() => {
  const storageKey = "denantle-language";
  const supported = (value) => value === "fi" || value === "en";
  const browserLanguage = (navigator.language || "en").toLowerCase().split(/[-_]/)[0];
  let language = supported(browserLanguage) ? browserLanguage : "en";
  try {
    const saved = localStorage.getItem(storageKey);
    if (supported(saved)) language = saved;
  } catch { /* Language selection also works when storage is unavailable. */ }

  // Descriptors keep live messages translatable, including shared guess feedback.
  const bindings = new Map();
  const message = (key, params = {}) => ({ key, params });
  const isMessage = (value) => value && typeof value === "object"
    && Object.hasOwn(translations, value.key) && value.params && typeof value.params === "object";
  function format(value) {
    if (!isMessage(value)) return String(value ?? "");
    return translations[value.key][language].replace(/\{(\w+)\}/g,
      (_, name) => format(value.params[name]));
  }
  const t = (key, params) => format(message(key, params));

  function bind(element, attribute, value) {
    if (!bindings.has(element)) bindings.set(element, new Map());
    const attributes = bindings.get(element);
    if (isMessage(value)) attributes.set(attribute, value);
    else attributes.delete(attribute);
    const translated = format(value);
    if (attribute === "textContent") element.textContent = translated;
    else element.setAttribute(attribute, translated);
  }
  const text = (element, value) => bind(element, "textContent", value);
  const attr = (element, attribute, value) => bind(element, attribute, value);
  const getMessage = (element) => bindings.get(element)?.get("textContent") ?? element.textContent;
  function error(value, params) {
    const translation = typeof value === "string" && Object.hasOwn(translations, value)
      ? message(value, params) : value;
    return Object.assign(new Error(format(translation)), { translation });
  }
  const errorMessage = (error) => error.translation ?? error.message;

  function updateLanguage() {
    document.documentElement.lang = language;
    document.querySelectorAll("[data-ui-language]").forEach((element) => { element.lang = language; });
    document.querySelectorAll("#language-select").forEach((element) => { element.value = language; });
    for (const [element, attributes] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      for (const [attribute, value] of attributes) bind(element, attribute, value);
    }
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    text(element, message(element.dataset.i18n));
  });
  for (const attribute of ["aria-label", "title", "placeholder", "content"]) {
    document.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      attr(element, attribute, message(element.getAttribute(`data-i18n-${attribute}`)));
    });
  }
  updateLanguage();
  document.getElementById("language-select")?.addEventListener("change", (event) => {
    const selected = event.target.value;
    if (!supported(selected) || selected === language) return;
    language = selected;
    try { localStorage.setItem(storageKey, language); } catch { /* Storage is optional. */ }
    updateLanguage();
    document.dispatchEvent(new Event("denantle:languagechange"));
  });

  return { t, message, isMessage, text, attr, getMessage, error, errorMessage,
    get language() { return language; } };
})();
