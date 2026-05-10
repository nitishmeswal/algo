import { DownloadOutlined, FilterOutlined, LayoutOutlined } from '@ant-design/icons'
import { Button, Card, Collapse, Empty, message, Pagination, Segmented, Spin, Table, Tag, Typography } from 'antd'
import type { CollapseProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  type DeskAuditRowDto,
  type DeskAuditStreamQuery,
  fetchDeskAuditPage,
} from './deskAuditApi'
import { downloadDeskAuditCsv } from './exportDeskAuditCsv'

const VIEW_STORAGE_KEY = 'flow-desk-desk-audit-view'
const PAGE_SIZE = 50

export type DeskAuditLayoutMode = 'timeline' | 'byOrder'

function readStoredLayoutMode(): DeskAuditLayoutMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_KEY)
    if (v === 'byOrder' || v === 'timeline') return v
  } catch {
    /* ignore */
  }
  return 'timeline'
}

function persistLayoutMode(mode: DeskAuditLayoutMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function formatDeskAuditWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${m}:${s}`
}

export function badgeForEvent(row: DeskAuditRowDto): { label: string; color: string } {
  const t = row.eventType
  const sum = row.summary.toLowerCase()

  if (t === 'order_created') return { label: 'Order created', color: 'blue' }
  if (t === 'order_updated') {
    if (/\bfill(ed)?\b|\bpartial\b|\bworking\b/.test(sum)) return { label: 'Order filled', color: 'green' }
    return { label: 'Order updated', color: 'blue' }
  }
  if (t === 'order_cancelled') return { label: 'Order cancelled', color: 'blue' }
  if (t === 'order_rejected') return { label: 'Order rejected', color: 'red' }
  if (t === 'agent_tool_call') return { label: 'Agent tool call', color: 'purple' }
  if (t === 'agent_decision') {
    return row.agentDecisionOutcome === 'bad'
      ? { label: 'Agent decision', color: 'red' }
      : { label: 'Agent decision', color: 'green' }
  }
  if (t === 'breach_detected') return { label: 'Breach detected', color: 'gold' }
  if (t === 'breach_insight') return { label: 'Breach insight', color: 'orange' }
  if (t === 'nlp_filter') return { label: 'NLP filter', color: 'cyan' }
  return { label: t.replace(/_/g, ' '), color: 'default' }
}

function rowGroupKey(row: DeskAuditRowDto): string {
  if (row.orderId) return `order:${row.orderId}`
  if (row.sessionId) return `session:${row.sessionId}`
  return 'desk'
}

function groupLabel(key: string): string {
  if (key === 'desk') return 'Desk (no order)'
  if (key.startsWith('session:')) {
    const sid = key.slice('session:'.length)
    const short = sid.length > 12 ? `${sid.slice(0, 8)}…` : sid
    return `Agent session · ${short}`
  }
  if (key.startsWith('order:')) {
    const oid = key.slice('order:'.length)
    return `Order ${oid}`
  }
  return key
}

type AuditGroup = {
  key: string
  label: string
  rows: DeskAuditRowDto[]
  lastAt: string
}

function buildGroups(rows: DeskAuditRowDto[]): AuditGroup[] {
  const map = new Map<string, DeskAuditRowDto[]>()
  for (const r of rows) {
    const k = rowGroupKey(r)
    const list = map.get(k) ?? []
    list.push(r)
    map.set(k, list)
  }
  const groups: AuditGroup[] = []
  for (const [key, list] of map) {
    const sorted = [...list].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const lastAt = sorted[0]?.at ?? ''
    groups.push({
      key,
      label: groupLabel(key),
      rows: sorted,
      lastAt,
    })
  }
  groups.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
  return groups
}

const STREAM_OPTIONS: { label: string; value: DeskAuditStreamQuery }[] = [
  { label: 'All', value: 'all' },
  { label: 'Orders', value: 'orders' },
  { label: 'Agent', value: 'agent' },
  { label: 'Breach', value: 'breach' },
  { label: 'NLP', value: 'nlp' },
]

const LAYOUT_OPTIONS: { label: string; value: DeskAuditLayoutMode }[] = [
  { label: 'Timeline', value: 'timeline' },
  { label: 'By order', value: 'byOrder' },
]

export function DeskAuditHub() {
  const [layoutMode, setLayoutMode] = useState<DeskAuditLayoutMode>(() => readStoredLayoutMode())
  const [streamFilter, setStreamFilter] = useState<DeskAuditStreamQuery>('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<DeskAuditRowDto[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDeskAuditPage({ stream: streamFilter, page })
      if (data.rows.length === 0 && !data.hasMore && page > 1) {
        setRows([])
        setHasMore(false)
        setPage(1)
        return
      }
      setRows(data.rows)
      setHasMore(data.hasMore)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audit log')
      setRows([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [streamFilter, page])

  useEffect(() => {
    void load()
  }, [load])

  const onStreamChange = (v: DeskAuditStreamQuery) => {
    setStreamFilter(v)
    setPage(1)
    setOpenGroupKeys([])
  }

  const onLayoutChange = (v: DeskAuditLayoutMode) => {
    setLayoutMode(v)
    persistLayoutMode(v)
    setOpenGroupKeys([])
  }

  const columns: ColumnsType<DeskAuditRowDto> = useMemo(
    () => [
      {
        title: 'When',
        dataIndex: 'at',
        key: 'at',
        width: 172,
        render: (iso: string) => (
          <Typography.Text type="secondary" className="desk-audit-hub__mono" ellipsis={{ tooltip: iso }}>
            {formatDeskAuditWhen(iso)}
          </Typography.Text>
        ),
      },
      {
        title: 'Event',
        key: 'badge',
        width: 168,
        render: (_: unknown, record) => {
          const b = badgeForEvent(record)
          return (
            <Tag bordered className="desk-audit-hub__stream-tag" color={b.color}>
              {b.label}
            </Tag>
          )
        },
      },
      {
        title: 'Summary',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: true,
      },
      {
        title: 'Source',
        dataIndex: 'source',
        key: 'source',
        width: 100,
        render: (src: DeskAuditRowDto['source']) => (
          <Typography.Text className="desk-audit-hub__mono" strong>
            {src}
          </Typography.Text>
        ),
      },
    ],
    [],
  )

  const groups = useMemo(() => buildGroups(rows), [rows])

  const paginationTotal = useMemo(() => {
    const listTotal = (page - 1) * PAGE_SIZE + rows.length
    if (hasMore) return Math.max(listTotal, page * PAGE_SIZE + 1)
    return listTotal
  }, [page, rows.length, hasMore])

  const showPagination = !loading && (rows.length > 0 || page > 1 || hasMore)

  const collapseItems: CollapseProps['items'] = useMemo(
    () =>
      groups.map((g) => ({
        key: g.key,
        label: (
          <div className="desk-audit-hub__group-head">
            <Typography.Text strong className="desk-audit-hub__group-title">
              {g.label}
            </Typography.Text>
            <Typography.Text type="secondary" className="desk-audit-hub__group-meta">
              {g.rows.length} event{g.rows.length === 1 ? '' : 's'} · last {formatDeskAuditWhen(g.lastAt)}
            </Typography.Text>
          </div>
        ),
        children: (
          <Table<DeskAuditRowDto>
            size="small"
            tableLayout="fixed"
            pagination={false}
            rowKey={(r) => `${r.stream}-${r.id}`}
            columns={columns}
            dataSource={g.rows}
            scroll={{ x: 'max-content' }}
            className="desk-audit-hub__table desk-audit-hub__table--nested"
            showHeader
          />
        ),
      })),
    [groups, columns],
  )

  const onDownloadCsv = () => {
    if (rows.length === 0) {
      void message.warning('Nothing to export on this page.')
      return
    }
    downloadDeskAuditCsv(rows, { stream: streamFilter, page })
    void message.success(rows.length === 1 ? 'Downloaded 1 event' : `Downloaded ${rows.length} events`)
  }

  return (
    <div className="desk-audit-hub">
      <div className="desk-audit-hub__toolbar">
        <div className="desk-audit-hub__toolbar-text">
          <Typography.Title level={4} className="desk-audit-hub__title">
            Audit log
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="desk-audit-hub__subtitle">
            {layoutMode === 'timeline'
              ? 'Chronological feed (50 events per page). Switch to By order to collapse this page into buckets.'
              : 'Events on this page grouped by order, session, or desk. Pagination is still by event window — expand a row to inspect.'}
          </Typography.Paragraph>
        </div>
        <div className="desk-audit-hub__toolbar-actions">
          <div className="desk-audit-hub__export-block">
            <div className="desk-audit-hub__export-title-row">
              <DownloadOutlined className="desk-audit-hub__export-icon" aria-hidden />
              <Typography.Text className="desk-audit-hub__export-label">Export</Typography.Text>
            </div>
            <Typography.Text type="secondary" className="desk-audit-hub__export-hint">
              Events on this page only (stream filter and pagination).
            </Typography.Text>
            <Button
              type="default"
              size="small"
              className="desk-audit-hub__export-btn"
              title="Exports this page only (respects stream filter and pagination)"
              disabled={loading || rows.length === 0}
              onClick={onDownloadCsv}
            >
              Download CSV
            </Button>
          </div>
          <div className="desk-audit-hub__actions-sep" aria-hidden />
          <div className="desk-audit-hub__filter-block">
            <div className="desk-audit-hub__filter-label-row">
              <FilterOutlined className="desk-audit-hub__filter-icon desk-audit-hub__filter-icon--stream" aria-hidden />
              <Typography.Text className="desk-audit-hub__filter-label desk-audit-hub__filter-label--stream">
                Stream
              </Typography.Text>
            </div>
            <Typography.Text type="secondary" className="desk-audit-hub__filter-hint">
              Which events appear in the feed
            </Typography.Text>
            <Segmented<DeskAuditStreamQuery>
              options={STREAM_OPTIONS}
              value={streamFilter}
              onChange={(v) => onStreamChange(v as DeskAuditStreamQuery)}
              className="desk-audit-hub__segmented"
            />
          </div>
          <div className="desk-audit-hub__actions-sep" aria-hidden />
          <div className="desk-audit-hub__filter-block">
            <div className="desk-audit-hub__filter-label-row">
              <LayoutOutlined className="desk-audit-hub__filter-icon desk-audit-hub__filter-icon--view" aria-hidden />
              <Typography.Text className="desk-audit-hub__filter-label desk-audit-hub__filter-label--view">
                View
              </Typography.Text>
            </div>
            <Typography.Text type="secondary" className="desk-audit-hub__filter-hint">
              Timeline vs grouped by order
            </Typography.Text>
            <Segmented<DeskAuditLayoutMode>
              options={LAYOUT_OPTIONS}
              value={layoutMode}
              onChange={(v) => onLayoutChange(v as DeskAuditLayoutMode)}
              className="desk-audit-hub__segmented"
            />
          </div>
        </div>
      </div>

      {error ? (
        <Typography.Text type="danger" style={{ display: 'block', marginBottom: 12 }}>
          {error}
        </Typography.Text>
      ) : null}

      <Card className="app-card desk-audit-hub__table-card" bordered={false}>
        <div className="desk-audit-hub__table-card-body">
          <div className="desk-audit-hub__table-main">
            <Spin spinning={loading}>
              {!loading && rows.length === 0 ? (
                <Empty description="No audit events yet" style={{ margin: '32px 0' }} />
              ) : layoutMode === 'timeline' ? (
                <Table<DeskAuditRowDto>
                  size="small"
                  tableLayout="fixed"
                  pagination={false}
                  rowKey={(r) => `${r.stream}-${r.id}`}
                  columns={columns}
                  dataSource={rows}
                  scroll={{ x: 'max-content' }}
                  className="desk-audit-hub__table"
                  aria-label="Desk audit log timeline"
                />
              ) : (
                <Collapse
                  bordered={false}
                  className="desk-audit-hub__group-collapse"
                  activeKey={openGroupKeys}
                  onChange={(keys) =>
                    setOpenGroupKeys(keys == null ? [] : Array.isArray(keys) ? keys : [keys as string])
                  }
                  items={collapseItems}
                  expandIconPosition="end"
                />
              )}
            </Spin>
          </div>
          {showPagination ? (
            <div className="desk-audit-hub__pagination-bar">
              <div className="desk-audit-hub__pagination-rail">
                <Typography.Text type="secondary" className="desk-audit-hub__pagination-meta">
                  Page {page} · {rows.length} event{rows.length === 1 ? '' : 's'} · {PAGE_SIZE} per page
                  {hasMore ? ' · more ahead' : ''}
                </Typography.Text>
                <Pagination
                  size="small"
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={paginationTotal}
                  onChange={(p) => setPage(p)}
                  disabled={loading}
                  showSizeChanger={false}
                  showQuickJumper={false}
                  showLessItems
                  className="desk-audit-hub__pagination"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
