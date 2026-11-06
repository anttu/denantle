<p align="center">
  <img src="images/denantle-icon.png" alt="" width="80">
</p>

<h1 align="center">
  <img src="images/denantle-mark.png" alt="" width="280"><br>
  <img src="images/denantle-wordmark.png" alt="Denantle" width="280">
</h1>

<p align="center">
  <strong>Pieni arvoitus. Sana kerrallaan.</strong><br>
  Paljasta Wikipedia-artikkeli arvaamalla sanoja.
</p>

<p align="center">
  <a href="https://anttu.github.io/denantle/"><strong>Pelaa selaimessa</strong></a>
  &middot;
  <a href="#paikallinen-käynnistys">Käynnistä paikallisesti</a>
  &middot;
  <a href="GAMEPLAY_AND_IMPLEMENTATION.md">Näin peli toimii</a>
</p>

Denantle on selaimessa pelattava sananarvauspeli, jossa Wikipedia-artikkelin
otsikko ja teksti on peitetty. Tarkoituksena on päätellä artikkelin aihe ja
paljastaa sen otsikko arvaamalla sanoja. Oikeat arvaukset paljastavat sanoja ja
niiden taivutusmuotoja, ja merkitykseltään läheiset arvaukset antavat vihjeitä.

Artikkelin voi valita suomenkielisestä, englanninkielisestä tai Simple English
Wikipediasta. Arvausten käsittely ja sanojen merkitysten vertailu tehdään
paikallisesti selaimessa.

## Julkaistu sivu

Sovellus on julkaistu GitHub Pagesissa: [https://anttu.github.io/denantle/](https://anttu.github.io/denantle/).

Pages-julkaisu tapahtuu GitHub Actionsissa vain `main`-haaran pushista, kun saman
commitin Playwright-testit ovat menneet läpi. Epäonnistunut testiajo jättää
nykyisen julkaistun version ennalleen.

## Paikallinen käynnistys

Tarvitset [NVM:n](https://github.com/nvm-sh/nvm#installing-and-updating) ja
ajantasaisen selaimen. Käynnistysskripti ottaa NVM:llä käyttöön `.nvmrc`:hen
lukitun Node.js-version (26.13.0 LTS) ja asentaa sen tarvittaessa.
Sovellus ei tarvitse npm-pakettien asennusta tai erillistä koontivaihetta.

1. Avaa terminaali projektin juurihakemistossa.
2. Käynnistä paikallinen palvelin:

   ```sh
   ./start-local.sh
   ```

3. Avaa Firefoxissa [http://localhost:8000](http://localhost:8000).

Palvelimen voi pysäyttää terminaalissa painamalla `Ctrl+C`.

Sovellus tarvitsee internetyhteyden Wikipedia-artikkelien hakemiseen sekä
kielimallien ja niiden ajoympäristön ensimmäiseen lataamiseen. Käytä paikallista
palvelinta, jotta myös sanojen merkityksiä vertaileva toiminto toimii.


## Teknologiat

Denantle on käytännössä teknologiademo, jossa kokeillaan selaimessa ajettavia
embedding-malleja, sekä selainten välistä reaaliaikaista tiedonsiirtoa ilman
signalointipalvelinta.

Sanojen merkityksiä verrataan MiniLM-pohjaisilla embedding-malleilla, jotka
muuttavat tekstin numeerisiksi vektoreiksi. Vektorien läheisyyden perusteella
peli tunnistaa merkitykseltään samankaltaisia sanoja. Mallit ajetaan paikallisesti
selaimessa Transformers.js:n ja WebAssemblyn avulla.

Moninpeli välittää pelitilan suoraan selainten välillä WebRTC-datakanavilla.
Signalointi eli yhteyden muodostamiseen tarvittavien tietojen vaihto tehdään
käsin kutsulinkillä ja vastauksella, joten erillistä signalointipalvelinta ei
tarvita. Kaikki moninpeliyhteydet käyttävät Googlen julkista STUN-palvelinta
(`stun:stun.l.google.com:19302`) julkisten yhteysosoitteiden selvittämiseen.
Tämä mahdollistaa suoran yhteyden myös eri verkoissa olevien pelaajien välillä,
jos verkkojen NAT- ja palomuuriasetukset sallivat sen. TURN-välitystä ei käytetä.

## Lisätiedot ja lisenssit

Pelin toiminta ja tekninen toteutus on kuvattu tarkemmin dokumentissa
[GAMEPLAY_AND_IMPLEMENTATION.md](GAMEPLAY_AND_IMPLEMENTATION.md).

Sovelluksen lisenssi on [GNU GPL 3.0 tai uudempi](LICENSE). Kuvituksen lisenssit
on kuvattu tiedostossa [ARTWORK.md](ARTWORK.md) ja kolmansien osapuolten lisenssit
tiedostossa [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Denantle on teknologiademo, jolla tutkitaan selainten välistä reaaliaikaista
tiedonsiirtoa ilman erillistä signalointipalvelinta. Sovellus on toteutettu
HTML:llä, CSS:llä ja JavaScriptillä ilman käyttöliittymäkehystä tai
koontivaihetta, joten sen voi julkaista staattisena sivustona ilman omaa
sovelluspalvelinta. Moninpeli välittää pelitilan WebRTC-datakanavien kautta;
yhteyden muodostamiseen tarvittavat SDP-yhteyskuvaukset vaihdetaan käsin
kutsulinkillä ja vastauksella. Googlen STUN-palvelin auttaa muodostamaan suoran
yhteyden myös eri verkkojen välille; pelidata kulkee selainten välillä ilman
TURN-välitystä. Sanojen merkitysten
vertailussa käytettävät kielimallit ajetaan paikallisesti selaimessa
Transformers.js:n ja WebAssemblyn avulla, joten myöskään tämä laskenta ei
tarvitse erillistä taustapalvelua.
