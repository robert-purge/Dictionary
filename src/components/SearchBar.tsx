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

  // Initialize Keyman once the engine + keyboard scripts have loaded
  useEffect(() => {
    if (!inputRef.current) return
    const input = inputRef.current

    function tryInit() {
      const km = window.keyman
      if (!km) return
      try {
        km.init({ attachType: 'manual', ui: 'none' })
      } catch {
        // already initialised
      }
    }

    // Scripts are deferred so they may not be ready immediately
    if (document.readyState === 'complete') {
      tryInit()
    } else {
      window.addEventListener('load', tryInit, { once: true })
    }

    return () => {
      // detach on unmount if attached
      const km = window.keyman
      if (km && km.isAttached(input)) km.detachFromControl(input)
    }
  }, [])

  // Attach / detach Keyman when toggle changes
  useEffect(() => {
    const km = window.keyman
    const input = inputRef.current
    if (!km || !input) return

    if (keyboardOn) {
      if (!km.isAttached(input)) km.attachToControl(input)
      km.setKeyboard('Keyboard_audo12').catch(() => {})
      km.osk?.show(true)
    } else {
      if (km.isAttached(input)) km.detachFromControl(input)
      km.osk?.show(false)
    }
  }, [keyboardOn])

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
          title={keyboardOn ? 'Assyrian keyboard ON' : 'Assyrian keyboard OFF'}
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
