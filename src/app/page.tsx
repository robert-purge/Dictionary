'use client'

import { useCallback, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import ResultsList from '@/components/ResultsList'
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
    <div className="flex flex-col h-[calc(100vh-64px)] md:grid md:grid-cols-[360px_1fr]">
      {/* Left panel: search + results */}
      <div className="flex flex-col gap-3 p-4 border-b md:border-b-0 md:border-r border-gray-200 bg-white/70 backdrop-blur-sm overflow-y-auto">
        <SearchBar onSearch={handleSearch} onCommit={handleCommit} />
        <p className="text-center text-xs text-gray-300">
          Auto-detects English, ܐܬܘܪܝܐ, عربي, or فارسی
        </p>
        {loading && (
          <p className="text-center text-xs text-gray-300 animate-pulse">Searching...</p>
        )}
        {showResults && (
          <ResultsList results={results} selected={selected} onSelect={handleSelect} />
        )}
      </div>

      {/* Right panel: word detail */}
      <div className="bg-white/50 backdrop-blur-sm overflow-y-auto">
        <WordDetail result={selected} />
      </div>
    </div>
  )
}
