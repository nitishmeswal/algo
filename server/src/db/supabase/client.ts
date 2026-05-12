import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    console.log('[supabase] SUPABASE_URL or key not set — persistence disabled')
    return null
  }

  supabase = createClient(url, key)
  console.log('[supabase] Connected to', url)
  return supabase
}

export function isSupabaseEnabled(): boolean {
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY))
}

export async function checkTablesExist(): Promise<{ allExist: boolean; missing: string[] }> {
  const sb = getSupabase()
  if (!sb) return { allExist: false, missing: ['all'] }

  const tables = ['cycles', 'trades', 'performance_snapshots', 'errors', 'market_snapshots']
  const missing: string[] = []

  for (const table of tables) {
    const { error } = await sb.from(table).select('id').limit(1)
    if (error) missing.push(table)
  }

  return { allExist: missing.length === 0, missing }
}
