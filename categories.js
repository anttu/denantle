// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const wikipediaSources = {
  simple: {
    name: "Simple English Wikipedia",
    language: "en",
    baseUrl: "https://simple.wikipedia.org",
    // https://simple.wikipedia.org/wiki/Wikipedia:Categories#Category_tree
    categories: [
      "Category:Everyday life", "Category:Geography", "Category:History",
      "Category:Knowledge", "Category:Language", "Category:Literature",
      "Category:Religion", "Category:Science",
    ],
    excludedCategory: "Category:People",
    excludedSections: ["gallery", "references", "other websites", "related pages", "bibliography"],
  },
  fi: {
    name: "Suomenkielinen Wikipedia",
    language: "fi",
    baseUrl: "https://fi.wikipedia.org",
    categories: [
      "Luokka:Maantiede", "Luokka:Historia", "Luokka:Tieto", "Luokka:Kieli",
      "Luokka:Kirjallisuus", "Luokka:Uskonto", "Luokka:Tiede",
    ],
    excludedCategory: "Luokka:Henkilöt",
    excludedSections: [
      "kuvia", "kuvagalleria", "galleria", "lähteet", "viitteet",
      "aiheesta muualla", "katso myös", "kirjallisuutta",
    ],
  },
};
