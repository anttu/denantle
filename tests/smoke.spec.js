// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const { test, expect } = require("@playwright/test");

test("pelimuodon voi vaihtaa yksinpelistä kaksinpeliin ja takaisin", async ({ page }) => {
  // Virheellinen pelitunniste estää Wikipedia-haun ja kielimallien lataamisen.
  await page.goto("/?game=invalid");

  await expect(page).toHaveTitle("Denantle");
  await expect(page.getByRole("heading", { name: "Denantle", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Yksinpeli", exact: true })).toBeChecked();

  const createInvite = page.getByRole("button", { name: "Luo kutsu", exact: true });
  await expect(createInvite).toBeHidden();

  await page.getByText("Kaksinpeli samassa lähiverkossa", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Kaksinpeli samassa lähiverkossa" })).toBeChecked();
  await expect(createInvite).toBeVisible();

  await page.getByText("Yksinpeli", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "Yksinpeli", exact: true })).toBeChecked();
  await expect(createInvite).toBeHidden();
});
