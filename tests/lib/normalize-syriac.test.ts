import { normalizeSyriac } from '@/lib/normalize-syriac'

describe('normalizeSyriac', () => {
  it('removes Syriac vowel points U+0730–U+074A', () => {
    const withVowels = 'ܝ\u0733ܟ\u073Fܝ\u0732ܕ'
    expect(normalizeSyriac(withVowels)).toBe('ܝܟܝܕ')
  })

  it('leaves consonants unchanged', () => {
    expect(normalizeSyriac('ܝܟܝܕ')).toBe('ܝܟܝܕ')
  })

  it('leaves non-Syriac text unchanged', () => {
    expect(normalizeSyriac('hello')).toBe('hello')
    expect(normalizeSyriac('يُذل')).toBe('يُذل')
  })

  it('handles empty string', () => {
    expect(normalizeSyriac('')).toBe('')
  })
})
