// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  reporter: "list",
  use: {
    browserName: "firefox",
    baseURL: "http://127.0.0.1:8000",
  },
  webServer: {
    command: "python3 -m http.server 8000 --bind 127.0.0.1 --directory ..",
    url: "http://127.0.0.1:8000",
  },
});
