// The bundled Compromise API used by the game; vendor code stays unmodified.
interface CompromiseDocument {
  has(tag: string): boolean
  clone(): CompromiseDocument
  tag(tag: string): CompromiseDocument
  nouns(): CompromiseDocument
  toPlural(): CompromiseDocument
  out(format: 'array'): string[]
  verbs(): { conjugate(): Record<string, string>[] }
  adjectives(): { conjugate(): { Comparative: string; Superlative: string }[] }
}
declare function nlp(text: string): CompromiseDocument
