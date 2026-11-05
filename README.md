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

## Moninpeli

Kaksi pelaajaa voi ratkaista samaa artikkelia yhdessä ilman peli- tai
signalointipalvelinta. Kutsuja kytkee **Moninpeli** päälle.

1. Kutsuja painaa **Luo kutsu** tai aloittaa uuden pelin moninpelin ollessa
   päällä ja kopioi syntyvän **kutsulinkin** pelikaverille.
2. Pelikaveri avaa linkin. Moninpeli käynnistyy ja hyväksyy kutsun
   automaattisesti. Pelikaveri kopioi syntyvän vastauksensa takaisin kutsujalle.
3. Kutsuja liittää vastauksen kenttään **Pelikaverin yhteystieto** ja painaa
   **Hyväksy vastaus**.

Yhteyden avauduttua molemmat näkevät kutsujan artikkelin, aiemmat arvaukset,
paljastukset ja lähisanavihjeet. Kumpikin voi arvata; kutsuja valitsee uuden pelin
ja kielen. Poistamalla moninpelin valinnan voit jatkaa yksin. Sivun lataaminen
uudelleen katkaisee yhteyden, ja uudelleen yhdistäminen vaatii uuden kättelyn.
Kutsulinkki toimii vain niin kauan kuin kutsujan sivu ja kutsu ovat avoinna.
Linkin osoitteen pitää olla myös pelikaverin saavutettavissa.

Kutsun voi edelleen liittää ja hyväksyä käsin. Kutsulinkin yhteystiedot
kulkevat osoitteen #join=-osassa. Selain purkaa ne häviöttömästi ennen
yhteyden muodostamista. Pelin tunniste ja sivun nykyinen polku säilyvät linkissä.
Moninpelin **payload debug** -valinta näyttää oman ja pelikaverin yhteystiedot
kokonaisina, purettuina JSON-kuvauksina. Valinta on oletuksena pois päältä.

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
