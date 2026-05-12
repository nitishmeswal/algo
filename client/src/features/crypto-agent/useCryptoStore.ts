import { create } from 'zustand'
import type {
  AgentState,
  AiModel,
  Candle,
  CryptoSettings,
  IndicatorSnapshot,
  PersonalityId,
  Portfolio,
  Ticker,
  TradingMode,
} from '../../../../shared/crypto/types'

type CryptoStore = {
  // Market data
  ticker: Ticker | null
  candles: Candle[]
  indicators: IndicatorSnapshot | null

  // Agent state
  agentState: AgentState | null
  portfolio: Portfolio | null
  availableModels: AiModel[]

  // Settings
  settings: Partial<CryptoSettings> | null

  // UI
  loading: boolean
  error: string | null
  settingsOpen: boolean

  // Actions
  fetchTicker: (symbol: string) => Promise<void>
  fetchCandles: (symbol: string, timeframe?: string) => Promise<void>
  fetchIndicators: (symbol: string) => Promise<void>
  fetchAgentState: () => Promise<void>
  fetchPortfolio: () => Promise<void>
  fetchAvailableModels: () => Promise<void>
  fetchSettings: () => Promise<void>
  startAgent: (model: AiModel, mode: TradingMode, symbol?: string, balance?: number, personality?: PersonalityId) => Promise<void>
  stopAgent: () => Promise<void>
  updateSettings: (patch: Partial<CryptoSettings>) => Promise<void>
  resetPortfolio: (balance: number) => Promise<void>
  setSettingsOpen: (open: boolean) => void
  clearError: () => void
}

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
  } catch {
    throw new Error(
      'Cannot connect to backend server. Run "cd server && npm run dev" first, then refresh.',
    )
  }
  if (res.headers.get('content-type')?.includes('text/html')) {
    throw new Error(
      'Backend server not found — got HTML instead of JSON. Make sure the server is running on port 8000.',
    )
  }
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

export const useCryptoStore = create<CryptoStore>((set) => ({
  ticker: null,
  candles: [],
  indicators: null,
  agentState: null,
  portfolio: null,
  availableModels: [],
  settings: null,
  loading: false,
  error: null,
  settingsOpen: false,

  fetchTicker: async (symbol) => {
    try {
      const ticker = await apiFetch<Ticker>(`/crypto/price/${encodeURIComponent(symbol)}`)
      set({ ticker })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchCandles: async (symbol, timeframe = '5m') => {
    try {
      const { candles } = await apiFetch<{ candles: Candle[] }>(
        `/crypto/candles/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=100`,
      )
      set({ candles })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchIndicators: async (symbol) => {
    try {
      const indicators = await apiFetch<IndicatorSnapshot>(
        `/crypto/indicators/${encodeURIComponent(symbol)}`,
      )
      set({ indicators })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchAgentState: async () => {
    try {
      const agentState = await apiFetch<AgentState>('/crypto/agent/state')
      set({ agentState, portfolio: agentState.portfolio })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchPortfolio: async () => {
    try {
      const portfolio = await apiFetch<Portfolio>('/crypto/portfolio')
      set({ portfolio })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchAvailableModels: async () => {
    try {
      const { available } = await apiFetch<{ available: AiModel[] }>('/crypto/agent/models')
      set({ availableModels: available })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await apiFetch<Partial<CryptoSettings>>('/crypto/settings')
      set({ settings })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  startAgent: async (model, mode, symbol, balance, personality) => {
    try {
      set({ loading: true, error: null })
      const agentState = await apiFetch<AgentState>('/crypto/agent/start', {
        method: 'POST',
        body: JSON.stringify({ model, mode, symbol, initialBalance: balance, personality }),
      })
      set({ agentState, portfolio: agentState.portfolio, loading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false })
    }
  },

  stopAgent: async () => {
    try {
      const agentState = await apiFetch<AgentState>('/crypto/agent/stop', { method: 'POST' })
      set({ agentState })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  updateSettings: async (patch) => {
    try {
      const settings = await apiFetch<Partial<CryptoSettings>>('/crypto/settings', {
        method: 'POST',
        body: JSON.stringify(patch),
      })
      set({ settings })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  resetPortfolio: async (balance) => {
    try {
      const portfolio = await apiFetch<Portfolio>('/crypto/portfolio/reset', {
        method: 'POST',
        body: JSON.stringify({ initialBalance: balance }),
      })
      set({ portfolio })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  clearError: () => set({ error: null }),
}))
