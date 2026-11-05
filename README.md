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

## Lisätiedot ja lisenssit

Pelin toiminta ja tekninen toteutus on kuvattu tarkemmin dokumentissa
[GAMEPLAY_AND_IMPLEMENTATION.md](GAMEPLAY_AND_IMPLEMENTATION.md).

Sovelluksen lisenssi on [GNU GPL 3.0 tai uudempi](LICENSE). Kuvituksen lisenssit
on kuvattu tiedostossa [ARTWORK.md](ARTWORK.md) ja kolmansien osapuolten lisenssit
tiedostossa [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
