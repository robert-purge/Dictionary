import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '@/components/SearchBar'

describe('SearchBar', () => {
  it('renders with placeholder text', () => {
    render(<SearchBar onSearch={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Search in English/i)).toBeInTheDocument()
  })

  it('calls onSearch after 200ms debounce', async () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abase' } })
    act(() => { vi.advanceTimersByTime(250) })
    expect(onSearch).toHaveBeenCalledWith('abase')
    vi.useRealTimers()
  })
})
