import { Table, Tag, message } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Key, ReactNode } from 'react'
import type { Order, OrderStatus } from '../blotter/types'

export type BlotterTableProps = {
  data: Order[]
  selectedRowKeys: Key[]
  onSelectedRowKeysChange: (keys: Key[]) => void
}

type SortKind = 'string' | 'number' | 'date'
type FlashField = 'limitPrice' | 'averageFillPrice'
type FlashDirection = 'up' | 'down'

type ColumnSpec = {
  title: ReactNode
  dataIndex: keyof Order
  kind: SortKind
  width: number
  fixed?: 'left' | 'right'
  ellipsis?: boolean
  flashField?: FlashField
  render?: (record: Order) => ReactNode
}

function compareNullable<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  compare: (left: T, right: T) => number,
) {
  const aMissing = a === null || a === undefined
  const bMissing = b === null || b === undefined
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return compare(a, b)
}

function compareByKind(left: unknown, right: unknown, kind: SortKind): number {
  switch (kind) {
    case 'number':
      return compareNullable(
        typeof left === 'number' ? left : undefined,
        typeof right === 'number' ? right : undefined,
        (a, b) => a - b,
      )
    case 'date':
      return compareNullable(
        typeof left === 'string' ? Date.parse(left) : undefined,
        typeof right === 'string' ? Date.parse(right) : undefined,
        (a, b) => a - b,
      )
    case 'string':
    default:
      return compareNullable(
        left == null ? undefined : String(left).toLowerCase(),
        right == null ? undefined : String(right).toLowerCase(),
        (a, b) => a.localeCompare(b),
      )
  }
}

function buildSorter<K extends keyof Order>(field: K, kind: SortKind) {
  return (a: Order, b: Order) => compareByKind(a[field], b[field], kind)
}

function toFilterValue(value: unknown, kind: SortKind): string | undefined {
  if (value === null || value === undefined) return undefined
  if (kind === 'number' && typeof value === 'number') return String(value)
  if (kind === 'date' && typeof value === 'string') return value
  return String(value)
}

function buildFilterOptions(data: Order[], field: keyof Order, kind: SortKind) {
  const values = new Set<string>()
  for (const row of data) {
    const normalized = toFilterValue(row[field], kind)
    if (!normalized) continue
    values.add(normalized)
    if (values.size >= 50) break
  }
  return [...values].sort().map((value) => ({ text: value, value }))
}

function buildFilterPredicate<K extends keyof Order>(field: K, kind: SortKind) {
  return (selectedValue: string | number | bigint | boolean, row: Order) => {
    const rowValue = toFilterValue(row[field], kind)
    return rowValue === String(selectedValue)
  }
}

function columnAlign(spec: ColumnSpec): 'left' | 'center' | 'right' | undefined {
  if (
    spec.dataIndex === 'id' ||
    spec.dataIndex === 'clientOrderId' ||
    spec.dataIndex === 'account' ||
    spec.dataIndex === 'counterparty'
  ) {
    return 'left'
  }
  if (spec.dataIndex === 'status') return 'center'
  if (spec.kind === 'number') return 'right'
  return undefined
}

const statusTagColor: Record<OrderStatus, string> = {
  pending_new: 'gold',
  new: 'blue',
  partially_filled: 'processing',
  filled: 'success',
  cancelled: 'default',
  rejected: 'error',
  replaced: 'geekblue',
}

function formatStatusLabel(status: OrderStatus): string {
  return status.replace(/_/g, ' ')
}

const pnlMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function renderPnlCell(record: Order) {
  const v = record.pnl
  const cls =
    v > 0 ? 'blotter-pnl blotter-pnl--up' : v < 0 ? 'blotter-pnl blotter-pnl--down' : 'blotter-pnl blotter-pnl--flat'
  return <span className={cls}>{pnlMoney.format(v)}</span>
}

