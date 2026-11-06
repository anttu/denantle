// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const { test, expect } = require("@playwright/test");

test("suomen worker tunnistaa oikealla Voikolla saman sanan taivutusmuodot", async ({ page }) => {
  await page.goto("/?game=invalid");
  const response = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker(new URL("src/finnish-inflections-worker.js", location.href));
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message)); };
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data); };
    worker.postMessage({ type: "index", revision: 1, words: ["kissa", "kissat", "kissan"] });
  }));
  expect(response.type).toBe("result");
  expect(response.revision).toBe(1);
  expect(new Map(response.forms).get("kissa")).toEqual(expect.arrayContaining(["kissa", "kissat", "kissan"]));
});
