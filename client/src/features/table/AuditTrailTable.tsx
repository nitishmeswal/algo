import { Alert, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { OrderAuditEventDto } from '../blotter/api/orderAuditApi'
import { useOrderAudit } from '../blotter/audit/useOrderAudit'
import type { Order } from '../blotter/types'

export type AuditTrailTableProps =
  | { state: 'empty'; message: string }
  | { state: 'single'; orderId: string; order: Order | undefined }

type AuditTrailRow = {
  key: string
  time: string
  event: string
  summary: string
  source: string
  tagColor?: string
  children?: AuditTrailRow[]
}

/** Fixed-width `HH:mm:ss` in local time — avoids locale wrapping and mid-string breaks in narrow cells. */
function formatAuditTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.length >= 19 ? iso.slice(11, 19) : '—'
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function humanizeEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ')
}

function eventTagColor(eventType: string): string | undefined {
  switch (eventType) {
    case 'order_created':
      return 'success'
    case 'order_updated':
      return 'processing'
    case 'order_cancelled':
      return 'default'
    case 'order_rejected':
      return 'error'
    default:
      return 'default'
  }
}

function buildAuditTree(order: Order | undefined, orderId: string, events: OrderAuditEventDto[]): AuditTrailRow[] {
  const visible = events.filter((e) => e.eventType !== 'heartbeat')
  const rootSummary = order
    ? `${order.symbol} · ${order.side} · ${order.quantity}${order.limitPrice != null ? ` @ ${order.limitPrice}` : ''} · ${order.status}`
    : orderId

  const root: AuditTrailRow = {
    key: `ord-${orderId}`,
    time: '—',
    event: 'Order',
    summary: rootSummary,
    source: 'BLOTTER',
    tagColor: 'blue',
    children: visible.map((e) => ({
      key: e.id,
      time: formatAuditTime(e.emittedAt),
      event: humanizeEventType(e.eventType),
      summary: e.summary,
      source: e.source.toUpperCase(),
      tagColor: eventTagColor(e.eventType),
    })),
  }
  return [root]
}

const columns: ColumnsType<AuditTrailRow> = [
  {
    title: '',
    key: 'tree',
    width: 44,
    minWidth: 44,
    className: 'audit-trail-table-col-tree',
    render: () => null,
  },
  {
    title: 'Time',
    dataIndex: 'time',
    key: 'time',
    width: 92,
    minWidth: 92,
    className: 'audit-trail-table-col-time',
    render: (t: string) => (
      <span className="audit-trail-table__mono" title={t}>
        {t}
      </span>
    ),
  },
  {
    title: 'Event',
    dataIndex: 'event',
    key: 'event',
    width: 110,
    render: (ev: string, row) => (
      <Tag
        className={`audit-trail-table__event-tag audit-trail-table__event-tag--${row.tagColor ?? 'default'}`}
      >
        {ev}
      </Tag>
    ),
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
    align: 'right',
    render: (s: string) => <span className="audit-trail-table__source">{s}</span>,
  },
]

export default function AuditTrailTable(props: AuditTrailTableProps) {
  const focusedOrderId = props.state === 'single' ? props.orderId : null
  const { status, data, error } = useOrderAudit(focusedOrderId)

  if (props.state === 'empty') {
    return (
      <div className="audit-trail-tree-wrap audit-trail-tree-wrap--empty" role="status">
        <Typography.Text type="secondary">{props.message}</Typography.Text>
      </div>
    )
  }

  const headline =
    props.order != null
      ? `${props.order.symbol} · ${props.order.side} · ${props.order.status} · ${props.orderId}`
      : props.orderId

  if (status !== 'ready' && status !== 'error') {
    return (
      <div className="audit-trail-tree-wrap audit-trail-tree-wrap--empty audit-trail-tree-wrap--loading" role="status" aria-busy="true">
        <Spin size="small" />
        <Typography.Text type="secondary" className="audit-trail-loading-text">
          Loading audit…
        </Typography.Text>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="audit-trail-tree-wrap audit-trail-tree-wrap--empty audit-trail-tree-wrap--error">
        <Typography.Paragraph type="secondary" className="audit-trail-focus-hint" ellipsis>
          Selected: {headline}
        </Typography.Paragraph>
        <Alert type="error" showIcon message={error ?? 'Audit request failed'} className="audit-trail-error-alert" />
      </div>
    )
  }

  const events = data?.events ?? []
  const shownCount = events.filter((e) => e.eventType !== 'heartbeat').length
  const tree = data != null ? buildAuditTree(props.order, props.orderId, data.events) : []

  return (
    <div className="audit-trail-tree-wrap">
      <Typography.Paragraph type="secondary" className="audit-trail-focus-hint" ellipsis>
        Selected: {headline} — {shownCount} event{shownCount === 1 ? '' : 's'} shown
        {events.length !== shownCount ? ` (${events.length} in response, heartbeats hidden)` : ''}.
      </Typography.Paragraph>
      <Table<AuditTrailRow>
        className="audit-trail-table"
        columns={columns}
        dataSource={tree}
        pagination={false}
        size="small"
        tableLayout="fixed"
        rowKey="key"
        defaultExpandAllRows
        expandable={{
          indentSize: 22,
        }}
        locale={{ emptyText: 'No audit events for this order yet.' }}
        aria-label="Order audit trail"
      />
    </div>
  )
}