/** Column groups: references → stock → price → execution fills → status/route → timestamps */
const columnGroups: { title: string; key: string; columns: ColumnSpec[] }[] = [
  {
    title: 'References',
    key: 'refs',
    columns: [
      { title: 'Order ID', dataIndex: 'id', kind: 'string', ellipsis: true, width: 138, fixed: 'left' },
      { title: 'Client ID', dataIndex: 'clientOrderId', kind: 'string', ellipsis: true, width: 118 },
      { title: 'Account', dataIndex: 'account', kind: 'string', ellipsis: true, width: 100 },
      { title: 'Counterparty', dataIndex: 'counterparty', kind: 'string', ellipsis: true, width: 100 },
    ],
  },
  {
    title: 'Stock',
    key: 'stock',
    columns: [
      { title: 'Symbol', dataIndex: 'symbol', kind: 'string', width: 120, fixed: 'left' },
      {
        title: 'Side',
        dataIndex: 'side',
        kind: 'string',
        width: 78,
        render: (record) => <Tag color={record.side === 'buy' ? 'green' : 'red'}>{record.side.toUpperCase()}</Tag>,
      },
      { title: 'Quantity', dataIndex: 'quantity', kind: 'number', width: 96 },
    ],
  },
  {
    title: 'Price',
    key: 'price',
    columns: [
      { title: 'Limit Price', dataIndex: 'limitPrice', kind: 'number', width: 118, flashField: 'limitPrice' },
      {
        title: 'Avg Fill Px',
        dataIndex: 'averageFillPrice',
        kind: 'number',
        width: 118,
        flashField: 'averageFillPrice',
      },
    ],
  },
  {
    title: 'Execution',
    key: 'execution',
    columns: [
      {
        title: (
          <span className="blotter-col-head-ellipsis" title="Filled Qty">
            Filled Qty
          </span>
        ),
        dataIndex: 'filledQuantity',
        kind: 'number',
        width: 98,
      },
      {
        title: 'P&L',
        dataIndex: 'pnl',
        kind: 'number',
        width: 128,
        render: renderPnlCell,
      },
    ],
  },
  {
    title: 'Status & route',
    key: 'status',
    columns: [
      {
        title: 'Status',
        dataIndex: 'status',
        kind: 'string',
        width: 140,
        render: (record) => (
          <Tag color={statusTagColor[record.status]}>{formatStatusLabel(record.status)}</Tag>
        ),
      },
      { title: 'TIF', dataIndex: 'timeInForce', kind: 'string', width: 110 },
      { title: 'Venue', dataIndex: 'venue', kind: 'string', width: 110 },
      { title: 'Rejection Reason', dataIndex: 'rejectionReason', kind: 'string', ellipsis: true, width: 200 },
    ],
  },
  {
    title: 'Time',
    key: 'time',
    columns: [
      { title: 'Created At', dataIndex: 'createdAt', kind: 'date', width: 190 },
      { title: 'Updated At', dataIndex: 'updatedAt', kind: 'date', width: 190 },
    ],
  },
]

function mapSpecToLeafColumn(
  spec: ColumnSpec,
  data: Order[],
  flashByCell: Record<string, FlashDirection>,
): ColumnType<Order> {
  return {
    title: spec.title,
    dataIndex: spec.dataIndex,
    key: String(spec.dataIndex),
    width: spec.width,
    fixed: spec.fixed,
    ellipsis: spec.ellipsis,
    align: columnAlign(spec),
    sorter: buildSorter(spec.dataIndex, spec.kind),
    sortDirections: ['ascend', 'descend'],
    filters: buildFilterOptions(data, spec.dataIndex, spec.kind),
    filterSearch: true,
    onFilter: buildFilterPredicate(spec.dataIndex, spec.kind),
    onCell: (record) => {
      if (!spec.flashField) return {}
      const cellFlash = flashByCell[flashKey(record.id, spec.flashField)]
      if (!cellFlash) return {}
      return { className: cellFlash === 'up' ? 'price-flash-up' : 'price-flash-down' }
    },
    render: spec.render ? (_value, record) => spec.render?.(record) : undefined,
  }
}

