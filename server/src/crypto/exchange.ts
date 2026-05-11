import ccxt, { type Exchange } from 'ccxt'
import type { Candle, Ticker } from '../../../shared/crypto/types.js'

/**
 * Exchange selection priority:
 * 1. CRYPTO_EXCHANGE env var (e.g. "binance", "bybit", "kraken", "kucoin")
 * 2. Auto-detect: try bybit (global), then kucoin, then kraken, then binance
 */

const EXCHANGE_CANDIDATES = ['bybit', 'kucoin', 'kraken', 'binance'] as const
let detectedExchange: string | null = null

let publicExchange: Exchange | null = null
let privateExchange: Exchange | null = null

function createExchange(id: string, opts: Record<string, unknown> = {}): Exchange {
  const ExClass = (ccxt as unknown as Record<string, new (o: Record<string, unknown>) => Exchange>)[id]
  if (!ExClass) throw new Error(`Unknown exchange: ${id}`)
  return new ExClass({ enableRateLimit: true, ...opts })
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
  const ex = await getPublicExchange()
  const t = await ex.fetchTicker(symbol)
  return {
    symbol,
    price: t.last ?? t.close ?? 0,
    change24h: t.percentage ?? 0,
    high24h: t.high ?? 0,
    low24h: t.low ?? 0,
    volume24h: t.baseVolume ?? 0,
    ts: t.timestamp ?? Date.now(),
  }
}

export async function fetchCandles(
  symbol: string,
  timeframe = '5m',
  limit = 100,
): Promise<Candle[]> {
  const ex = await getPublicExchange()
  const raw = await ex.fetchOHLCV(symbol, timeframe, undefined, limit)
  return raw.map((r) => ({
    ts: r[0] as number,
    o: r[1] as number,
    h: r[2] as number,
    l: r[3] as number,
    c: r[4] as number,
    v: r[5] as number,
  }))
}

export async function fetchBalance(apiKey: string, secret: string) {
  const ex = await getPrivateExchange(apiKey, secret)
  return ex.fetchBalance()
}

export async function placeOrder(
  apiKey: string,
  secret: string,
  symbol: string,
  side: 'buy' | 'sell',
  amount: number,
  price?: number,
) {
  const ex = await getPrivateExchange(apiKey, secret)
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
  const ex = await getPrivateExchange(apiKey, secret)
  return ex.fetchOrder(orderId, symbol)
}

export function getDetectedExchangeName(): string | null {
  return detectedExchange
}
