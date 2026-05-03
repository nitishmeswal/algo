/** When the blotter has no symbols yet, still offer common liquid names for typeahead. */
const FALLBACK_TICKERS: readonly string[] = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'META',
  'NVDA',
  'TSLA',
  'JPM',
  'V',
  'UNH',
  'XOM',
  'LLY',
  'JNJ',
  'WMT',
  'MA',
  'PG',
  'ORCL',
  'HD',
  'COST',
  'BAC',
  'DIS',
  'ADBE',
  'CRM',
  'NFLX',
  'AMD',
  'INTC',
  'CSCO',
  'PEP',
  'KO',
  'TMO',
  'SPY',
  'QQQ',
  'IWM',
  'DIA',
]

const MAX_EMPTY = 24
const MAX_FILTERED = 40

export type SymbolTypeaheadOption = { value: string }

/** Unique, sorted symbols from the book plus fallbacks; then prefix / substring match on `rawInput`. */
export function buildSymbolTypeaheadOptions(rawInput: string, bookSymbols: readonly string[]): SymbolTypeaheadOption[] {
  const fromBook = bookSymbols.map((s) => s.trim().toUpperCase()).filter(Boolean)
  const merged = [...new Set([...fromBook, ...FALLBACK_TICKERS])]
  merged.sort((a, b) => a.localeCompare(b))

  const q = rawInput.trim().toUpperCase()
  if (!q) {
    return merged.slice(0, MAX_EMPTY).map((value) => ({ value }))
  }

  const starts = merged.filter((s) => s.startsWith(q))
  const contains = merged.filter((s) => !starts.includes(s) && s.includes(q))
  return [...starts, ...contains].slice(0, MAX_FILTERED).map((value) => ({ value }))
}
