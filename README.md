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
commitin tyyppitarkistukset ja Playwright-testit ovat menneet läpi. Pagesiin
julkaistaan sama `dist/`-hakemisto, jota testit käyttivät. Epäonnistunut ajo
jättää nykyisen julkaistun version ennalleen.

## Paikallinen käynnistys

Tarvitset [NVM:n](https://github.com/nvm-sh/nvm#installing-and-updating) ja
ajantasaisen selaimen. Käynnistysskripti ottaa NVM:llä käyttöön `.nvmrc`:hen
lukitun Node.js-version (26.13.0 LTS) ja asentaa sen tarvittaessa.
Skripti asentaa npm-riippuvuudet ensimmäisellä käynnistyksellä, kääntää
TypeScriptin JavaScriptiksi ja kokoaa staattisen sivuston `dist/`-hakemistoon.

1. Avaa terminaali projektin juurihakemistossa.
2. Käynnistä paikallinen palvelin:

   ```sh
   ./start-local.sh
   ```

3. Avaa Firefoxissa [http://localhost:8000](http://localhost:8000).

Lähteiden ja sivuston tiedostojen muutokset käännetään automaattisesti.
Päivitä Firefoxin sivu nähdäksesi muutokset. Jos käännös epäonnistuu,
palvelin tarjoaa edellistä onnistunutta koontia. Palvelimen ja tiedostoseurannan
voi pysäyttää terminaalissa painamalla `Ctrl+C`.

Sovellus tarvitsee internetyhteyden Wikipedia-artikkelien hakemiseen sekä
kielimallien ensimmäiseen lataamiseen. Mallien ajoympäristö toimitetaan sivuston
mukana. Käytä paikallista palvelinta, jotta myös sanojen merkityksiä vertaileva
toiminto toimii.


## Tarkistukset ja julkaisuversio

Kaikki npm-riippuvuudet ja testit käyttävät juurihakemiston lukitustiedostoa.
Kun `.nvmrc`:n mukainen Node.js on käytössä:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run typecheck
npm test
```

`npm run format` formatoi tiedostot `biome.json`-sääntöjen mukaan. `npm run check`
tarkistaa formatoinnin, lint-säännöt ja importtien järjestyksen muuttamatta
tiedostoja. CI ajaa saman Biome-tarkistuksen ennen käännöstä ja testejä.

`npm test` kokoaa sivuston ja ajaa TypeScriptillä kirjoitetut Playwright-testit
Firefoxilla. Paikallista ajoa varten asenna Playwrightin Firefox komennolla
`npx playwright install firefox`. CI:n kanssa saman ajon saa Dockerilla:

```sh
docker compose -f tests/compose.yaml run --build --rm playwright
```

Pelkkä julkaisuversio kootaan komennolla `npm run build`. Julkaistava sisältö
on `dist/`, joka sisältää myös kolmansien osapuolten lisenssit ja Voikon
lähdepaketin. Esikatsele koontia komennolla `node tools/serve.mts`.
Selaimessa ajettava koodi ja workerit käännetään omilla TypeScript-asetuksillaan;
kehitystyökalut ja testit tyyppitarkistetaan erikseen. Vektoriworker ja sen
Transformers.js-riippuvuus bundlataan esbuildilla. ONNX-ajoympäristön WASM- ja
moduulitiedostot kopioidaan npm-paketista `dist/vendor/onnx/`-hakemistoon.

## Teknologiat

Denantle on käytännössä teknologiademo, jossa kokeillaan selaimessa ajettavia
embedding-malleja sekä selainten välistä reaaliaikaista tiedonsiirtoa.
Moninpelin yhteydenmuodostus käyttää PeerJS Cloudin julkista signalointipalvelua.

Sanojen merkityksiä verrataan MiniLM-pohjaisilla embedding-malleilla, jotka
muuttavat tekstin numeerisiksi vektoreiksi. Vektorien läheisyyden perusteella
peli tunnistaa merkitykseltään samankaltaisia sanoja. Mallit ajetaan paikallisesti
selaimessa Transformers.js:n ja WebAssemblyn avulla.

Moninpeli välittää pelitilan suoraan selainten välillä WebRTC-datakanavilla.
Valitse moninpeli ja kutsulinkin **Yhteysverkko**:

- **Lähiverkko** on samassa lähiverkossa oleville pelaajille. Se käyttää laitteiden
  omia yhteysosoitteita ilman STUN-palvelinta.
- **Internet** selvittää myös julkiset yhteysosoitteet STUN-palvelimella.
  Eri verkkojen välinen yhteys onnistuu, kun NAT- ja palomuuriasetukset sallivat sen.

Luo kutsulinkki ja jaa sama linkki kaikille pelikavereille. Valittu verkko kulkee
linkissä myös liittyjille. Verkkoa voi vaihtaa moninpeli-istunnon lopettamisen
jälkeen. Vanhat automaattikutsut käyttävät internet-tilaa.
Liittyminen tapahtuu automaattisesti PeerJS Cloudin maksuttoman julkisen
signalointipalvelun kautta ilman tiliä tai omaa API-avainta. Linkki pysyy
voimassa niin kauan kuin kutsujan moninpeli-istunto on auki. Sivun lataaminen
uudelleen tai moninpelin lopettaminen sulkee istunnon. Myös lähiverkkotilan
yhteyden aloittaminen tarvitsee internetyhteyden. Kutsulinkin sivuosoitteen pitää
olla liittyjien saavutettavissa: `localhost` toimii vain samalla koneella.

**Yhdistä käsin** -lisävalintaa ohjaa `src/feature-flags.ts`-tiedoston
`manualMultiplayer`-feature flag. Sen arvo on `false` sekä paikallisessa ajossa
että tuotantokoontiin julkaistavassa versiossa. Tällöin lisävalinta on piilossa
eivätkä aiemmat käsin tehdyt kutsulinkit käynnistä yhteydenmuodostusta.
Toiminnon saa takaisin käyttöön vaihtamalla arvoksi `true` ja kokoamalla
sivuston uudelleen. Käsin tehtävät kutsut ovat kertakäyttöisiä.
Julkisen signalointipalvelun häiriö ei katkaise jo avattuja suoria datayhteyksiä.

Internet-tila ja käsin yhdistäminen käyttävät Googlen julkista STUN-palvelinta
(`stun:stun.l.google.com:19302`) julkisten yhteysosoitteiden selvittämiseen.
TURN-välitystä ei käytetä, joten verkkojen NAT- ja palomuuriasetusten pitää
sallia suora yhteys. PeerJS ja sen riippuvuudet toimitetaan paikallisessa
koonnissa; selain ei lataa kirjastoa CDN-palvelusta.

## Lisätiedot ja lisenssit

Pelin toiminta ja tekninen toteutus on kuvattu tarkemmin dokumentissa
[GAMEPLAY_AND_IMPLEMENTATION.md](GAMEPLAY_AND_IMPLEMENTATION.md).

Sovelluksen lisenssi on [GNU GPL 3.0 tai uudempi](LICENSE). Kuvituksen lisenssit
on kuvattu tiedostossa [ARTWORK.md](ARTWORK.md) ja kolmansien osapuolten lisenssit
tiedostossa [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Denantle on teknologiademo, jolla tutkitaan selainten välistä reaaliaikaista
tiedonsiirtoa PeerJS Cloudin julkisen signalointipalvelun avulla. Sovellus on
toteutettu HTML:llä, CSS:llä ja TypeScriptillä. TypeScript käännetään selaimessa ajettavaksi
JavaScriptiksi, ja valmis sivusto julkaistaan staattisena ilman omaa
sovelluspalvelinta. Moninpeli välittää pelitilan WebRTC-datakanavien kautta;
yhteyden muodostamiseen tarvittavat SDP-yhteyskuvaukset vaihdetaan oletuksena
automaattisesti. Kutsun ja vastauksen käsinvaihto on feature flagin takana ja
oletuksena pois päältä. Googlen
STUN-palvelin auttaa muodostamaan suoran yhteyden myös eri verkkojen välille;
pelidata kulkee selainten välillä ilman TURN-välitystä. Sanojen merkitysten
vertailussa käytettävät kielimallit ajetaan paikallisesti selaimessa
Transformers.js:n ja WebAssemblyn avulla, joten myöskään tämä laskenta ei
tarvitse erillistä taustapalvelua.
