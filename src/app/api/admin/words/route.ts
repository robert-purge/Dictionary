import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ''

function isAuthorized(req: NextRequest) {
  const auth = req.headers.get('x-admin-password') ?? ''
  return ADMIN_PASSWORD && auth === ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const page     = parseInt(searchParams.get('page') ?? '0')
  const pageSize = 50
  const q        = searchParams.get('q')?.trim() ?? ''

  const client = createServiceClient()

  let query = client
    .from('syriac_words')
    .select('id, word, arabic, entry_words(entries(english, part_of_speech))', { count: 'exact' })
    .range(page * pageSize, (page + 1) * pageSize - 1)
    .order('id')

  if (q) {
    // Filter by English entry name via a separate lookup
    const entryRows = await client
      .from('entries')
      .select('id')
      .ilike('english', `%${q}%`)

    const entryIds = (entryRows.data ?? []).map((e: any) => e.id)
    if (!entryIds.length) return NextResponse.json({ words: [], total: 0 })

    const wordRows = await client
      .from('entry_words')
      .select('syriac_word_id')
      .in('entry_id', entryIds)

    const wordIds = [...new Set((wordRows.data ?? []).map((r: any) => r.syriac_word_id))]
    if (!wordIds.length) return NextResponse.json({ words: [], total: 0 })

    query = client
      .from('syriac_words')
      .select('id, word, arabic, entry_words(entries(english, part_of_speech))', { count: 'exact' })
      .in('id', wordIds)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('id')
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten English context — take first entry per word
  const words = (data ?? []).map((row: any) => ({
    id:      row.id,
    word:    row.word,
    arabic:  row.arabic,
    english: row.entry_words?.[0]?.entries?.english ?? '',
    pos:     row.entry_words?.[0]?.entries?.part_of_speech ?? '',
  }))

  return NextResponse.json({ words, total: count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, arabic } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const client = createServiceClient()
  const { error } = await client
    .from('syriac_words')
    .update({ arabic: arabic ?? null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
