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

export default function SearchBar({ onSearch, onCommit, results, showResults, onSelect }: Props) {
  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const open = showResults && results.length > 0

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { onSearch(value) }, 200)
    return () => clearTimeout(timer.current)
  }, [value, onSearch])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '2px solid #003DA5',
        borderBottom: open ? '2px solid #003DA5' : '2px solid #003DA5',
        borderRadius: open ? '12px 12px 0 0' : '12px',
        background: 'white',
        padding: '12px 16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <span style={{ color: '#003DA5', fontSize: '18px' }}>🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit?.() }}
          placeholder="Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
          style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: '#374151' }}
          autoFocus
        />
      </div>

      {open && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          width: '100%',
          background: 'white',
          border: '2px solid #003DA5',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          maxHeight: '320px',
          overflowY: 'auto',
          zIndex: 100,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        }}>
          {results.map((r) => (
            <li
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                gap: '8px',
                alignItems: 'baseline',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = '#f9fafb' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = 'white' }}
            >
              <span style={{ fontWeight: 500, color: '#111827' }}>{r.english}</span>
              {r.part_of_speech && (
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{r.part_of_speech}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
