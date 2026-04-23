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

  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { onSearch(value) }, 200)
    return () => clearTimeout(timer.current)
  }, [value, onSearch])

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-3 rounded-xl border-2 border-[#003DA5] bg-white/90 px-4 py-3 shadow-md">
        <span className="text-[#003DA5] text-lg">🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit?.() }}
          placeholder="Search in English, ܐܬܘܪܝܐ, عربي, or فارسی"
          className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-300"
          autoFocus
        />
      </div>

      {showResults && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 max-h-80 overflow-y-auto rounded-b-xl border border-t-0 border-gray-200 bg-white shadow-2xl">
          {results.map((r) => (
            <li
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(r) }}
              className="flex items-baseline gap-2 cursor-pointer px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{r.english}</span>
              {r.part_of_speech && (
                <span className="text-xs text-gray-400">{r.part_of_speech}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
