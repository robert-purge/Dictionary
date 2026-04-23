'use client'

import { useCallback, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordDetail from '@/components/WordDetail'
import type { SearchResult } from '@/types/dictionary'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setSelected(null); setShowResults(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setSelected(data.results?.[0] ?? null)
      setShowResults(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelect = useCallback((result: SearchResult) => {
    setSelected(result)
    setShowResults(false)
  }, [])

  const handleCommit = useCallback(() => {
    setShowResults(false)
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Search bar with dropdown */}
      <div className="relative px-4 pt-4 pb-2 bg-white/70 backdrop-blur-sm border-b border-gray-200">
        <SearchBar onSearch={handleSearch} onCommit={handleCommit} />
        <p className="text-center text-xs text-gray-300 mt-2">
          Auto-detects English, ܐܬܘܪܝܐ, عربي, or فارسی
        </p>
        {loading && (
          <p className="text-center text-xs text-gray-300 animate-pulse mt-1">Searching...</p>
        )}
        {showResults && results.length > 0 && (
          <div className="absolute left-4 right-4 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
            {results.map((r) => (
              <div
                key={r.id}
                onClick={() => handleSelect(r)}
                className={`cursor-pointer px-4 py-3 transition-colors border-b border-gray-100 last:border-0
                  ${r.id === selected?.id ? 'bg-[#F7A800]/10' : 'hover:bg-gray-50'}`}
              >
                <span className="font-medium text-gray-900">{r.english}</span>
                {r.part_of_speech && (
                  <span className="ml-2 text-xs text-gray-400">{r.part_of_speech}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Word detail fills remaining space */}
      <div className="flex-1 bg-white/50 backdrop-blur-sm overflow-y-auto">
        <WordDetail result={selected} />
      </div>
    </div>
  )
}
