/** Exact product universe for agentic trade booking (case-insensitive input → uppercase). */
export const ALLOWED_TRADE_SYMBOLS = ['AAPL', 'AMZN', 'GOOGL', 'MSFT', 'META', 'GSCO'] as const

export type AllowedTradeSymbol = (typeof ALLOWED_TRADE_SYMBOLS)[number]

/** Stub reference mid until market data exists — used for risk notional and price band checks. */
export const REFERENCE_PRICE_USD: Record<AllowedTradeSymbol, number> = {
  AAPL: 200,
  AMZN: 190,
  GOOGL: 175,
  MSFT: 400,
  META: 500,
  GSCO: 450,
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function maxOrderQuantity(): number {
  return envNumber('TRADE_BOOKING_MAX_QTY', 1_000_000)
}

export function maxOrderNotionalUsd(): number {
  return envNumber('TRADE_BOOKING_MAX_NOTIONAL_USD', 50_000_000)
}

/** Half-width of acceptable price band as a fraction of reference (e.g. 0.15 → ±15%). */
export function priceBandHalfWidth(): number {
  return envNumber('TRADE_BOOKING_PRICE_BAND_PCT', 0.15)
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase()
}

export function referencePriceForSymbol(symbol: string): number | undefined {
  const s = normalizeSymbol(symbol) as AllowedTradeSymbol
  return REFERENCE_PRICE_USD[s]
}
