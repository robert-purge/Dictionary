'use client'

import { useState, useEffect, useCallback } from 'react'

interface Word {
  id:         number
  word:       string
  english:    string
  arabic:     string | null
  farsi:      string | null
  syriac_pos: string | null
  reviewed:   boolean
  pos:        string
  entry_id:   number | null
}

interface WordEdits {
  english?:    string
  arabic?:     string
  farsi?:      string
  syriac_pos?: string
}

const PAGE_SIZE = 50

export default function AdminPage() {
  const [password, setPassword]           = useState('')
  const [authed, setAuthed]               = useState(false)
  const [authError, setAuthError]         = useState(false)
  const [words, setWords]                 = useState<Word[]>([])
  const [total, setTotal]                 = useState(0)
  const [page, setPage]                   = useState(0)
  const [q, setQ]                         = useState('')
  const [searchInput, setSearchInput]     = useState('')
  const [loading, setLoading]             = useState(false)
  const [edits, setEdits]                 = useState<Record<number, WordEdits>>({})
  const [saved, setSaved]                 = useState<Record<number, boolean>>({})
  const [saving, setSaving]               = useState<Record<number, boolean>>({})
  const [nullPosOnly, setNullPosOnly]     = useState(false)
  const [showReviewed, setShowReviewed]   = useState(false)

  const storedPassword = () =>
    typeof window !== 'undefined' ? sessionStorage.getItem('admin_pw') ?? '' : ''

  useEffect(() => {
    const pw = storedPassword()
    if (pw) { setPassword(pw); setAuthed(true) }
  }, [])

  const fetchWords = useCallback(async (
    pw: string, pg: number, search: string, nullOnly: boolean, showRev: boolean
  ) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(pg) })
    if (search)  params.set('q', search)
    if (nullOnly) params.set('null_pos', '1')
    if (showRev)  params.set('show_reviewed', '1')

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
    if (authed) fetchWords(password, page, q, nullPosOnly, showReviewed)
  }, [authed, page, q, nullPosOnly, showReviewed, password, fetchWords])

  function login() {
    sessionStorage.setItem('admin_pw', password)
    setAuthError(false)
    setAuthed(true)
  }

  function setField(id: number, field: keyof WordEdits, value: string) {
    setEdits(ed => ({ ...ed, [id]: { ...ed[id], [field]: value } }))
  }

  function isDirty(w: Word) {
    const e = edits[w.id]
    if (!e) return false
    return (
      (e.english    !== undefined && e.english    !== w.english) ||
      (e.arabic     !== undefined && e.arabic     !== (w.arabic     ?? '')) ||
      (e.farsi      !== undefined && e.farsi      !== (w.farsi      ?? '')) ||
      (e.syriac_pos !== undefined && e.syriac_pos !== (w.syriac_pos ?? ''))
    )
  }

  async function saveWord(w: Word) {
    const e = edits[w.id] ?? {}
    setSaving(s => ({ ...s, [w.id]: true }))

    const body: Record<string, any> = { id: w.id, entry_id: w.entry_id }
    if (e.english    !== undefined && e.english    !== w.english)            body.english    = e.english
    if (e.arabic     !== undefined && e.arabic     !== (w.arabic     ?? '')) body.arabic     = e.arabic || null
    if (e.farsi      !== undefined && e.farsi      !== (w.farsi      ?? '')) body.farsi      = e.farsi || null
    if (e.syriac_pos !== undefined && e.syriac_pos !== (w.syriac_pos ?? '')) body.syriac_pos = e.syriac_pos || null

    const res = await fetch('/api/admin/words', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify(body),
    })

    setSaving(s => ({ ...s, [w.id]: false }))
    if (res.ok) {
      setSaved(s => ({ ...s, [w.id]: true }))
      setWords(ws => ws.map(x => x.id === w.id ? {
        ...x,
        english:    e.english    ?? x.english,
        arabic:     e.arabic     !== undefined ? (e.arabic     || null) : x.arabic,
        farsi:      e.farsi      !== undefined ? (e.farsi      || null) : x.farsi,
        syriac_pos: e.syriac_pos !== undefined ? (e.syriac_pos || null) : x.syriac_pos,
      } : x))
      setEdits(ed => { const n = { ...ed }; delete n[w.id]; return n })
      setTimeout(() => setSaved(s => ({ ...s, [w.id]: false })), 2000)
    }
  }

  async function toggleReviewed(w: Word) {
    const next = !w.reviewed
    // Optimistically update UI
    setWords(ws => ws.map(x => x.id === w.id ? { ...x, reviewed: next } : x))

    const res = await fetch('/api/admin/words', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ id: w.id, reviewed: next }),
    })

    if (!res.ok) {
      // Revert on failure
      setWords(ws => ws.map(x => x.id === w.id ? { ...x, reviewed: w.reviewed } : x))
    } else if (!showReviewed && next) {
      // Remove from default view once marked done
      setWords(ws => ws.filter(x => x.id !== w.id))
      setTotal(t => t - 1)
    }
  }

  function submitSearch() {
    setQ(searchInput)
    setPage(0)
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
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, color: 'var(--color-blue)', fontSize: '1.4rem' }}>Syriac Word Review</h1>
        <span style={{ color: 'var(--color-muted)', fontSize: '0.875rem' }}>
          {total.toLocaleString()} {!showReviewed && !q ? 'unreviewed' : ''} words
        </span>

        {/* Search */}
        <div style={{ display: 'flex', gap: '0.5rem', flexGrow: 1, maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search Syriac or English…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitSearch()}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--color-border)', borderRadius: '4px', flexGrow: 1 }}
          />
          <button onClick={submitSearch} style={actionBtn(false)}>Search</button>
          {q && <button onClick={() => { setQ(''); setSearchInput(''); setPage(0) }} style={actionBtn(false, '#eee', '#333')}>✕</button>}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            onClick={() => { setNullPosOnly(v => !v); setPage(0) }}
            style={actionBtn(nullPosOnly, nullPosOnly ? 'var(--color-red)' : '#eee', nullPosOnly ? '#fff' : '#333')}
          >No POS</button>
          <button
            onClick={() => { setShowReviewed(v => !v); setPage(0) }}
            style={actionBtn(showReviewed, showReviewed ? '#16a34a' : '#eee', showReviewed ? '#fff' : '#333')}
          >Show reviewed</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading…</p>
      ) : words.length === 0 ? (
        <p style={{ color: 'var(--color-muted)' }}>
          {q ? 'No results.' : 'All words reviewed — use "Show reviewed" or search to find a specific word.'}
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem', width: '200px', textAlign: 'right' }}>Syriac</th>
              <th style={{ padding: '0.5rem' }}>English</th>
              <th style={{ padding: '0.5rem', width: '80px' }}>POS</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Arabic</th>
              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Farsi</th>
              <th style={{ padding: '0.5rem', width: '100px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {words.map(w => {
              const e        = edits[w.id] ?? {}
              const dirty    = isDirty(w)
              const engVal   = e.english    ?? w.english
              const arabVal  = e.arabic     ?? w.arabic     ?? ''
              const farsiVal = e.farsi      ?? w.farsi      ?? ''
              const posVal   = e.syriac_pos ?? w.syriac_pos ?? ''
              const rowBg    = w.reviewed ? '#f0fdf4' : undefined
              return (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--color-border)', background: rowBg }}>

                  {/* Syriac — read-only */}
                  <td style={{ padding: '0.5rem', textAlign: 'right', direction: 'rtl', fontFamily: "'Audo', serif", fontSize: '1.8rem', color: 'var(--color-text)' }}>
                    {w.word}
                  </td>

                  {/* English — editable */}
                  <td style={{ padding: '0.5rem' }}>
                    <textarea
                      value={engVal}
                      onChange={ev => setField(w.id, 'english', ev.target.value)}
                      rows={2}
                      style={textareaStyle(e.english !== undefined && e.english !== w.english, 'ltr')}
                    />
                    {w.pos && <span style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>{w.pos}</span>}
                  </td>

                  {/* POS — editable */}
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="text"
                      value={posVal}
                      onChange={ev => setField(w.id, 'syriac_pos', ev.target.value)}
                      placeholder="n / vt / adj…"
                      style={{
                        width: '100%',
                        padding: '0.3rem',
                        border: `1px solid ${e.syriac_pos !== undefined && e.syriac_pos !== (w.syriac_pos ?? '') ? 'var(--color-gold)' : 'var(--color-border)'}`,
                        borderRadius: '4px',
                        background: e.syriac_pos !== undefined && e.syriac_pos !== (w.syriac_pos ?? '') ? '#fffbf0' : '#fff',
                        fontSize: '0.85rem',
                      }}
                    />
                  </td>

                  {/* Arabic — editable */}
                  <td style={{ padding: '0.5rem' }}>
                    <textarea
                      value={arabVal}
                      onChange={ev => setField(w.id, 'arabic', ev.target.value)}
                      rows={2}
                      style={textareaStyle(e.arabic !== undefined && e.arabic !== (w.arabic ?? ''), 'rtl', "'Amiri', 'Traditional Arabic', serif")}
                    />
                  </td>

                  {/* Farsi — editable */}
                  <td style={{ padding: '0.5rem' }}>
                    <textarea
                      value={farsiVal}
                      onChange={ev => setField(w.id, 'farsi', ev.target.value)}
                      rows={2}
                      style={textareaStyle(e.farsi !== undefined && e.farsi !== (w.farsi ?? ''), 'rtl', "'Amiri', serif")}
                    />
                  </td>

                  {/* Actions: Save + Done */}
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
                      {saved[w.id] ? (
                        <span style={{ color: 'green', fontSize: '1.1rem' }}>✓ saved</span>
                      ) : (
                        <button
                          onClick={() => saveWord(w)}
                          disabled={saving[w.id] || !dirty}
                          style={{
                            padding: '0.3rem 0.6rem',
                            background: dirty ? 'var(--color-blue)' : '#eee',
                            color: dirty ? '#fff' : '#999',
                            border: 'none', borderRadius: '4px',
                            cursor: dirty ? 'pointer' : 'default',
                            fontSize: '0.8rem', width: '60px',
                          }}
                        >
                          {saving[w.id] ? '…' : 'Save'}
                        </button>
                      )}
                      <button
                        onClick={() => toggleReviewed(w)}
                        title={w.reviewed ? 'Mark as unreviewed' : 'Mark as done'}
                        style={{
                          padding: '0.3rem 0.6rem',
                          background: w.reviewed ? '#16a34a' : '#eee',
                          color: w.reviewed ? '#fff' : '#555',
                          border: 'none', borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem', width: '60px',
                        }}
                      >
                        {w.reviewed ? '✓ Done' : 'Done'}
                      </button>
                    </div>
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
          <button onClick={() => setPage(0)}            disabled={page === 0}             style={btnStyle(page === 0)}>«</button>
          <button onClick={() => setPage(p => p - 1)}   disabled={page === 0}             style={btnStyle(page === 0)}>‹</button>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button onClick={() => setPage(p => p + 1)}   disabled={page >= totalPages - 1} style={btnStyle(page >= totalPages - 1)}>›</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={btnStyle(page >= totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  )
}

function textareaStyle(isDirty: boolean, direction: 'ltr' | 'rtl', fontFamily = 'inherit') {
  return {
    width: '100%',
    direction,
    fontFamily,
    fontSize: '1rem',
    padding: '0.3rem',
    border: `1px solid ${isDirty ? 'var(--color-gold)' : 'var(--color-border)'}`,
    borderRadius: '4px',
    resize: 'vertical' as const,
    background: isDirty ? '#fffbf0' : '#fff',
  }
}

function actionBtn(active: boolean, bg = 'var(--color-blue)', color = '#fff') {
  return {
    padding: '0.4rem 0.75rem',
    background: bg,
    color,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
  }
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
