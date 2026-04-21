import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'

const mockRpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({ rpc: mockRpc }),
}))

describe('GET /api/search', () => {
  beforeEach(() => {
    mockRpc.mockResolvedValue({
      data: [{
        id: 1, english: 'abase', part_of_speech: 'vt.',
        variants: [{ id: 1, number: 1, assyrian: 'ܝܟܝܕ', assyrian_normalized: 'ܝܟܝܕ',
          arabic: 'يُذل', farsi: null, example_assyrian: null, example_arabic: null }],
      }],
      error: null,
    })
  })

  it('returns 400 for missing query', async () => {
    const req = new NextRequest('http://localhost/api/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty query', async () => {
    const req = new NextRequest('http://localhost/api/search?q=')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns results for a valid English query', async () => {
    const req = new NextRequest('http://localhost/api/search?q=abase')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].english).toBe('abase')
  })

  it('returns 500 when Supabase returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const req = new NextRequest('http://localhost/api/search?q=test')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('db error')
  })
})
