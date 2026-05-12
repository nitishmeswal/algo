import { getSupabase, isSupabaseEnabled } from '../db/supabase/client.js'
import { getAgentState } from './tradingAgent.js'
import { getValidationStats } from './signalValidator.js'

/**
 * Session Health Checker — monitors agent infrastructure during long-running sessions.
 *
 * Tracks: uptime, error rates, connectivity status, cycle performance.
 * Exposed via API for monitoring and the 24-48h observation phase.
 */

interface ErrorCounter {
  total: number
  byType: Record<string, number>
  lastError: string | null
  lastErrorTs: string | null
}

interface CycleStats {
  total: number
  successful: number
  failed: number
  avgLatencyMs: number
  latencies: number[]
}

const errors: ErrorCounter = {
  total: 0,
  byType: {},
  lastError: null,
  lastErrorTs: null,
}

const cycles: CycleStats = {
  total: 0,
  successful: 0,
  failed: 0,
  avgLatencyMs: 0,
  latencies: [],
}

let sessionStartedAt: number | null = null

export function markSessionStart(): void {
  sessionStartedAt = Date.now()
  // Reset counters
  errors.total = 0
  errors.byType = {}
  errors.lastError = null
  errors.lastErrorTs = null
  cycles.total = 0
  cycles.successful = 0
  cycles.failed = 0
  cycles.avgLatencyMs = 0
  cycles.latencies = []
}

export function recordCycleSuccess(latencyMs: number): void {
  cycles.total++
  cycles.successful++
  cycles.latencies.push(latencyMs)
  // Keep last 100 latencies for running average
  if (cycles.latencies.length > 100) cycles.latencies.shift()
  cycles.avgLatencyMs =
    cycles.latencies.reduce((a, b) => a + b, 0) / cycles.latencies.length
}

export function recordCycleError(errorType: string, message: string): void {
  cycles.total++
  cycles.failed++
  errors.total++
  errors.byType[errorType] = (errors.byType[errorType] || 0) + 1
  errors.lastError = message
  errors.lastErrorTs = new Date().toISOString()
}

async function checkOllamaConnectivity(): Promise<{
  reachable: boolean
  model: string | null
  latencyMs: number
}> {
  const url = process.env.OLLAMA_URL || 'http://localhost:11434'
  const model = process.env.OLLAMA_MODEL || 'qwen3:8b'
  const start = Date.now()
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const latencyMs = Date.now() - start
    if (!res.ok) return { reachable: false, model, latencyMs }
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const models = data.models?.map((m) => m.name) ?? []
    const hasModel = models.some((m) => m.startsWith(model.split(':')[0]))
    return { reachable: true, model: hasModel ? model : `${model} (NOT FOUND — available: ${models.join(', ')})`, latencyMs }
  } catch {
    return { reachable: false, model, latencyMs: Date.now() - start }
  }
}

async function checkSupabaseConnectivity(): Promise<{
  reachable: boolean
  latencyMs: number
  tablesOk: boolean
}> {
  if (!isSupabaseEnabled()) return { reachable: false, latencyMs: 0, tablesOk: false }
  const sb = getSupabase()
  if (!sb) return { reachable: false, latencyMs: 0, tablesOk: false }
  const start = Date.now()
  try {
    const { error } = await sb.from('cycles').select('id').limit(1)
    const latencyMs = Date.now() - start
    return { reachable: !error, latencyMs, tablesOk: !error }
  } catch {
    return { reachable: false, latencyMs: Date.now() - start, tablesOk: false }
  }
}

async function checkExchangeConnectivity(): Promise<{
  reachable: boolean
  exchange: string | null
  latencyMs: number
}> {
  const start = Date.now()
  try {
    // Try to reach the exchange via our own API
    const res = await fetch('http://localhost:8000/crypto/price/BTC%2FUSDT', {
      signal: AbortSignal.timeout(10000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { reachable: false, exchange: null, latencyMs }
    return { reachable: true, exchange: 'auto-detected', latencyMs }
  } catch {
    return { reachable: false, exchange: null, latencyMs: Date.now() - start }
  }
}

export async function getSessionHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: { seconds: number; formatted: string } | null
  agent: {
    status: string
    model: string
    mode: string
    symbol: string
    cycleCount: number
  }
  cycles: {
    total: number
    successful: number
    failed: number
    errorRate: string
    avgLatencyMs: number
  }
  errors: {
    total: number
    byType: Record<string, number>
    lastError: string | null
    lastErrorTs: string | null
  }
  connectivity: {
    ollama: Awaited<ReturnType<typeof checkOllamaConnectivity>>
    supabase: Awaited<ReturnType<typeof checkSupabaseConnectivity>>
    exchange: Awaited<ReturnType<typeof checkExchangeConnectivity>>
  }
  validation: ReturnType<typeof getValidationStats>
}> {
  const agentState = getAgentState()
  const [ollama, supabase, exchange] = await Promise.all([
    checkOllamaConnectivity(),
    checkSupabaseConnectivity(),
    checkExchangeConnectivity(),
  ])

  const uptimeSeconds = sessionStartedAt
    ? Math.floor((Date.now() - sessionStartedAt) / 1000)
    : null

  const errorRate = cycles.total > 0
    ? ((cycles.failed / cycles.total) * 100).toFixed(1) + '%'
    : '0%'

  // Determine overall health
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (!supabase.reachable || !exchange.reachable) status = 'unhealthy'
  else if (cycles.failed > 0 && cycles.total > 0 && cycles.failed / cycles.total > 0.2) status = 'degraded'
  else if (errors.total > 10) status = 'degraded'

  return {
    status,
    uptime: uptimeSeconds !== null
      ? { seconds: uptimeSeconds, formatted: formatUptime(uptimeSeconds) }
      : null,
    agent: {
      status: agentState.status,
      model: agentState.activeModel,
      mode: agentState.mode,
      symbol: agentState.symbol,
      cycleCount: agentState.cycleCount,
    },
    cycles: {
      total: cycles.total,
      successful: cycles.successful,
      failed: cycles.failed,
      errorRate,
      avgLatencyMs: Math.round(cycles.avgLatencyMs),
    },
    errors: { ...errors },
    connectivity: { ollama, supabase, exchange },
    validation: getValidationStats(),
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
