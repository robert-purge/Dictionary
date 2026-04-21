import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultsList from '@/components/ResultsList'
import type { SearchResult } from '@/types/dictionary'

const mockResults: SearchResult[] = [
  { id: 1, english: 'abase', part_of_speech: 'vt.', variants: [] },
  { id: 2, english: 'abandon', part_of_speech: 'vt.', variants: [] },
]

describe('ResultsList', () => {
  it('renders all result words', () => {
    render(<ResultsList results={mockResults} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText('abase')).toBeInTheDocument()
    expect(screen.getByText('abandon')).toBeInTheDocument()
  })

  it('calls onSelect when a result is clicked', async () => {
    const onSelect = vi.fn()
    render(<ResultsList results={mockResults} selected={null} onSelect={onSelect} />)
    await userEvent.click(screen.getByText('abase'))
    expect(onSelect).toHaveBeenCalledWith(mockResults[0])
  })

  it('marks the selected result with data-selected=true', () => {
    render(<ResultsList results={mockResults} selected={mockResults[0]} onSelect={vi.fn()} />)
    const item = screen.getByText('abase').closest('[data-selected]')
    expect(item).toHaveAttribute('data-selected', 'true')
  })

  it('shows empty state when results array is empty', () => {
    render(<ResultsList results={[]} selected={null} onSelect={vi.fn()} />)
    expect(screen.getByText(/No results/i)).toBeInTheDocument()
  })
})
