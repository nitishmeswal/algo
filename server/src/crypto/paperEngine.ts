import { randomUUID } from 'node:crypto'
import type {
  Portfolio,
  Position,
  TradeRecord,
  TradeSide,
} from '../../../shared/crypto/types.js'
import { fetchTicker } from './exchange.js'

const FEE_RATE = 0.001 // 0.1% — standard Binance spot fee

let portfolio: Portfolio = createFreshPortfolio(10)

function createFreshPortfolio(initialBalance: number): Portfolio {
  return {
    balanceUSDT: initialBalance,
    initialBalance,
    totalPnl: 0,
    totalPnlPct: 0,
    positions: [],
    trades: [],
    winRate: 0,
    totalTrades: 0,
    wins: 0,
    losses: 0,
  }
}

export function resetPaperPortfolio(initialBalance: number): Portfolio {
  portfolio = createFreshPortfolio(initialBalance)
  return portfolio
}

export function getPaperPortfolio(): Portfolio {
  return portfolio
}

export async function updatePositionPrices(): Promise<Portfolio> {
  for (const pos of portfolio.positions) {
    try {
      const ticker = await fetchTicker(pos.symbol)
      pos.currentPrice = ticker.price
      pos.unrealizedPnl =
        pos.side === 'buy'
          ? (pos.currentPrice - pos.avgEntryPrice) * pos.quantity
          : (pos.avgEntryPrice - pos.currentPrice) * pos.quantity
    } catch {
      // keep stale price on failure
    }
  }
  recalcPnl()
  return portfolio
}

function recalcPnl(): void {
  const unrealizedTotal = portfolio.positions.reduce(
    (s, p) => s + p.unrealizedPnl,
    0,
  )
  const realizedTotal = portfolio.trades.reduce(
    (s, t) => s + (t.pnl ?? 0),
    0,
  )
  portfolio.totalPnl = realizedTotal + unrealizedTotal
  portfolio.totalPnlPct =
    portfolio.initialBalance > 0
      ? (portfolio.totalPnl / portfolio.initialBalance) * 100
      : 0
}

export async function executePaperTrade(
  symbol: string,
  side: TradeSide,
  quantityUSDT: number,
  model: string,
  reasoning: string,
): Promise<TradeRecord> {
  const ticker = await fetchTicker(symbol)
  const price = ticker.price
  if (price <= 0) throw new Error('Cannot get valid price')

  const fee = quantityUSDT * FEE_RATE
  const netUSDT = quantityUSDT - fee
  const cryptoQty = netUSDT / price

  if (side === 'buy') {
    if (portfolio.balanceUSDT < quantityUSDT) {
      throw new Error(
        `Insufficient balance: ${portfolio.balanceUSDT.toFixed(2)} USDT < ${quantityUSDT.toFixed(2)} USDT`,
      )
    }
    portfolio.balanceUSDT -= quantityUSDT

    const existing = portfolio.positions.find(
      (p) => p.symbol === symbol && p.side === 'buy',
    )
    if (existing) {
      const totalQty = existing.quantity + cryptoQty
      existing.avgEntryPrice =
        (existing.avgEntryPrice * existing.quantity + price * cryptoQty) /
        totalQty
      existing.quantity = totalQty
      existing.currentPrice = price
      existing.unrealizedPnl = 0
    } else {
      const pos: Position = {
        symbol,
        quantity: cryptoQty,
        avgEntryPrice: price,
        currentPrice: price,
        unrealizedPnl: 0,
        side: 'buy',
      }
      portfolio.positions.push(pos)
    }
  } else {
    const existing = portfolio.positions.find(
      (p) => p.symbol === symbol && p.side === 'buy',
    )
    if (!existing || existing.quantity <= 0) {
      throw new Error('No position to sell')
    }
    const sellQty = Math.min(cryptoQty, existing.quantity)
    const proceeds = sellQty * price
    const sellFee = proceeds * FEE_RATE
    portfolio.balanceUSDT += proceeds - sellFee

    const pnl = (price - existing.avgEntryPrice) * sellQty - fee - sellFee
    existing.quantity -= sellQty
    if (existing.quantity < 1e-10) {
      portfolio.positions = portfolio.positions.filter((p) => p !== existing)
    }

    const trade: TradeRecord = {
      id: randomUUID(),
      ts: Date.now(),
      symbol,
      side,
      price,
      quantity: sellQty,
      cost: quantityUSDT,
      fee: fee + sellFee,
      pnl,
      model,
      reasoning,
      paper: true,
    }
    portfolio.trades.push(trade)
    portfolio.totalTrades++
    if (pnl > 0) portfolio.wins++
    else portfolio.losses++
    portfolio.winRate =
      portfolio.totalTrades > 0
        ? (portfolio.wins / portfolio.totalTrades) * 100
        : 0
    recalcPnl()
    return trade
  }

  const trade: TradeRecord = {
    id: randomUUID(),
    ts: Date.now(),
    symbol,
    side,
    price,
    quantity: cryptoQty,
    cost: quantityUSDT,
    fee,
    pnl: 0,
    model,
    reasoning,
    paper: true,
  }
  portfolio.trades.push(trade)
  portfolio.totalTrades++
  recalcPnl()
  return trade
}
