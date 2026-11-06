// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  reporter: [
    ["list"],
    ["junit", { outputFile: "reports/junit.xml" }],
  ],
  use: {
    browserName: "firefox",
    locale: "fi-FI",
    baseURL: "http://127.0.0.1:8000",
  },
  webServer: {
    command: "python3 -m http.server 8000 --bind 127.0.0.1 --directory ..",
    url: "http://127.0.0.1:8000",
  },
});
