// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

// Defaults for production builds. Local development overrides are kept below.
export const featureFlags = {
  // Controls multiplayer discovery in the UI; shared invitations still work.
  multiplayer: false,
  manualMultiplayer: false,
}

export const developmentFeatureFlags = {
  ...featureFlags,
  multiplayer: true,
}
