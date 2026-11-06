// Only the API used from the unmodified Voikko 1.0.1 browser bundle.
interface VoikkoAnalysis {
  BASEFORM?: string
  PARTICIPLE?: string
  FSTOUTPUT?: string
}
interface VoikkoAnalyzer {
  analyze(word: string): VoikkoAnalysis[]
}
declare function Libvoikko(): { init(language: 'fi'): VoikkoAnalyzer }
