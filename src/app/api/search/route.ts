import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { detectLanguage } from '@/lib/detect-language'
import { normalizeSyriac } from '@/lib/normalize-syriac'
import type { SearchResult } from '@/types/dictionary'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()

  if (!q) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 })
  }

  const lang = detectLanguage(q)
  const queryText = lang === 'syriac' ? normalizeSyriac(q) : q

  const supabase = createServerClient()
  const { data, error } = await supabase.rpc('search_dictionary', {
    query_text: queryText,
    lang,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ results: (data ?? []) as SearchResult[] })
}
