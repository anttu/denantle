// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

export function elementById<T extends HTMLElement>(
  id: string,
  kind: { new (): T },
): T {
  const element = document.getElementById(id)
  if (!(element instanceof kind))
    throw new Error(`Missing or invalid element: #${id}`)
  return element
}
