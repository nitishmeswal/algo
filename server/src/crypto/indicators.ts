import type { Candle, IndicatorSnapshot } from '../../../shared/crypto/types.js'

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((s, v) => s + v, 0) / period
}

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k)
  }
  return prev
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gains = 0
  let losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function macd(
  closes: number[],
): { line: number; signal: number; hist: number } | null {
  const fast = ema(closes, 12)
  const slow = ema(closes, 26)
  if (fast == null || slow == null) return null
  const line = fast - slow

  const macdValues: number[] = []
  const k12 = 2 / 13
  const k26 = 2 / 27
  let ema12 = closes.slice(0, 12).reduce((s, v) => s + v, 0) / 12
  let ema26 = closes.slice(0, 26).reduce((s, v) => s + v, 0) / 26
  for (let i = 12; i < 26; i++) {
    ema12 = closes[i]! * k12 + ema12 * (1 - k12)
  }
  for (let i = 26; i < closes.length; i++) {
    ema12 = closes[i]! * k12 + ema12 * (1 - k12)
    ema26 = closes[i]! * k26 + ema26 * (1 - k26)
    macdValues.push(ema12 - ema26)
  }

  const signal = ema(macdValues, 9)
  if (signal == null) return null
  return { line, signal, hist: line - signal }
}

function bollingerBands(
  closes: number[],
  period = 20,
  stdDevMult = 2,
): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const middle = slice.reduce((s, v) => s + v, 0) / period
  const variance =
    slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period
  const stdDev = Math.sqrt(variance)
  return {
    upper: middle + stdDevMult * stdDev,
    middle,
    lower: middle - stdDevMult * stdDev,
  }
}

function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!
    const pc = candles[i - 1]!.c
    const tr = Math.max(c.h - c.l, Math.abs(c.h - pc), Math.abs(c.l - pc))
    trs.push(tr)
  }
  return sma(trs, period)
}

export function computeIndicators(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.c)
  const volumes = candles.map((c) => c.v)
  const macdResult = macd(closes)
  const bb = bollingerBands(closes)

  return {
    rsi14: rsi(closes, 14),
    sma20: sma(closes, 20),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    macdLine: macdResult?.line ?? null,
    macdSignal: macdResult?.signal ?? null,
    macdHist: macdResult?.hist ?? null,
    bollingerUpper: bb?.upper ?? null,
    bollingerMiddle: bb?.middle ?? null,
    bollingerLower: bb?.lower ?? null,
    atr14: atr(candles, 14),
    volumeSma20: sma(volumes, 20),
    currentVolume: volumes.at(-1) ?? null,
  }
}
