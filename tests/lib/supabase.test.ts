import { createBrowserClient, createServerClient } from '@/lib/supabase'

describe('supabase client', () => {
  it('createBrowserClient returns a client with .from()', () => {
    const client = createBrowserClient()
    expect(typeof client.from).toBe('function')
  })

  it('createServerClient returns a client with .rpc()', () => {
    const client = createServerClient()
    expect(typeof client.rpc).toBe('function')
  })
})
