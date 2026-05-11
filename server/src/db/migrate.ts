import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeDbConnection, requirePool } from './connection.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

type MigrationFile = {
  name: string
  sql: string
}

async function ensureMigrationsTable(): Promise<void> {
  await requirePool().query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function readMigrations(): Promise<MigrationFile[]> {
  const files = await readdir(MIGRATIONS_DIR)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()
  const migrations = await Promise.all(
    sqlFiles.map(async (name) => ({
      name,
      sql: await readFile(path.join(MIGRATIONS_DIR, name), 'utf8'),
    })),
  )
  return migrations
}

async function appliedMigrationNames(): Promise<Set<string>> {
  const result = await requirePool().query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name ASC',
  )
  return new Set(result.rows.map((row) => row.name))
}

async function applyMigration(migration: MigrationFile): Promise<void> {
  const client = await requirePool().connect()
  try {
    await client.query('BEGIN')
    await client.query(migration.sql)
    await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [migration.name])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function run(): Promise<void> {
  await ensureMigrationsTable()
  const allMigrations = await readMigrations()
  const alreadyApplied = await appliedMigrationNames()

  let appliedCount = 0
  for (const migration of allMigrations) {
    if (alreadyApplied.has(migration.name)) continue
    await applyMigration(migration)
    appliedCount += 1
    console.log(`Applied migration: ${migration.name}`)
  }
  if (appliedCount === 0) {
    console.log('No pending migrations.')
  } else {
    console.log(`Applied ${appliedCount} migration(s).`)
  }
}

run()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDbConnection()
  })
