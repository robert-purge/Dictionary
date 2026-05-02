import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createBrowserClient() {
  return createClient(url, anonKey)
}

export function createServerClient() {
  return createClient(url, anonKey)
}

export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  return createClient(url, serviceKey)
}
