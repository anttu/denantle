// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

import type { FinnishForms, Language, SearchResult, VectorInfo, VectorProgress } from "./contracts.js";

export type VectorRequest =
  | { type: "clear"; revision: number }
  | { type: "index"; id: number; revision: number; title: string; text: string; language: Language }
  | { type: "search"; id: number; revision: number; text: string; limit: number };
export type VectorResponse =
  | VectorProgress
  | { type: "result"; id: number; result: VectorInfo | SearchResult[] }
  | { type: "error"; id: number; error: "vectors.processingFailed" };
export type InflectionRequest =
  | { type: "clear"; revision: number }
  | { type: "index"; revision: number; words: string[] };
export type InflectionResponse =
  | { type: "result"; revision: number; forms: FinnishForms }
  | { type: "error"; revision: number; error: "inflections.failed" };
