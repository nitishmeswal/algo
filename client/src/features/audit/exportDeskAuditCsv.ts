import type { DeskAuditRowDto, DeskAuditStreamQuery } from './deskAuditApi'

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const HEADERS = [
  'Event ID',
  'At (ISO)',
  'Stream',
  'Event type',
  'Summary',
  'Source',
  'Order ID',
  'Session ID',
  'Agent decision',
] as const

function rowValues(r: DeskAuditRowDto): string[] {
  return [
    r.id,
    r.at,
    r.stream,
    r.eventType,
    r.summary,
    r.source,
    r.orderId ?? '',
    r.sessionId ?? '',
    r.agentDecisionOutcome ?? '',
  ]
}

export function buildDeskAuditCsv(rows: DeskAuditRowDto[]): string {
  const headerLine = HEADERS.map((h) => csvCell(h)).join(',')
  const lines = rows.map((r) => rowValues(r).map(csvCell).join(','))
  return [headerLine, ...lines].join('\r\n')
}

export function downloadDeskAuditCsv(
  rows: DeskAuditRowDto[],
  meta: { stream: DeskAuditStreamQuery; page: number },
): void {
  const body = buildDeskAuditCsv(rows)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const streamPart = meta.stream === 'all' ? 'all' : meta.stream
  const filename = `desk-audit-${streamPart}-p${meta.page}-${stamp}.csv`
  const blob = new Blob(['\uFEFF', body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}
