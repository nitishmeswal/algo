import type { ParsedOrderFilter } from './parsedOrderFilter'
import { isParsedOrderFilterEmpty } from './parsedOrderFilter'

function fmtStatus(s: string): string {
  return s.replace(/_/g, ' ')
}

function trunc(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

export type AppliedFilterChip = { key: string; label: string; variant?: 'warn' }

/** Compact labels for minimal chip row under the NLP filter input. */
export function appliedFilterChips(f: ParsedOrderFilter): AppliedFilterChip[] {
  if (isParsedOrderFilterEmpty(f)) return []

  const out: AppliedFilterChip[] = []
  if (f.symbol != null) out.push({ key: 'sym', label: f.symbol.toUpperCase() })
  if (f.side != null) out.push({ key: 'side', label: f.side === 'buy' ? 'Buy' : 'Sell' })
  if (f.status != null && f.status.length > 0) {
    const labels = f.status.map(fmtStatus)
    const label =
      labels.length <= 2
        ? labels.join(' · ')
        : `${labels.slice(0, 2).join(' · ')} +${labels.length - 2}`
    out.push({ key: 'status', label })
  }
  if (f.timeInForce != null && f.timeInForce.length > 0) {
    out.push({ key: 'tif', label: f.timeInForce.map((t) => t.toUpperCase()).join(' · ') })
  }
  if (f.venue != null) out.push({ key: 'venue', label: f.venue })
  if (f.account != null) out.push({ key: 'acct', label: f.account })
  if (f.counterparty != null) out.push({ key: 'cp', label: f.counterparty })
  if (f.clientOrderId != null) out.push({ key: 'clid', label: `ClID ${trunc(f.clientOrderId, 14)}` })
  if (f.idContains != null) out.push({ key: 'id', label: `ID ${trunc(f.idContains, 16)}` })
  if (f.rejectionReasonContains != null) {
    out.push({ key: 'rej', label: `Reject ${trunc(f.rejectionReasonContains, 18)}` })
  }
  if (f.quantityMin != null || f.quantityMax != null) {
    const lo = f.quantityMin != null ? `≥${f.quantityMin}` : ''
    const hi = f.quantityMax != null ? `≤${f.quantityMax}` : ''
    const mid =
      f.quantityMin != null && f.quantityMax != null ? `${f.quantityMin}–${f.quantityMax}` : [lo, hi].filter(Boolean).join(' ')
    out.push({ key: 'qty', label: `Qty ${mid}`.trim() })
  }
  if (f.filledQuantityMin != null || f.filledQuantityMax != null) {
    const mid =
      f.filledQuantityMin != null && f.filledQuantityMax != null
        ? `${f.filledQuantityMin}–${f.filledQuantityMax}`
        : [f.filledQuantityMin != null ? `≥${f.filledQuantityMin}` : '', f.filledQuantityMax != null ? `≤${f.filledQuantityMax}` : '']
            .filter(Boolean)
            .join(' ')
    out.push({ key: 'filled', label: `Filled ${mid}`.trim() })
  }
  if (f.limitPriceMin != null || f.limitPriceMax != null) {
    const mid =
      f.limitPriceMin != null && f.limitPriceMax != null
        ? `${f.limitPriceMin}–${f.limitPriceMax}`
        : [f.limitPriceMin != null ? `≥${f.limitPriceMin}` : '', f.limitPriceMax != null ? `≤${f.limitPriceMax}` : '']
            .filter(Boolean)
            .join(' ')
    out.push({ key: 'lmt', label: `Lmt ${mid}`.trim() })
  }
  if (f.pnlMin != null || f.pnlMax != null) {
    const mid =
      f.pnlMin != null && f.pnlMax != null
        ? `${f.pnlMin}–${f.pnlMax}`
        : [f.pnlMin != null ? `≥${f.pnlMin}` : '', f.pnlMax != null ? `≤${f.pnlMax}` : ''].filter(Boolean).join(' ')
    out.push({ key: 'pnl', label: `P&L ${mid}`.trim() })
  }
  if (f.createdAtOrAfter != null || f.createdAtOrBefore != null) out.push({ key: 'crt', label: 'Created' })
  if (f.updatedAtOrAfter != null || f.updatedAtOrBefore != null) out.push({ key: 'upd', label: 'Updated' })
  if (f.confidence != null && f.confidence < 0.65) {
    out.push({ key: 'conf', label: `~${Math.round(f.confidence * 100)}% conf`, variant: 'warn' })
  }

  return out
}

/** One-line human summary of the structured filter shown after Apply. */
export function formatAppliedFilterSummary(f: ParsedOrderFilter): string {
  if (isParsedOrderFilterEmpty(f)) return 'No constraints — full book'

  const parts: string[] = []
  if (f.symbol != null) parts.push(`Symbol ${f.symbol}`)
  if (f.side != null) parts.push(f.side === 'buy' ? 'Buy' : 'Sell')
  if (f.status != null && f.status.length > 0) {
    parts.push(f.status.length === 1 ? `Status: ${fmtStatus(f.status[0]!)}` : `Status: ${f.status.length} selected`)
  }
  if (f.timeInForce != null && f.timeInForce.length > 0) {
    parts.push(`TIF: ${f.timeInForce.join(', ').toUpperCase()}`)
  }
  if (f.venue != null) parts.push(`Venue ${f.venue}`)
  if (f.account != null) parts.push(`Account ${f.account}`)
  if (f.counterparty != null) parts.push(`CP ${f.counterparty}`)
  if (f.clientOrderId != null) parts.push(`Client ID match`)
  if (f.idContains != null) parts.push(`Id contains “${f.idContains}”`)
  if (f.rejectionReasonContains != null) parts.push(`Reject reason contains “${f.rejectionReasonContains}”`)
  if (f.quantityMin != null || f.quantityMax != null) {
    const lo = f.quantityMin != null ? `≥ ${f.quantityMin}` : ''
    const hi = f.quantityMax != null ? `≤ ${f.quantityMax}` : ''
    parts.push(`Qty ${[lo, hi].filter(Boolean).join(' ')}`.trim())
  }
  if (f.filledQuantityMin != null || f.filledQuantityMax != null) {
    const lo = f.filledQuantityMin != null ? `≥ ${f.filledQuantityMin}` : ''
    const hi = f.filledQuantityMax != null ? `≤ ${f.filledQuantityMax}` : ''
    parts.push(`Filled ${[lo, hi].filter(Boolean).join(' ')}`.trim())
  }
  if (f.limitPriceMin != null || f.limitPriceMax != null) {
    const lo = f.limitPriceMin != null ? `≥ ${f.limitPriceMin}` : ''
    const hi = f.limitPriceMax != null ? `≤ ${f.limitPriceMax}` : ''
    parts.push(`Limit px ${[lo, hi].filter(Boolean).join(' ')}`.trim())
  }
  if (f.pnlMin != null || f.pnlMax != null) {
    const lo = f.pnlMin != null ? `≥ ${f.pnlMin}` : ''
    const hi = f.pnlMax != null ? `≤ ${f.pnlMax}` : ''
    parts.push(`P&L ${[lo, hi].filter(Boolean).join(' ')}`.trim())
  }
  if (f.createdAtOrAfter != null || f.createdAtOrBefore != null) {
    parts.push('Created range')
  }
  if (f.updatedAtOrAfter != null || f.updatedAtOrBefore != null) {
    parts.push('Updated range')
  }
  if (f.confidence != null && f.confidence < 0.65) {
    parts.push(`Low confidence (${f.confidence.toFixed(2)})`)
  }

  return parts.join(' · ') || 'Custom filter'
}
