import { detectLanguage } from '@/lib/detect-language'

describe('detectLanguage', () => {
  it('detects syriac from Syriac characters', () => {
    expect(detectLanguage('ܝܟܝܕ')).toBe('syriac')
  })

  it('detects arabic from Arabic characters', () => {
    expect(detectLanguage('يُذل')).toBe('arabic')
  })

  it('detects arabic for Farsi (same Unicode block)', () => {
    expect(detectLanguage('فارسی')).toBe('arabic')
  })

  it('detects english from Latin characters', () => {
    expect(detectLanguage('abase')).toBe('english')
  })

  it('prefers syriac when both Syriac and Arabic chars present', () => {
    expect(detectLanguage('ܝܟܝܕ يُذل')).toBe('syriac')
  })

  it('defaults to english for empty string', () => {
    expect(detectLanguage('')).toBe('english')
  })
})
