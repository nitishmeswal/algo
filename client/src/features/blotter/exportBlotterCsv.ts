import type { Order, OrderStatus } from './types'

function formatStatusLabel(status: OrderStatus): string {
  return status.replace(/_/g, ' ')
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function numOrEmpty(v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return ''
  return String(v)
}

/** Column order and headers align with `BlotterTable` visible columns. */
const ROW_ACCESSORS: { header: string; value: (o: Order) => string }[] = [
  { header: 'Order ID', value: (o) => String(o.id) },
  { header: 'Client ID', value: (o) => o.clientOrderId ?? '' },
  { header: 'Account', value: (o) => o.account ?? '' },
  { header: 'Counterparty', value: (o) => o.counterparty ?? '' },
  { header: 'Symbol', value: (o) => o.symbol },
  { header: 'Side', value: (o) => o.side.toUpperCase() },
  { header: 'Quantity', value: (o) => String(o.quantity) },
  { header: 'Limit Price', value: (o) => numOrEmpty(o.limitPrice) },
  { header: 'Avg Fill Px', value: (o) => numOrEmpty(o.averageFillPrice) },
  { header: 'Filled Qty', value: (o) => String(o.filledQuantity) },
  { header: 'P&L', value: (o) => String(o.pnl) },
  { header: 'Status', value: (o) => formatStatusLabel(o.status) },
  { header: 'TIF', value: (o) => o.timeInForce },
  { header: 'Venue', value: (o) => o.venue ?? '' },
  { header: 'Rejection Reason', value: (o) => o.rejectionReason ?? '' },
  { header: 'Created At', value: (o) => o.createdAt },
  { header: 'Updated At', value: (o) => o.updatedAt },
]

export function buildBlotterCsv(orders: Order[]): string {
  const headerLine = ROW_ACCESSORS.map((c) => csvCell(c.header)).join(',')
  const lines = orders.map((row) =>
    ROW_ACCESSORS.map((c) => csvCell(c.value(row))).join(','),
  )
  return [headerLine, ...lines].join('\r\n')
}

export function downloadBlotterCsv(orders: Order[]): void {
  const body = buildBlotterCsv(orders)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `blotter-export-${stamp}.csv`
  const blob = new Blob(['\uFEFF', body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
