// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

const STORAGE_KEY = 'denantle-player-name'

export function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/gu, ' ')
}

export function isPlayerName(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 32 &&
    normalizePlayerName(value) === value &&
    /[^\p{Default_Ignorable_Code_Point}\s]/u.test(value) &&
    !/\p{Cc}/u.test(value)
  )
}

export function loadPlayerName(fallback: string) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const name = saved === null ? '' : normalizePlayerName(saved)
    if (isPlayerName(name)) return name
  } catch {
    // A name still works for this page when browser storage is unavailable.
  }
  return fallback
}

export function savePlayerName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name)
  } catch {
    // Keep the current name even when the browser cannot remember it.
  }
}
