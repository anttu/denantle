// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import { test, expect } from "@playwright/test";

test("moninpeliviestien tarkistus hyväksyy sopimuksen ja hylkää väärät tyypit sekä rajat", async ({ page }) => {
  await page.goto("/?game=invalid");
  const accepted = await page.evaluate(async () => {
    const protocol: typeof import("../src/multiplayer.js") = await import(new URL("src/multiplayer.js", location.href).href);
    const cases: [unknown, boolean][] = [
      [{ type: "guess", guess: "river", request: 1, session: "abc" }, false],
      [{ type: "guess", guess: "river", request: 0 }, false],
      [{ type: "guess", guess: "river", request: 1.5 }, false],
      [{ type: "guess", guess: "river", request: 1, session: 123 }, false],
      [{ type: "guess", guess: "x".repeat(201), request: 1 }, false],
      [{ type: "players", count: 2 }, true],
      [{ type: "players", count: 1 }, true],
      [{ type: "players", count: "2" }, true],
      [{ type: "loading" }, false],
      [{ type: "loading" }, true],
      [null, true],
      [{ type: "state", session: "abc", request: null, accepted: true, state: {} }, true],
      [{ type: "state", session: "abc", request: null, accepted: "yes", state: {} }, true],
    ];
    return cases.map(([message, guest]) => {
      try { protocol.validateMultiplayerMessage(message, guest); return true; } catch { return false; }
    });
  });
  expect(accepted).toEqual([true, false, false, false, false, true, false, false, false, true, false, true, false]);
});

test("kutsun pakkaus säilyttää yhteyskuvauksen ja Pagesin pelilinkin", async ({ page }) => {
  await page.goto("/?game=invalid");
  const invitation = await page.evaluate(async () => {
    const { createInviteUrl, decodeSignalingPayload } = await import(new URL("src/signaling-payload.js", location.href).href) as typeof import("../src/signaling-payload.js");
    const payload = '{"denantle":1,"description":{"type":"offer","sdp":"v=0\\r\\ns=-\\r\\nt=0 0\\r\\n"}}';
    const url = createInviteUrl(payload, "https://example.org/denantle/?game=fi-12345");
    return { url, decoded: decodeSignalingPayload(url), legacy: decodeSignalingPayload(payload) };
  });
  expect(invitation.url).toMatch(/^https:\/\/example\.org\/denantle\/\?game=fi-12345#join=D1:/);
  const original = '{"denantle":1,"description":{"type":"offer","sdp":"v=0\\r\\ns=-\\r\\nt=0 0\\r\\n"}}';
  expect(invitation.decoded).toBe(original);
  expect(invitation.legacy).toBe(original);
});