const FLASH_DURATION_MS = 650

function flashKey(orderId: Order['id'], field: FlashField): string {
  return `${orderId}:${field}`
}

export default function BlotterTable({ data, selectedRowKeys, onSelectedRowKeysChange }: BlotterTableProps) {
  const [flashByCell, setFlashByCell] = useState<Record<string, FlashDirection>>({})
  const prevPriceByCellRef = useRef<Map<string, number | undefined>>(new Map())
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const handleRowClick = (record: Order) => {
    console.log('Clicked row:', record)
    console.table(record)
    console.error('Row click event fired for:', record.id)
    void message.info(`Clicked ${record.id}`, 1)
  }

  useEffect(() => {
    const nextPriceByCell = new Map<string, number | undefined>()

    for (const row of data) {
      for (const field of ['limitPrice', 'averageFillPrice'] as const) {
        const key = flashKey(row.id, field)
        const nextValue = row[field]
        const prevValue = prevPriceByCellRef.current.get(key)

        if (
          typeof prevValue === 'number' &&
          typeof nextValue === 'number' &&
          Number.isFinite(prevValue) &&
          Number.isFinite(nextValue) &&
          prevValue !== nextValue
        ) {
          const direction: FlashDirection = nextValue > prevValue ? 'up' : 'down'
          setFlashByCell((prev) => ({ ...prev, [key]: direction }))

          const existingTimer = flashTimersRef.current.get(key)
          if (existingTimer) clearTimeout(existingTimer)

          const timer = setTimeout(() => {
            setFlashByCell((prev) => {
              const copy = { ...prev }
              delete copy[key]
              return copy
            })
            flashTimersRef.current.delete(key)
          }, FLASH_DURATION_MS)

          flashTimersRef.current.set(key, timer)
        }

        nextPriceByCell.set(key, typeof nextValue === 'number' ? nextValue : undefined)
      }
    }

    prevPriceByCellRef.current = nextPriceByCell
  }, [data])

  useEffect(
    () => () => {
      for (const timer of flashTimersRef.current.values()) {
        clearTimeout(timer)
      }
      flashTimersRef.current.clear()
    },
    [],
  )

  const columns = useMemo<TableColumnsType<Order>>(
    () =>
      columnGroups.map((group) => ({
        title: group.title,
        key: group.key,
        children: group.columns.map((spec) => mapSpecToLeafColumn(spec, data, flashByCell)),
      })),
    [data, flashByCell],
  )

  const rowSelection = useMemo<TableProps<Order>['rowSelection']>(
    () => ({
      type: 'checkbox',
      fixed: 'left',
      columnWidth: 56,
      selectedRowKeys,
      onChange: (keys, selectedRows) => {
        onSelectedRowKeysChange(keys)
        console.log('Checkbox selection changed. Selected rows:', selectedRows)
        console.table(selectedRows)
      },
      onSelect: (record, selected) => {
        console.log(`Checkbox ${selected ? 'selected' : 'deselected'} row:`, record)
      },
      preserveSelectedRowKeys: true,
    }),
    [selectedRowKeys, onSelectedRowKeysChange],
  )

  return (
    <Table<Order>
      className="blotter-table"
      rowKey="id"
      rowSelection={rowSelection}
      onRow={(record) => ({
        onClick: () => handleRowClick(record),
      })}
      columns={columns}
      dataSource={data}
      footer={() => (
        <div className="blotter-table-footer">
          <div className="blotter-table-footer__stat">
            <span className="blotter-table-footer__label">Visible rows</span>
            <span className="blotter-table-footer__value">{data.length}</span>
          </div>
          <div className="blotter-table-footer__stat">
            <span className="blotter-table-footer__label">Selected rows</span>
            <span className="blotter-table-footer__value">{selectedRowKeys.length}</span>
          </div>
        </div>
      )}
      pagination={false}
      virtual
      scroll={{ x: 1900, y: 520 }}
      size="small"
    />
  )
}