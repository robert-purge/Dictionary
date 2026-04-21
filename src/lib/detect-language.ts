export type Language = 'syriac' | 'arabic' | 'english'

const SYRIAC_RE = /[\u0700-\u074F]/
const ARABIC_RE = /[\u0600-\u06FF]/

export function detectLanguage(text: string): Language {
  if (SYRIAC_RE.test(text)) return 'syriac'
  if (ARABIC_RE.test(text)) return 'arabic'
  return 'english'
}
