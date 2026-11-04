# Wikipedia reader

A static page that fetches an English Wikipedia article and displays its title
and body text. No application server, dependencies, API key, or build step.

Keep `index.html` and `wikipedia.js` in the same directory. Open `index.html` in
a current browser, or upload both files to a static web host. An internet
connection is required to fetch articles.

The page loads **Helsinki** automatically. Enter another English article title
and click **Hae artikkeli** or press Enter to load it. Redirects are followed,
and missing articles and connection failures are shown on the page.

Content comes from the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
at `https://en.wikipedia.org/w/api.php`, using `prop=extracts` and
`explaintext=1`. The page requests the full text extract, including sections
after the introduction. Images, tables, and other content excluded by
[TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts) are not displayed.
Text is rendered as text, preserving line breaks without inserting remote HTML.

Each article includes a link to the original Wikipedia page and its
[CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/).
