import { Router } from 'express'

import { listDeskAuditMerged, type DeskAuditStreamFilter } from '../db/repos/deskAuditRepo.js'

const PAGE_SIZE = 50

type DeskAuditSourceDto = 'LIVE' | 'BLOTTER' | 'AGENT'

type DeskAuditRowDto = {
  id: string
  at: string
  stream: DeskAuditStreamFilter
  eventType: string
  summary: string
  source: DeskAuditSourceDto
  orderId: string | null
  sessionId: string | null
  /** Present for `agent_decision` — client picks green vs red badge. */
  agentDecisionOutcome: 'ok' | 'bad' | null
}

type DeskAuditListResponse = {
  page: number
  pageSize: number
  hasMore: boolean
  rows: DeskAuditRowDto[]
}

function isDeskAuditStreamFilter(s: string): s is DeskAuditStreamFilter {
  return s === 'orders' || s === 'agent' || s === 'breach' || s === 'nlp'
}

function mapSource(stream: string, rawSource: string): DeskAuditSourceDto {
  if (stream !== 'orders') return 'AGENT'
  if (rawSource === 'live') return 'LIVE'
  return 'BLOTTER'
}

function agentDecisionOutcome(
  eventType: string,
  decision: string | null,
  toolStatus: string | null,
): 'ok' | 'bad' | null {
  if (eventType !== 'agent_decision') return null
  const d = (decision ?? '').toLowerCase()
  const t = (toolStatus ?? '').toLowerCase()
  if (t === 'error' || t === 'failed' || d.includes('reject') || d.includes('escalat') || d.includes('denied')) {
    return 'bad'
  }
  return 'ok'
}

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const rawFilter = typeof req.query.event_type === 'string' ? req.query.event_type.trim().toLowerCase() : ''
    const stream: DeskAuditStreamFilter | null =
      rawFilter === '' || rawFilter === 'all' ? null : isDeskAuditStreamFilter(rawFilter) ? rawFilter : null

    const pageRaw = req.query.page
    const pageNum = typeof pageRaw === 'string' && /^\d+$/.test(pageRaw) ? Math.max(1, parseInt(pageRaw, 10)) : 1
    const offset = (pageNum - 1) * PAGE_SIZE

    const rows = await listDeskAuditMerged({
      stream,
      limit: PAGE_SIZE + 1,
      offset,
    })

    const hasMore = rows.length > PAGE_SIZE
    const slice = hasMore ? rows.slice(0, PAGE_SIZE) : rows

    const payload: DeskAuditListResponse = {
      page: pageNum,
      pageSize: PAGE_SIZE,
      hasMore,
      rows: slice.map((r) => ({
        id: r.id,
        at: r.ts.toISOString(),
        stream: r.stream as DeskAuditStreamFilter,
        eventType: r.event_type,
        summary: r.summary,
        source: mapSource(r.stream, r.raw_source),
        orderId: r.order_id,
        sessionId: r.session_id,
        agentDecisionOutcome: agentDecisionOutcome(r.event_type, r.decision, r.tool_status),
      })),
    }

    res.status(200).json(payload)
  } catch (err) {
    next(err)
  }
})

export const auditRouter = router
