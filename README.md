# Denantle

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
nykyisen julkaistun version ennalleen. Julkaisulähteeksi valitaan repositorion
**Settings → Pages → Build and deployment → Source → GitHub Actions** vasta,
kun tämä työnkulku on `main`-haarassa GitHubissa.

## Paikallinen käynnistys

Tarvitset Python 3:n ja ajantasaisen selaimen. Sovellus ei tarvitse pakettien
asennusta tai erillistä koontivaihetta.

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
tarvita.

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
kutsulinkillä ja vastauksella. STUN- tai TURN-palvelimia ei käytetä, joten
kokeilu painottuu suoriin yhteyksiin samassa lähiverkossa. Sanojen merkitysten
vertailussa käytettävät kielimallit ajetaan paikallisesti selaimessa
Transformers.js:n ja WebAssemblyn avulla, joten myöskään tämä laskenta ei
tarvitse erillistä taustapalvelua.
