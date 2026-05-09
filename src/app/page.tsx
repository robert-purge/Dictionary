'use client'

import { useCallback, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordCard from '@/components/WordCard'
import type { SearchResult } from '@/types/dictionary'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setShowResults(false); setSearched(false); return }
    setLoading(true)
    setSearched(true)
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
    setResults([result])
    setShowResults(false)
  }, [])

  const handleCommit = useCallback(() => {
    setShowResults(false)
  }, [])

  return (
    <>
      <div className="search-section">
        <SearchBar
          onSearch={handleSearch}
          onCommit={handleCommit}
          results={results}
          showResults={showResults}
          onSelect={handleSelect}
        />
        <p className="search-hint mt-2">Auto-detects English, ܐܬܘܪܝܐ, عربي, or فارسی</p>
      </div>

      <main className="results-section">
        {loading && <div className="word-placeholder">Searching…</div>}
        {!loading && searched && results.length === 0 && (
          <div className="word-placeholder">No results found.</div>
        )}
        {!loading && !searched && (
          <div className="word-placeholder">Search for a word to see translations</div>
        )}
        {!loading && !showResults && results.map(entry => (
          <WordCard key={entry.id} entry={entry} />
        ))}
      </main>
    </>
  )
}
