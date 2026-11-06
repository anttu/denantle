// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  reporter: [
    ["list"],
    ["junit", { outputFile: fileURLToPath(new URL("./reports/junit.xml", import.meta.url)) }],
  ],
  use: {
    browserName: "firefox",
    locale: "fi-FI",
    baseURL: "http://127.0.0.1:8000",
  },
  webServer: {
    command: "node tools/serve.mts",
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    url: "http://127.0.0.1:8000",
  },
});
