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
    <>
      <div className="bg-white border-bottom py-3 px-3">
        <SearchBar
          onSearch={handleSearch}
          onCommit={handleCommit}
          results={results}
          showResults={showResults}
          onSelect={handleSelect}
        />
        <p className="search-hint mt-2">
          Auto-detects English, ܐܬܘܪܝܐ, عربي, or فارسی
        </p>
        {loading && (
          <p className="search-hint mt-1">Searching…</p>
        )}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.5)' }}>
        <WordDetail result={selected} />
      </div>
    </>
  )
}
