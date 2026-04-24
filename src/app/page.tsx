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
    if (results.length > 0) setSelected(results[0])
    setShowResults(false)
  }, [results])

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 bg-white border-b border-gray-200 flex justify-center">
        <div className="w-full max-w-2xl">
          <SearchBar
            onSearch={handleSearch}
            onCommit={handleCommit}
            results={results}
            showResults={showResults}
            onSelect={handleSelect}
          />
          <p className="text-center text-xs text-gray-300 mt-2">
            Auto-detects English, ܐܬܘܪܝܐ, عربي, or فارسی
          </p>
          {loading && (
            <p className="text-center text-xs text-gray-300 animate-pulse mt-1">Searching...</p>
          )}
        </div>
      </div>

      {/* Word detail */}
      <div className="flex-1 bg-white/50 backdrop-blur-sm flex justify-center">
        <div className="w-full max-w-2xl">
          <WordDetail result={selected} />
        </div>
      </div>
    </div>
  )
}
