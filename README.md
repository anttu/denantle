# Wikipedia reader

A static page that fetches a Simple English Wikipedia article and displays its
title and body text. No application server, dependencies, API key, or build step.

Keep `index.html`, `wikipedia.js`, `categories.js`, and `favicon.ico` in the same
directory, with the icon PNGs in `images/`. Open `index.html` in a current browser,
or upload these files and the icon PNGs to a static web host. An internet
connection is required to fetch articles.

`images/denantle-icon.png` is the transparent face icon displayed beside the page
heading; the smaller PNGs and `favicon.ico` provide browser and touch icons.

The page automatically loads a random Simple English Wikipedia article. Click
**Satunnainen artikkeli** to choose another one. Redirects are followed, and
missing articles and connection failures are shown on the page.

Articles are chosen from the groups listed in
`categories.js`, including their subcategories. The search starts from Everyday
life, Geography, History, Knowledge, Language, Literature, Religion, and Science;
the People category is skipped. Category branches and articles are chosen at
random, so articles do not all have the same probability of being selected.

Content comes from the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Main_page)
at `https://simple.wikipedia.org/w/api.php`, using `prop=extracts` and
`explaintext=1`. The page requests the full text extract, including sections
after the introduction. Gallery, References, and Other websites sections and their
subsections are removed from the displayed text. Images, tables, and other content excluded by
[TextExtracts](https://www.mediawiki.org/wiki/Extension:TextExtracts) are not displayed.
Text is rendered as text, preserving line breaks without inserting remote HTML.

Each article includes a link to the original Simple English Wikipedia page and its
[CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/).
