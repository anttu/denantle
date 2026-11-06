// SPDX-FileCopyrightText: 2026 Antero Fagerstedt
// SPDX-License-Identifier: GPL-3.0-or-later

export type Language = "fi" | "en";
export type SourceKey = Language | "simple";
export interface WikipediaSource {
  language: Language;
  baseUrl: string;
  categories: string[];
  excludedCategory: string;
  excludedSections: string[];
}
export interface Article {
  title: string;
  body: string;
  sourceKey: SourceKey;
  version: string;
  session: string;
}
export interface WordState {
  count: number;
  revealed: boolean;
  score: number;
  guess: string | null;
  latestScore: number | null;
}
export interface RecentGuess { word: string; matches: number; nearMatches: number }
export interface GameState {
  language: Language;
  words: Map<string, WordState>;
  titleWords: Set<string>;
  titleSolved: boolean;
  latestGuess: string | null;
  recentGuesses: RecentGuess[];
  guesses: Map<string, boolean>;
  total: number;
  revealed: number;
  active: boolean;
  busy: boolean;
  inflectionsLoading: boolean;
}
export interface SharedGameState {
  guesses: [string, boolean][];
  recent: RecentGuess[];
  latestGuess: string | null;
  words: (Omit<WordState, "count"> & { word: string })[];
}
export interface VectorInfo { title: string; wordCount: number; dimensions: number; model: string }
export interface SearchResult { word: string; count: number; score: number }
export type VectorProgress = { type: "progress"; id: number } & (
  { stage: "model" } | { stage: "index"; completed: number; total: number }
);
export interface ArticleVectors {
  clear(): void;
  build(title: string, text: string, onProgress?: (progress: VectorProgress) => void, language?: Language): Promise<VectorInfo>;
  search(text: string, limit?: number): Promise<SearchResult[]>;
  readonly info: VectorInfo | null;
}
export type FinnishForms = [string, string[]][];
export interface FinnishInflections {
  clear(): void;
  build(words: string[]): Promise<void>;
  matchingForms(guess: string): Set<string>;
}
export type GuessHandler = (guess: string) => boolean | void | Promise<boolean | void>;
export type MultiplayerMessage =
  | { type: "guess"; session: string | undefined; guess: string; request: number }
  | { type: "players"; count: number }
  | { type: "loading" | "unavailable" }
  | { type: "game"; article: Article; state: SharedGameState }
  | { type: "state"; session: string | undefined; state: SharedGameState; request: number | null; accepted: boolean; feedback: unknown };
export type ReceivedMessage =
  | Exclude<MultiplayerMessage, { type: "game" | "state" }>
  | { type: "game"; article: unknown; state: unknown }
  | { type: "state"; session: string | undefined; state: unknown; request: number | null; accepted: boolean; feedback: unknown };
