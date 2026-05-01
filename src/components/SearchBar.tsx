'use client'

import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/types/dictionary'
import OnScreenKeyboard from './OnScreenKeyboard'

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
  const [keyboardOn, setKeyboardOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const open = showResults && results.length > 0
  const script = detectScript(value)

  // Debounced search
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { onSearch(value) }, 200)
    return () => clearTimeout(timer.current)
  }, [value, onSearch])

  // Insert a character at the current cursor position
  const insertChar = (ch: string) => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end   = input.selectionEnd   ?? value.length
    const next  = value.slice(0, start) + ch + value.slice(end)
    setValue(next)
    const pos = start + ch.length
    requestAnimationFrame(() => {
      input.setSelectionRange(pos, pos)
      input.focus()
    })
  }

  // Delete one character before cursor (or the current selection)
  const deleteChar = () => {
    const input = inputRef.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end   = input.selectionEnd   ?? value.length
    let next: string
    let pos: number
    if (start !== end) {
      next = value.slice(0, start) + value.slice(end)
      pos  = start
    } else if (start > 0) {
      next = value.slice(0, start - 1) + value.slice(start)
      pos  = start - 1
    } else {
      return
    }
    setValue(next)
    requestAnimationFrame(() => {
      input.setSelectionRange(pos, pos)
      input.focus()
    })
  }

  return (
    <div className="search-wrapper">
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit?.() }}
          placeholder="Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
          className={`search-input font-english${open ? ' dropdown-open' : ''}`}
          dir={script === 'latin' ? 'ltr' : 'rtl'}
          style={{ paddingRight: '3.2rem' }}
          inputMode={keyboardOn ? 'none' : undefined}
          autoFocus
        />
        <button
          type="button"
          aria-label={keyboardOn ? 'Hide Assyrian keyboard' : 'Show Assyrian keyboard'}
          title={keyboardOn ? 'Hide on-screen keyboard' : 'Show Assyrian on-screen keyboard'}
          onClick={() => setKeyboardOn((v) => !v)}
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.4rem',
            lineHeight: 1,
            color: keyboardOn ? 'var(--color-blue)' : 'var(--color-muted)',
            padding: '0.2rem',
          }}
        >
          ⌨
        </button>
      </div>

      {open && (
        <div className="search-dropdown">
          {results.map((r) => (
            <div
              key={r.id}
              className="search-dropdown-item"
              onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
            >
              <span className="font-english">{r.english}</span>
              <div className="item-previews">
                {r.variants[0]?.assyrian && (
                  <span className="font-assyrian translation-assyrian item-preview">
                    {r.variants[0].assyrian}
                  </span>
                )}
                {r.variants[0]?.arabic && (
                  <span className="font-arabic translation-arabic item-preview">
                    {r.variants[0].arabic}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {keyboardOn && (
        <OnScreenKeyboard
          onKey={insertChar}
          onBackspace={deleteChar}
          onEnter={onCommit}
        />
      )}
    </div>
  )
}
