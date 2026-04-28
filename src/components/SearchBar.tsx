'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/types/dictionary'

interface Props {
  onSearch: (query: string) => void
  onCommit?: () => void
  results: SearchResult[]
  showResults: boolean
  onSelect: (result: SearchResult) => void
}

function detectScript(text: string): 'syriac' | 'arabic' | 'latin' {
  if (/[܀-ݏ]/.test(text)) return 'syriac'
  if (/[؀-ۿ]/.test(text)) return 'arabic'
  return 'latin'
}

export default function SearchBar({ onSearch, onCommit, results, showResults, onSelect }: Props) {
  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const open = showResults && results.length > 0
  const script = detectScript(value)

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { onSearch(value) }, 200)
    return () => clearTimeout(timer.current)
  }, [value, onSearch])

  return (
    <div className="search-wrapper">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit?.() }}
        placeholder="Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
        className={`search-input font-english${open ? ' dropdown-open' : ''}`}
        dir={script === 'latin' ? 'ltr' : 'rtl'}
        autoFocus
      />

      {open && (
        <div className="search-dropdown">
          {results.map((r) => (
            <div
              key={r.id}
              className="search-dropdown-item"
              onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
            >
              <span className="font-english">{r.english}</span>
              <span className="item-preview font-assyrian">
                {r.variants[0]?.assyrian ?? ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
