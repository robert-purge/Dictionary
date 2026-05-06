import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('x-admin-password') ?? ''
  return ADMIN_PASSWORD && auth === ADMIN_PASSWORD
}

function isSyriac(text: string) {
  return /[܀-ݏ]/.test(text)
}

const SELECT = 'id, word, arabic, farsi, part_of_speech, reviewed, entry_words(entry_id, entries(english, part_of_speech))'

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const page         = parseInt(searchParams.get('page') ?? '0')
  const pageSize     = 50
  const q            = searchParams.get('q')?.trim() ?? ''
  const nullPos      = searchParams.get('null_pos') === '1'
  const showReviewed = searchParams.get('show_reviewed') === '1'

  const client = createServiceClient()

  function applyFilters(query: any) {
    if (nullPos) query = query.is('part_of_speech', null)
    // When there's no search query, hide reviewed words unless explicitly shown
    if (!q && !showReviewed) query = query.or('reviewed.eq.false,reviewed.is.null')
    return query
  }

  // Syriac word search — query directly on syriac_words.word
  if (q && isSyriac(q)) {
    const { data, error, count } = await applyFilters(
      client
        .from('syriac_words')
        .select(SELECT, { count: 'exact' })
        .ilike('word', `%${q}%`)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id')
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ words: mapWords(data ?? []), total: count ?? 0 })
  }

  // English search — join through entry_words
  if (q) {
    const entryRows = await client.from('entries').select('id').ilike('english', `%${q}%`)
    const entryIds = (entryRows.data ?? []).map((e: any) => e.id)
    if (!entryIds.length) return NextResponse.json({ words: [], total: 0 })

    const wordRows = await client.from('entry_words').select('syriac_word_id').in('entry_id', entryIds)
    const wordIds = [...new Set((wordRows.data ?? []).map((r: any) => r.syriac_word_id))]
    if (!wordIds.length) return NextResponse.json({ words: [], total: 0 })

    const { data, error, count } = await applyFilters(
      client
        .from('syriac_words')
        .select(SELECT, { count: 'exact' })
        .in('id', wordIds)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id')
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ words: mapWords(data ?? []), total: count ?? 0 })
  }

  // Default — all words with filters applied
  const { data, error, count } = await applyFilters(
    client
      .from('syriac_words')
      .select(SELECT, { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('id')
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ words: mapWords(data ?? []), total: count ?? 0 })
}

function mapWords(data: any[]) {
  return data.map((row: any) => ({
    id:         row.id,
    word:       row.word,
    arabic:     row.arabic,
    farsi:      row.farsi,
    syriac_pos: row.part_of_speech ?? null,
    reviewed:   row.reviewed ?? false,
    english:    row.entry_words?.[0]?.entries?.english ?? '',
    pos:        row.entry_words?.[0]?.entries?.part_of_speech ?? '',
    entry_id:   row.entry_words?.[0]?.entry_id ?? null,
  }))
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, entry_id, english, arabic, farsi, syriac_pos, reviewed } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = createServiceClient()

  const wordFields: Record<string, any> = {}
  if (arabic      !== undefined) wordFields.arabic         = arabic ?? null
  if (farsi       !== undefined) wordFields.farsi          = farsi ?? null
  if (syriac_pos  !== undefined) wordFields.part_of_speech = syriac_pos || null
  if (reviewed    !== undefined) wordFields.reviewed       = reviewed

  if (Object.keys(wordFields).length) {
    const { error } = await client.from('syriac_words').update(wordFields).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (english !== undefined && entry_id) {
    const { error } = await client.from('entries').update({ english }).eq('id', entry_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
