// Syriac combining vowel points: U+0730 to U+074A
const SYRIAC_VOWELS = /[\u0730-\u074A]/g

export function normalizeSyriac(text: string): string {
  return text.replace(SYRIAC_VOWELS, '')
}
