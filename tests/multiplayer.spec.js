// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/?game=invalid");
  await page.getByText("Moninpeli samassa lähiverkossa", { exact: true }).click();
});

test("kutsuja näkee molemmat yhteyden muodostamisen vaiheet myös mobiilissa", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Yksi arvoitus. Kaksi päätä." })).toBeVisible();
  await expect(page.getByText("Sama lähiverkko", { exact: true })).toBeVisible();
  const sendStep = page.getByText("Lähetä kutsu", { exact: true });
  const answerStep = page.getByText("Liitä kaverin vastaus", { exact: true });
  await expect(sendStep).toBeVisible();
  await expect(answerStep).toBeVisible();
  await expect(page.getByRole("button", { name: "Luo kutsu", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Hyväksy vastaus", exact: true })).toBeDisabled();
  // A reply cannot be accepted before the host has created its invitation.
  await page.locator("#multiplayer-remote").fill("vastaus ilman kutsua");
  await expect(page.getByRole("button", { name: "Hyväksy vastaus", exact: true })).toBeDisabled();

  await page.setViewportSize({ width: 375, height: 850 });
  await expect(sendStep).toBeVisible();
  await expect(answerStep).toBeVisible();
  const sendBox = await sendStep.boundingBox();
  const answerBox = await answerStep.boundingBox();
  expect(answerBox.y).toBeGreaterThan(sendBox.y + sendBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("kutsun voi liittää käsin ja palata omaan kutsuun virheellisen kutsun jälkeen", async ({ page }) => {
  await page.getByRole("button", { name: "Saitko kutsun? Liity kaverin peliin" }).click();
  const accept = page.getByRole("button", { name: "Hyväksy kutsu", exact: true });
  await expect(accept).toBeDisabled();
  await expect(page.getByRole("button", { name: "Luo kutsu", exact: true })).toBeHidden();
  await page.getByLabel("Liitä kaverin kutsu").fill("virheellinen kutsu");
  await expect(accept).toBeEnabled();
  await accept.click();
  await expect(page.locator("#multiplayer-error")).toContainText("Kutsu ei kelpaa");

  await page.getByRole("button", { name: "Haluan kutsua itse", exact: true }).click();
  await expect(page.getByRole("button", { name: "Luo kutsu", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Hyväksy vastaus", exact: true })).toBeDisabled();
  await expect(page.locator("#multiplayer-remote")).toHaveValue("");
  await expect(page.locator("#multiplayer-error")).toBeEmpty();
});
