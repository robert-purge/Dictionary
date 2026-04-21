import type { Entry, Variant, SearchResult } from '@/types/dictionary'

describe('dictionary types', () => {
  it('Variant allows null farsi', () => {
    const v: Variant = {
      id: 1, number: 1,
      assyrian: 'ܝܟܝܕ', assyrian_normalized: 'ܝܟܝܕ',
      arabic: 'يُذل', farsi: null,
      example_assyrian: null, example_arabic: null,
    }
    expect(v.farsi).toBeNull()
  })

  it('SearchResult contains entry fields and variants array', () => {
    const r: SearchResult = { id: 1, english: 'abase', part_of_speech: 'vt.', variants: [] }
    expect(r.english).toBe('abase')
  })
})
