// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { BrowserContext } from '@playwright/test'

export async function enableManualMultiplayer(context: BrowserContext) {
  await context.route('**/src/feature-flags.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export const featureFlags = { manualMultiplayer: true }',
    }),
  )
}
