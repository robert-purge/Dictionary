'use client'

import { useState, useEffect, useCallback } from 'react'

interface Word {
  id: number
  word: string
  arabic: string | null
  english: string
  pos: string
}

const PAGE_SIZE = 50

export default function AdminPage() {
  const [password, setPassword]     = useState('')
  const [authed, setAuthed]         = useState(false)
  const [authError, setAuthError]   = useState(false)
  const [words, setWords]           = useState<Word[]>([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [q, setQ]                   = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading]       = useState(false)
  const [edits, setEdits]           = useState<Record<number, string>>({})
  const [saved, setSaved]           = useState<Record<number, boolean>>({})
  const [saving, setSaving]         = useState<Record<number, boolean>>({})

  const storedPassword = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('admin_pw') ?? '' : ''

  useEffect(() => {
    const pw = storedPassword()
    if (pw) { setPassword(pw); setAuthed(true) }
  }, [])

  const fetchWords = useCallback(async (pw: string, pg: number, search: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(pg) })
    if (search) params.set('q', search)

    const res = await fetch(`/api/admin/words?${params}`, {
      headers: { 'x-admin-password': pw }
    })

    if (res.status === 401) { setAuthed(false); setAuthError(true); setLoading(false); return }

    const json = await res.json()
    setWords(json.words ?? [])
    setTotal(json.total ?? 0)
    setEdits({})
    setSaved({})
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authed) fetchWords(password, page, q)
  }, [authed, page, q, password, fetchWords])

  function login() {
    sessionStorage.setItem('admin_pw', password)
    setAuthError(false)
    setAuthed(true)
  }

  async function saveWord(id: number) {
    const arabic = edits[id] ?? words.find(w => w.id === id)?.arabic ?? ''
    setSaving(s => ({ ...s, [id]: true }))

    const res = await fetch('/api/admin/words', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ id, arabic: arabic || null }),
    })

    setSaving(s => ({ ...s, [id]: false }))
    if (res.ok) {
      setSaved(s => ({ ...s, [id]: true }))
      setWords(ws => ws.map(w => w.id === id ? { ...w, arabic } : w))
      setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 2000)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', width: '320px' }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--color-blue)' }}>Admin Review</h2>
        {authError && <p style={{ color: 'var(--color-red)', fontSize: '0.875rem' }}>Incorrect password</p>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px' }}
        />
        <button
          onClick={login}
          style={{ width: '100%', padding: '0.5rem', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Enter
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, color: 'var(--color-blue)', fontSize: '1.4rem' }}>Syriac Word Review</h1>
        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>{total.toLocaleString()} words</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Filter by English..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setQ(searchInput); setPage(0) } }}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px', width: '200px' }}
          />
          <button
            onClick={() => { setQ(searchInput); setPage(0) }}
            style={{ padding: '0.4rem 0.75rem', background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >Search</button>
          {q && <button
            onClick={() => { setQ(''); setSearchInput(''); setPage(0) }}
            style={{ padding: '0.4rem 0.75rem', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >Clear</button>}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem', width: '180px' }}>English</th>
              <th style={{ padding: '0.5rem', width: '280px', textAlign: 'right' }}>Syriac</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Arabic</th>
              <th style={{ padding: '0.5rem', width: '70px' }}></th>
            </tr>
          </thead>
          <tbody>
            {words.map(w => {
              const editedArabic = edits[w.id] ?? w.arabic ?? ''
              const isDirty = w.id in edits && edits[w.id] !== (w.arabic ?? '')
              return (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border)' }}>

                  <td style={{ padding: '0.5rem', color: 'var(--color-text)' }}>
                    {w.english}
                    {w.pos && <span style={{ color: 'var(--color-muted)', fontSize: '0.75rem', marginLeft: '4px' }}>{w.pos}</span>}
                  </td>

                  <td style={{ padding: '0.5rem', textAlign: 'right', direction: 'rtl', fontFamily: "'Audo', serif", fontSize: '1.2rem', color: 'var(--color-text)' }}>
                    {w.word}
                  </td>

                  <td style={{ padding: '0.5rem' }}>
                    <textarea
                      value={editedArabic}
                      onChange={e => setEdits(ed => ({ ...ed, [w.id]: e.target.value }))}
                      rows={2}
                      style={{
                        width: '100%',
                        direction: 'rtl',
                        fontFamily: "'Amiri', 'Traditional Arabic', serif",
                        fontSize: '1rem',
                        padding: '0.3rem',
                        border: `1px solid ${isDirty ? 'var(--color-gold)' : 'var(--color-border)'}`,
                        borderRadius: '4px',
                        resize: 'vertical',
                        background: isDirty ? '#fffbf0' : '#fff',
                      }}
                    />
                  </td>

                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {saved[w.id] ? (
                      <span style={{ color: 'green', fontSize: '1.2rem' }}>✓</span>
                    ) : (
                      <button
                        onClick={() => saveWord(w.id)}
                        disabled={saving[w.id] || !isDirty}
                        style={{
                          padding: '0.3rem 0.6rem',
                          background: isDirty ? 'var(--color-blue)' : '#eee',
                          color: isDirty ? '#fff' : '#999',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isDirty ? 'pointer' : 'default',
                          fontSize: '0.8rem',
                        }}
                      >
                        {saving[w.id] ? '...' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          <button onClick={() => setPage(0)}       disabled={page === 0}            style={btnStyle(page === 0)}>«</button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}         style={btnStyle(page === 0)}>‹</button>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} style={btnStyle(page >= totalPages - 1)}>›</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={btnStyle(page >= totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  )
}

function btnStyle(disabled: boolean) {
  return {
    padding: '0.3rem 0.6rem',
    background: disabled ? '#eee' : 'var(--color-blue)',
    color: disabled ? '#999' : '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'default' : 'pointer',
  }
}
