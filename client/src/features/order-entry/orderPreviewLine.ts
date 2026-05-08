import type { OrderEntryPayload } from '../blotter/api/submitOrder'

function fmtPx(n: unknown): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

const TIF_SHORT: Record<string, string> = {
  day: 'DAY',
  gtc: 'GTC',
  gtd: 'GTD',
  ioc: 'IOC',
  fok: 'FOK',
  at_open: 'OPG',
  at_close: 'CLS',
}

/** One-line summary for the ticket preview row. */
export function buildOrderPreviewLine(v: Partial<OrderEntryPayload> & Record<string, unknown>): string {
  const side = v.side
  const sideLabel = side === 'buy' ? 'Buy' : side === 'sell' ? 'Sell' : ''
  const sym = typeof v.symbol === 'string' ? v.symbol.trim().toUpperCase() : ''
  const qty = v.quantity
  const qtyLabel = typeof qty === 'number' && Number.isFinite(qty) ? String(qty) : ''

  const ot = (v.orderType ?? 'limit') as OrderEntryPayload['orderType']
  const limitPrice = v.limitPrice as number | undefined
  const stopPrice = v.stopPrice as number | undefined
  const tif = v.timeInForce as string | undefined
  const venue = typeof v.venue === 'string' ? v.venue.trim() : ''
  const tifShort = tif ? TIF_SHORT[tif] ?? tif.toUpperCase() : ''

  let pxPart = ''
  if (ot === 'market') pxPart = 'MKT'
  else if (ot === 'stop') pxPart = stopPrice != null ? `stop ${fmtPx(stopPrice)}` : 'stop —'
  else if (ot === 'stop_limit') pxPart = `limit ${fmtPx(limitPrice)} · stop ${fmtPx(stopPrice)}`
  else pxPart = limitPrice != null ? `limit ${fmtPx(limitPrice)}` : 'limit —'

  const parts: string[] = []
  if (sideLabel && qtyLabel && sym) parts.push(`${sideLabel} ${qtyLabel} ${sym}`)
  else parts.push('—')
  parts.push(pxPart)
  if (tifShort) parts.push(tifShort)
  if (venue) parts.push(`@ ${venue}`)
  const suffix: string[] = []
  if (tif === 'gtd' && typeof v.expireAt === 'string' && v.expireAt.trim() !== '') {
    suffix.push(`exp ${v.expireAt.trim()}`)
  }
  const dq = v.displayQuantity
  if (typeof dq === 'number' && Number.isFinite(dq)) suffix.push(`show ${dq}`)
  const tag = typeof v.strategyTag === 'string' ? v.strategyTag.trim() : ''
  if (tag) suffix.push(`#${tag}`)
  const cl = typeof v.clientOrderId === 'string' ? v.clientOrderId.trim() : ''
  if (cl) suffix.push(`ClID ${cl}`)

  let line = parts.join(' · ')
  if (suffix.length) line = `${line} · ${suffix.join(' · ')}`
  return line
}

export function orderPreviewIncomplete(v: Partial<OrderEntryPayload>): boolean {
  if (!v.symbol?.trim() || !v.side || v.quantity == null) return true
  const ot = v.orderType ?? 'limit'
  if (ot === 'limit' || ot === 'stop_limit') {
    if (v.limitPrice == null) return true
  }
  if (ot === 'stop' || ot === 'stop_limit') {
    if (v.stopPrice == null) return true
  }
  if (!v.timeInForce) return true
  if (!v.venue?.trim()) return true
  if (v.timeInForce === 'gtd' && (!v.expireAt || String(v.expireAt).trim() === '')) return true
  return false
}
