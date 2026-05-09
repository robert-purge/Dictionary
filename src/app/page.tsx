'use client'

import { useCallback, useState } from 'react'
import SearchBar from '@/components/SearchBar'
import WordCard from '@/components/WordCard'
import type { SearchResult } from '@/types/dictionary'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <>
      <div className="search-section">
        <SearchBar onSearch={handleSearch} results={[]} showResults={false} onSelect={() => {}} />
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
        {!loading && results.map(entry => (
          <WordCard key={entry.id} entry={entry} />
        ))}
      </main>
    </>
  )
}
