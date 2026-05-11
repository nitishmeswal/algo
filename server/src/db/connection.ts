import 'dotenv/config'
import { Pool, type PoolConfig } from 'pg'

function buildPoolConfig(): PoolConfig | null {
  const connStr = process.env.DATABASE_URL?.trim()
  if (!connStr) return null
  return {
    connectionString: connStr,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
  }
}

const poolConfig = buildPoolConfig()
export const dbPool: Pool | null = poolConfig ? new Pool(poolConfig) : null

if (!dbPool) {
  console.warn('[db] DATABASE_URL not set — Postgres features disabled (order management, audit). Crypto agent works without DB.')
}

export function requirePool(): Pool {
  if (!dbPool) throw new Error('DATABASE_URL not configured — Postgres features unavailable.')
  return dbPool
}

export async function checkDbConnection(): Promise<void> {
  const pool = requirePool()
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
  } finally {
    client.release()
  }
}

export async function closeDbConnection(): Promise<void> {
  if (dbPool) await dbPool.end()
}
