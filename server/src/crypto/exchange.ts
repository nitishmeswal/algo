import ccxt, { type Exchange } from 'ccxt'
import type { Candle, Ticker } from '../../../shared/crypto/types.js'

/**
 * Exchange selection priority:
 * 1. CRYPTO_EXCHANGE env var (e.g. "binance", "bybit", "kraken", "kucoin")
 * 2. Auto-detect: try bybit (global), then kucoin, then kraken, then binance
 */

const EXCHANGE_CANDIDATES = ['bybit', 'kucoin', 'kraken', 'binance'] as const
const REQUEST_TIMEOUT_MS = 15_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1_500

let detectedExchange: string | null = null
let publicExchange: Exchange | null = null
let privateExchange: Exchange | null = null

function createExchange(id: string, opts: Record<string, unknown> = {}): Exchange {
  const ExClass = (ccxt as unknown as Record<string, new (o: Record<string, unknown>) => Exchange>)[id]
  if (!ExClass) throw new Error(`Unknown exchange: ${id}`)
  return new ExClass({
    enableRateLimit: true,
    timeout: REQUEST_TIMEOUT_MS,
    ...opts,
  })
}

async function detectExchange(): Promise<string> {
  if (detectedExchange) return detectedExchange
  const envEx = process.env.CRYPTO_EXCHANGE?.trim().toLowerCase()
  if (envEx) {
    detectedExchange = envEx
    console.log(`[exchange] Using configured exchange: ${envEx}`)
    return envEx
  }
  for (const candidate of EXCHANGE_CANDIDATES) {
    try {
      const ex = createExchange(candidate)
      await ex.fetchTicker('BTC/USDT')
      detectedExchange = candidate
      console.log(`[exchange] Auto-detected working exchange: ${candidate}`)
      return candidate
    } catch {
      console.log(`[exchange] ${candidate} not accessible, trying next...`)
    }
  }
  throw new Error('No working crypto exchange found. Set CRYPTO_EXCHANGE env var or check network.')
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const isRetryable =
        err instanceof ccxt.NetworkError ||
        err instanceof ccxt.RequestTimeout ||
        err instanceof ccxt.ExchangeNotAvailable ||
        err instanceof ccxt.DDoSProtection
      if (!isRetryable || attempt === MAX_RETRIES) break
      const delay = RETRY_DELAY_MS * (attempt + 1)
      console.warn(`[exchange] ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
      await new Promise((r) => setTimeout(r, delay))
      // Re-create exchange instance on network errors to clear stale connections
      publicExchange = null
    }
  }
  throw lastErr
}

export async function getPublicExchange(): Promise<Exchange> {
  if (publicExchange) return publicExchange
  const id = await detectExchange()
  publicExchange = createExchange(id)
  return publicExchange
}

export async function getPrivateExchange(apiKey: string, secret: string): Promise<Exchange> {
  const id = await detectExchange()
  if (
    privateExchange &&
    (privateExchange as unknown as { apiKey: string }).apiKey === apiKey
  ) {
    return privateExchange
  }
  privateExchange = createExchange(id, { apiKey, secret })
  return privateExchange
}

export function hasPrivateExchange(): boolean {
  return privateExchange !== null
}

export async function fetchTicker(symbol: string): Promise<Ticker> {
  return withRetry(async () => {
    const ex = await getPublicExchange()
    const t = await ex.fetchTicker(symbol)
    const price = t.last ?? t.close ?? 0
    if (price <= 0) throw new Error(`Invalid price for ${symbol}: ${price}`)
    return {
      symbol,
      price,
      change24h: t.percentage ?? 0,
      high24h: t.high ?? 0,
      low24h: t.low ?? 0,
      volume24h: t.baseVolume ?? 0,
      ts: t.timestamp ?? Date.now(),
    }
  }, `fetchTicker(${symbol})`)
}

export async function fetchCandles(
  symbol: string,
  timeframe = '5m',
  limit = 100,
): Promise<Candle[]> {
  return withRetry(async () => {
    const ex = await getPublicExchange()
    const raw = await ex.fetchOHLCV(symbol, timeframe, undefined, limit)
    if (!raw || raw.length === 0) throw new Error(`No candle data for ${symbol}`)
    return raw.map((r) => ({
      ts: r[0] as number,
      o: r[1] as number,
      h: r[2] as number,
      l: r[3] as number,
      c: r[4] as number,
      v: r[5] as number,
    }))
  }, `fetchCandles(${symbol})`)
}

export async function fetchBalance(apiKey: string, secret: string) {
  return withRetry(async () => {
    const ex = await getPrivateExchange(apiKey, secret)
    return ex.fetchBalance()
  }, 'fetchBalance')
}

export async function placeOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: 'buy' | 'sell',
  amount: number,
  price?: number,
) {
  if (amount <= 0) throw new Error(`Invalid order amount: ${amount}`)
  const ex = await getPrivateExchange(apiKey, secret)
  // No retry on order placement — never risk duplicate orders
  if (price) {
    return ex.createLimitOrder(symbol, side, amount, price)
  }
  return ex.createMarketOrder(symbol, side, amount)
}

export async function fetchOrderStatus(
  apiKey: string,
  secret: string,
  orderId: string,
  symbol: string,
) {
  return withRetry(async () => {
    const ex = await getPrivateExchange(apiKey, secret)
    return ex.fetchOrder(orderId, symbol)
  }, `fetchOrderStatus(${orderId})`)
}

export function getDetectedExchangeName(): string | null {
  return detectedExchange
}

export function resetExchangeConnection(): void {
  publicExchange = null
  privateExchange = null
  detectedExchange = null
}
