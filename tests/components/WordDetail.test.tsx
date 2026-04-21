import { render, screen } from '@testing-library/react'
import WordDetail from '@/components/WordDetail'
import type { SearchResult } from '@/types/dictionary'

const mockResult: SearchResult = {
  id: 1, english: 'abase', part_of_speech: 'vt.',
  variants: [{
    id: 1, number: 1,
    assyrian: 'ܝܟܝܕ، ܝܟܡܝܕ', assyrian_normalized: 'ܝܟܝܕ ܝܟܡܝܕ',
    arabic: 'يُذل، يحقّر', farsi: null,
    example_assyrian: null, example_arabic: null,
  }],
}

describe('WordDetail', () => {
  it('shows the English headword', () => {
    render(<WordDetail result={mockResult} />)
    expect(screen.getByText('abase')).toBeInTheDocument()
  })

  it('shows Assyrian translation with dir=rtl', () => {
    render(<WordDetail result={mockResult} />)
    const el = screen.getByText('ܝܟܝܕ، ܝܟܡܝܕ')
    expect(el).toHaveAttribute('dir', 'rtl')
  })

  it('shows Arabic translation with dir=rtl', () => {
    render(<WordDetail result={mockResult} />)
    const el = screen.getByText('يُذل، يحقّر')
    expect(el).toHaveAttribute('dir', 'rtl')
  })

  it('shows not-available message when farsi is null', () => {
    render(<WordDetail result={mockResult} />)
    expect(screen.getByText(/not yet available/i)).toBeInTheDocument()
  })

  it('shows empty state when result is null', () => {
    render(<WordDetail result={null} />)
    expect(screen.getByText(/Search for a word/i)).toBeInTheDocument()
  })
})
