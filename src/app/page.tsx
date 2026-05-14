'use client'

import { useCallback, useRef, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordCard from '@/components/WordCard'
import type { SearchResult } from '@/types/dictionary'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]); setShowResults(false); setSearched(false); setError(null); return
    }
    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setSearched(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: abortRef.current.signal,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      setResults(data.results ?? [])
      setShowResults(true)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError('Search is unavailable — please try again in a moment.')
      setResults([])
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
        {!loading && error && (
          <div className="word-placeholder" style={{ color: 'var(--color-red)' }}>{error}</div>
        )}
        {!loading && !error && searched && results.length === 0 && (
          <div className="word-placeholder">No results found.</div>
        )}
        {!loading && !error && !searched && (
          <div className="word-placeholder">Search for a word to see translations</div>
        )}
        {!loading && !showResults && results.map(entry => (
          <WordCard key={entry.id} entry={entry} />
        ))}
      </main>
    </>
  )
}
