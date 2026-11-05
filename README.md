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

## Selaintesti containerissa

Testit ja niiden paikalliset ajoasetukset ovat `tests/`-hakemistossa.
Tarvitset Dockerin ja Docker Composen. Suorita projektin juurihakemistossa:

```sh
docker compose -f tests/compose.yaml run --build --rm playwright
```

Container käynnistää paikallisen palvelimen ja ajaa Playwright-testit
headless-Firefoxilla. Testit tarkistavat sivun avautumisen, pelimuodon vaihtamisen,
kutsujan yhteyspaneelin mobiiliasettelun sekä käsin liittymisen virhetilan.
Yhteystesti muodostaa oikean WebRTC-yhteyden kahden erillisen Firefox-istunnon
välille kutsulinkillä ja vastauksella. Se tarkistaa pelaajamäärän, käytettyjen
yhteystietojen tyhjentämisen ja viestin saapumisen datakanavan kautta.
Virheellinen pelitunniste ohittaa Wikipedia-haun,
joten testit eivät tarvitse Wikipediaa tai kielimalleja. Container käyttää
Dockerin bridge-verkkoa, jotta Firefoxilla on WebRTC:n vaatima verkkoliitäntä ja
oletusreitti. Ensimmäinen koonti tarvitsee internetyhteyden imagen ja npm-pakettien
lataamiseen. Komennon paluuarvo kertoo testin tuloksen.
JUnit-raportti tallentuu tiedostoon `tests/reports/junit.xml`.

GitHub Actions ajaa saman komennon jokaisella pushilla ja pull requestissa.
Testitulokset julkaistaan ajon Summary-osiossa myös testin epäonnistuessa.
Työnkulku on tiedostossa [.github/workflows/playwright.yaml](.github/workflows/playwright.yaml).

## Moninpeli

Useampi pelaaja voi ratkaista samaa artikkelia yhdessä ilman peli- tai
signalointipalvelinta. Oletuksena valittuna on **Yksinpeli**. Kutsuja valitsee
**Moninpeli samassa lähiverkossa**.

1. Kutsuja painaa **Luo kutsu** tai aloittaa uuden pelin moninpelin ollessa
   päällä ja kopioi syntyvän **kutsulinkin** pelikaverille.
2. Pelikaveri avaa linkin. Moninpeli käynnistyy ja hyväksyy kutsun
   automaattisesti. Pelikaveri kopioi syntyvän vastauksensa takaisin kutsujalle.
3. Kutsuja liittää vastauksen kenttään **Liitä kaverin vastaus** ja painaa
   **Hyväksy vastaus**.

Kutsujan paneelissa kutsulinkki ja vastaus ovat rinnakkain, mobiilissa allekkain.
**Aloita alusta** peruu keskeneräisen kutsun. Kutsun voi liittää myös käsin
valitsemalla **Saitko kutsun? Liity kaverin peliin**.

Yhteyden avauduttua **Yhteys muodostettu** -palkki näyttää pelaajamäärän.
Kaikki näkevät kutsujan artikkelin, aiemmat arvaukset, paljastukset ja
lähisanavihjeet. Kaikki voivat arvata; kutsuja valitsee uuden pelin ja kielen.
Kutsutun yhteystietokentät piilotetaan, ja käytetyt yhteystiedot tyhjennetään.

Kutsuja voi avata **Kutsu lisää pelaajia** -osion ja painaa **Luo uusi kutsu**.
Jokaiselle uudelle pelaajalle luodaan oma kutsu, jonka vastaus hyväksytään kuten
ensimmäisen pelaajan. **Peru kutsu** peruu vain keskeneräisen kutsun.
Uuden pelaajan kutsuminen tai yhden pelaajan poistuminen ei katkaise muiden
yhteyksiä. Kutsujan **Katkaise yhteydet** sulkee kaikki hänen yhteytensä;
kutsutun **Poistu moninpelistä** sulkee vain hänen oman yhteytensä.

Valitsemalla **Yksinpeli** voit jatkaa yksin. Sivun lataaminen uudelleen
katkaisee kyseisen selaimen yhteydet, ja uudelleen yhdistäminen vaatii uuden kättelyn.
Kutsulinkki toimii vain niin kauan kuin kutsujan sivu ja kutsu ovat avoinna.
Linkin osoitteen pitää olla myös pelikaverin saavutettavissa.

Kutsun voi edelleen liittää ja hyväksyä käsin. Kutsulinkin yhteystiedot
kulkevat osoitteen #join=-osassa. Selain purkaa ne häviöttömästi ennen
yhteyden muodostamista. Pelin tunniste ja sivun nykyinen polku säilyvät linkissä.
**Yhteyden tekniset tiedot** -osion **payload debug** -valinta näyttää oman ja pelikaverin yhteystiedot
kokonaisina, purettuina JSON-kuvauksina yhteyden muodostamisen aikana.
Valinta on oletuksena pois päältä, ja se nollataan yhteyden avauduttua.

Yhteys kulkee suoraan selainten välillä WebRTC:llä ilman yhteys- tai
välityspalveluja ja toimii yleensä samassa lähiverkossa. Osa palomuureista ja
NAT-verkoista estää suoran yhteyden. Vaihda yhteystiedot vain pelikaverisi kanssa,
sillä ne sisältävät yhteyden muodostamiseen tarvittavat tiedot.

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
