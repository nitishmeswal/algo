/**
 * Run the Supabase migration to create tables.
 * Usage: npx tsx server/src/db/supabase/migrate.ts
 * 
 * Alternatively, paste the SQL from supabase/migrations/001_trading_tables.sql
 * directly into your Supabase Dashboard SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)

const tables = [
  {
    name: 'cycles',
    check: async () => {
      const { error } = await supabase.from('cycles').select('id').limit(1)
      return !error
    },
  },
  {
    name: 'trades',
    check: async () => {
      const { error } = await supabase.from('trades').select('id').limit(1)
      return !error
    },
  },
  {
    name: 'performance_snapshots',
    check: async () => {
      const { error } = await supabase.from('performance_snapshots').select('id').limit(1)
      return !error
    },
  },
  {
    name: 'errors',
    check: async () => {
      const { error } = await supabase.from('errors').select('id').limit(1)
      return !error
    },
  },
  {
    name: 'market_snapshots',
    check: async () => {
      const { error } = await supabase.from('market_snapshots').select('id').limit(1)
      return !error
    },
  },
]

async function main() {
  console.log('Checking Supabase tables...\n')

  let allExist = true
  for (const table of tables) {
    const exists = await table.check()
    const status = exists ? '✓' : '✗'
    console.log(`  ${status} ${table.name}${exists ? '' : ' — MISSING'}`)
    if (!exists) allExist = false
  }

  if (allExist) {
    console.log('\n✓ All tables exist! Persistence layer is ready.')
  } else {
    console.log('\n✗ Some tables are missing.')
    console.log('  → Go to your Supabase Dashboard → SQL Editor')
    console.log('  → Paste the contents of: supabase/migrations/001_trading_tables.sql')
    console.log('  → Click "Run"')
    console.log('\n  Direct link: https://supabase.com/dashboard/project/ctufzbagyybfxibaaxiq/sql/new')
    process.exit(1)
  }
}

main().catch(console.error)
