import { Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'

/** Mock rows for tree-shaped audit preview (not wired to the store yet). */
type AuditMockRecord = {
  key: string
  time: string
  event: string
  summary: string
  source: string
  tagColor?: string
  children?: AuditMockRecord[]
}

const MOCK_AUDIT_TREE: AuditMockRecord[] = [
  {
    key: 'mock-ord-1',
    time: '—',
    event: 'Order',
    summary: 'MOCK-1042 · AAPL buy · working',
    source: 'OMS',
    tagColor: 'blue',
    children: [
      {
        key: 'mock-ord-1-e1',
        time: '09:14:02',
        event: 'Created',
        summary: 'New order accepted; routed to MOCK venue',
        source: 'STREAM',
        tagColor: 'success',
      },
      {
        key: 'mock-ord-1-e2',
        time: '09:14:03',
        event: 'Updated',
        summary: 'Venue acknowledgement',
        source: 'ROUTER',
        tagColor: 'processing',
        children: [
          {
            key: 'mock-ord-1-e2-f1',
            time: '09:14:03',
            event: 'Field',
            summary: 'venue_order_id: (empty) → VNE-778821',
            source: 'ROUTER',
            tagColor: 'default',
          },
          {
            key: 'mock-ord-1-e2-f2',
            time: '09:14:03',
            event: 'Field',
            summary: 'working_quantity: 0 → 500',
            source: 'ROUTER',
            tagColor: 'default',
          },
        ],
      },
      {
        key: 'mock-ord-1-e3',
        time: '09:18:41',
        event: 'Updated',
        summary: 'Client amend',
        source: 'UI',
        tagColor: 'processing',
        children: [
          {
            key: 'mock-ord-1-e3-f1',
            time: '09:18:41',
            event: 'Field',
            summary: 'quantity: 500 → 750',
            source: 'UI',
            tagColor: 'default',
          },
          {
            key: 'mock-ord-1-e3-f2',
            time: '09:18:41',
            event: 'Field',
            summary: 'limit_price: 178.50 → 178.00',
            source: 'UI',
            tagColor: 'default',
          },
        ],
      },
      {
        key: 'mock-ord-1-e4',
        time: '09:22:09',
        event: 'Updated',
        summary: 'Partial fill',
        source: 'STREAM',
        tagColor: 'processing',
        children: [
          {
            key: 'mock-ord-1-e4-f1',
            time: '09:22:09',
            event: 'Field',
            summary: 'filled_quantity: 0 → 200',
            source: 'STREAM',
            tagColor: 'default',
          },
        ],
      },
    ],
  },
  {
    key: 'mock-ord-2',
    time: '—',
    event: 'Order',
    summary: 'MOCK-1043 · MSFT sell · cancelled',
    source: 'OMS',
    tagColor: 'blue',
    children: [
      {
        key: 'mock-ord-2-e1',
        time: '10:02:11',
        event: 'Created',
        summary: 'New order accepted',
        source: 'STREAM',
        tagColor: 'success',
      },
      {
        key: 'mock-ord-2-e2',
        time: '10:03:58',
        event: 'Cancelled',
        summary: 'User cancel; no fills',
        source: 'UI',
        tagColor: 'default',
      },
    ],
  },
]

const columns: ColumnsType<AuditMockRecord> = [
  {
    title: 'Time',
    dataIndex: 'time',
    key: 'time',
    width: 100,
    render: (t: string) => (
      <span className="audit-trail-table__mono">{t}</span>
    ),
  },
  {
    title: 'Event',
    dataIndex: 'event',
    key: 'event',
    width: 110,
    render: (ev: string, row) => (
      <Tag className="audit-trail-table__event-tag" color={row.tagColor ?? 'default'}>
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

export default function AuditTrailTable() {
  return (
    <div className="audit-trail-tree-wrap">
      <Table<AuditMockRecord>
        className="audit-trail-table"
        columns={columns}
        dataSource={MOCK_AUDIT_TREE}
        pagination={false}
        size="small"
        tableLayout="fixed"
        rowKey="key"
        expandable={{
          indentSize: 22,
        }}
        aria-label="Order audit trail (sample hierarchy)"
      />
    </div>
  )
}
