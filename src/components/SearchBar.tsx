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

declare global {
  interface Window {
    keyman?: {
      init: (opts: Record<string, unknown>) => void
      attachToControl: (el: HTMLElement) => void
      setKeyboard: (keyboard: string) => Promise<void>
      isAttached: (el: HTMLElement) => boolean
      detachFromControl: (el: HTMLElement) => void
      osk?: { show: (v: boolean) => void }
    }
  }
}

export default function SearchBar({ onSearch, onCommit, results, showResults, onSelect }: Props) {
  const [value, setValue] = useState('')
  const [keyboardOn, setKeyboardOn] = useState(false)
  const [keymanReady, setKeymanReady] = useState(false)
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

  // Poll for Keyman engine to finish loading (deferred scripts take a moment)
  useEffect(() => {
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const km = window.keyman
      if (km) {
        clearInterval(poll)
        try {
          // ui:'button' enables the OSK; we hide Keyman's own button via CSS
          km.init({ attachType: 'manual', ui: 'button' })
        } catch {
          // already initialised on hot-reload
        }
        setKeymanReady(true)
        return
      }
      if (attempts >= 50) clearInterval(poll) // give up after ~10 s
    }, 200)

    return () => clearInterval(poll)
  }, [])

  // Attach / detach keyboard + show / hide OSK whenever toggle or readiness changes
  useEffect(() => {
    if (!keymanReady) return
    const km = window.keyman
    const input = inputRef.current
    if (!km || !input) return

    if (keyboardOn) {
      if (!km.isAttached(input)) km.attachToControl(input)
      km.setKeyboard('Keyboard_audo12')
        .then(() => { km.osk?.show(true) })
        .catch(() => { km.osk?.show(true) })
    } else {
      km.osk?.show(false)
      if (km.isAttached(input)) km.detachFromControl(input)
    }
  }, [keyboardOn, keymanReady])

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
          autoFocus
        />
        <button
          type="button"
          aria-label={keyboardOn ? 'Disable Assyrian keyboard' : 'Enable Assyrian keyboard'}
          title={keyboardOn ? 'Assyrian keyboard ON — click to hide' : 'Show Assyrian on-screen keyboard'}
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
    </div>
  )
}
