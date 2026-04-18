import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import type { Key } from 'react'
import { Button, Card, Input, Layout, Space, Typography, message } from 'antd'
import { useBlotterMockStream } from './features/blotter/realtime/useBlotterMockStream'
import OrderEntryForm from './features/order-entry/OrderEntryForm'
import AmendOrderModal from './features/blotter/AmendOrderModal'
import { amendOrder, cancelOrders, isOrderOpenForAction } from './features/blotter/api/orderActions'
import { useBlotterStore } from './features/blotter/store/useBlotterStore'
import { eodSchemaFacts, selectionSummaryFacts } from './features/insights/deterministicInsights'
import { EodReportModal, SelectionSummaryModal } from './features/insights/InsightModals'
import { orderId, type Order } from './features/blotter/types'
import AuditTrailTable from './features/table/AuditTrailTable'
import BlotterTable from './features/table/BlotterTable'
import './App.css'

const ORDER_FORM_OPEN_KEY = 'prime-blotter-order-form-open'

const STATS_MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function isTerminalOrder(o: Order): boolean {
  return o.status === 'filled' || o.status === 'cancelled' || o.status === 'rejected'
}

function readOrderFormOpen(): boolean {
  try {
    const v = localStorage.getItem(ORDER_FORM_OPEN_KEY)
    if (v === null) return true
    return v === '1'
  } catch {
    return true
  }
}

function App() {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [selectionModalOpen, setSelectionModalOpen] = useState(false)
  const [eodModalOpen, setEodModalOpen] = useState(false)
  const [nlpQuery, setNlpQuery] = useState('')
  const [amendModalOpen, setAmendModalOpen] = useState(false)
  const [orderFormOpen, setOrderFormOpen] = useState(readOrderFormOpen)
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_FORM_OPEN_KEY, orderFormOpen ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [orderFormOpen])

  useBlotterMockStream()
  const orderIds = useBlotterStore((s) => s.orderIds)
  const ordersById = useBlotterStore((s) => s.ordersById)
  const lastBeat = useBlotterStore((s) => s.lastHeartbeatAt)
  const orders = useMemo(
    () => orderIds.map((id) => ordersById[id]).filter(Boolean),
    [orderIds, ordersById],
  )

  const selectedOrders = useMemo(
    () => selectedRowKeys.map((k) => ordersById[orderId(String(k))]).filter(Boolean),
    [selectedRowKeys, ordersById],
  )

  const selectedOpenOrders = useMemo(
    () => selectedOrders.filter(isOrderOpenForAction),
    [selectedOrders],
  )

  const amendTargetOrder = selectedOpenOrders.length === 1 ? selectedOpenOrders[0]! : null

  const aggregatePnl = useMemo(() => orders.reduce((s, o) => s + o.pnl, 0), [orders])

  const grossWorkingNotional = useMemo(
    () =>
      orders
        .filter((o) => !isTerminalOrder(o))
        .reduce((s, o) => {
          const px = o.limitPrice ?? o.averageFillPrice ?? 0
          return s + Math.abs(o.quantity * px)
        }, 0),
    [orders],
  )

  const { workingCount, terminalCount } = useMemo(() => {
    let working = 0
    let terminal = 0
    for (const o of orders) {
      if (isTerminalOrder(o)) terminal += 1
      else working += 1
    }
    return { workingCount: working, terminalCount: terminal }
  }, [orders])

  const selectionModel = useMemo(
    () => selectionSummaryFacts(orders, selectedRowKeys.map(String)),
    [orders, selectedRowKeys],
  )
  const eodSections = useMemo(() => eodSchemaFacts(orders), [orders])

  const lastBeatShort = useMemo(() => {
    if (!lastBeat) return '—'
    const d = new Date(lastBeat)
    return Number.isNaN(d.getTime())
      ? lastBeat
      : d.toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }, [lastBeat])

  return (
    <Layout className="app-layout">
      <Layout.Content className="app-content">
        <header className="page-header">
          <div className="page-header-brand">
            <span className="page-header-icon" aria-hidden="true">
              {'\u25A6'}
            </span>
            <Typography.Title level={3} className="page-header-title">
              Prime Blotter
            </Typography.Title>
          </div>
        </header>

        <Card className="app-card app-card--stats" bordered={false}>
          <div className="stats-strip-layout">
            <div className="stats-strip-cluster">
              <div className="stats-metric-cards" role="region" aria-label="P and L and risk exposure">
                <div className="stats-metric-card stats-metric-card--pnl">
                  <div className="stats-item-label">P&amp;L</div>
                  <div
                    className={
                      aggregatePnl > 0
                        ? 'stats-item-value stats-item-value--pnl-up'
                        : aggregatePnl < 0
                          ? 'stats-item-value stats-item-value--pnl-down'
                          : 'stats-item-value stats-item-value--pnl-flat'
                    }
                  >
                    {STATS_MONEY.format(aggregatePnl)}
                  </div>
                  <div className="stats-item-hint">Aggregate across visible rows (mock)</div>
                </div>
                <div className="stats-metric-card">
                  <div className="stats-item-label">Risk exposure</div>
                  <div className="stats-item-value">{STATS_MONEY.format(grossWorkingNotional)}</div>
                  <div className="stats-item-hint">Gross notional · working orders only</div>
                </div>
              </div>
              <div className="stats-item stats-item--working-terminal">
                <div className="stats-item-label">Working / terminal</div>
                <div className="stats-item-value">{workingCount} / {terminalCount}</div>
                <div className="stats-item-hint">Non-terminal vs filled, cancelled, rejected</div>
              </div>
              <div className="stats-item stats-item--status-inline">
                <div className="stats-item-label">Status</div>
                <div className="stats-status-value">{lastBeatShort}</div>
                <div className="stats-item-hint">Last heartbeat</div>
              </div>
              <div className="ai-tiles" role="region" aria-label="AI actions">
                <div className="ai-tile">
                  <div className="ai-tile__heading">
                    <RobotOutlined className="ai-tile__icon" aria-hidden />
                    <span>Summarize Rows</span>
                  </div>
                  <Button
                    block
                    type={selectedRowKeys.length > 0 ? 'primary' : 'default'}
                    ghost={selectedRowKeys.length === 0}
                    disabled={selectedRowKeys.length === 0}
                    onClick={() => setSelectionModalOpen(true)}
                    className="ai-tile__action"
                  >
                    Summarize selected rows
                  </Button>
                </div>
                <div className="ai-tile">
                  <div className="ai-tile__heading">
                    <ThunderboltOutlined className="ai-tile__icon" aria-hidden />
                    <span>EOD Report</span>
                  </div>
                  <Button
                    block
                    type="default"
                    onClick={() => setEodModalOpen(true)}
                    className="ai-tile__action"
                  >
                    Generate end-of-day report
                  </Button>
                </div>
              </div>
            </div>
            <div className="stats-status-nlp">
              <div className="stats-nlp-field">
                <div className="stats-nlp-label-row">
                  <RobotOutlined className="stats-nlp-label__icon" aria-hidden />
                  <label className="stats-item-label stats-nlp-label__text" htmlFor="stats-nlp-input">
                    AI filter
                  </label>
                </div>
                <p className="stats-nlp-description" id="stats-nlp-description">
                  Preview: natural-language filtering is not wired to the table yet.
                </p>
                <Input
                  id="stats-nlp-input"
                  className="stats-nlp-input"
                  placeholder="Filter with natural language…"
                  value={nlpQuery}
                  onChange={(e) => setNlpQuery(e.target.value)}
                  allowClear
                  aria-describedby="stats-nlp-description"
                />
              </div>
            </div>
          </div>
        </Card>

        <SelectionSummaryModal
          open={selectionModalOpen}
          onClose={() => setSelectionModalOpen(false)}
          model={selectionModel}
        />
        <EodReportModal open={eodModalOpen} onClose={() => setEodModalOpen(false)} sections={eodSections} />

        <AmendOrderModal
          open={amendModalOpen}
          order={amendTargetOrder}
          onClose={() => setAmendModalOpen(false)}
          onSubmit={async (values) => {
            if (!amendTargetOrder) return
            try {
              await amendOrder(amendTargetOrder.id, values)
              void message.success('Amend sent')
            } catch {
              void message.error('Amend failed')
            }
          }}
        />

        <div
          className={
            orderFormOpen ? 'order-workspace' : 'order-workspace order-workspace--form-collapsed'
          }
        >
          <div className="surface-section-label-row order-workspace-label order-workspace-label--form">
            {orderFormOpen ? (
              <>
                <Typography.Title level={5} className="surface-section-label">
                  Order form
                </Typography.Title>
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setOrderFormOpen(false)}
                  aria-label="Collapse order form"
                  className="order-form-collapse-btn"
                />
              </>
            ) : (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setOrderFormOpen(true)}
                aria-label="Expand order form"
                className="order-form-expand-btn"
              />
            )}
          </div>
          <div className="surface-section-label-row order-workspace-label order-workspace-label--table">
            <Typography.Title level={5} className="surface-section-label">
              Order table
            </Typography.Title>
            <div className="order-table-heading-actions">
              <Typography.Text type="secondary" className="order-table-heading-actions__hint">
                Open orders only.
              </Typography.Text>
              <Space wrap className="order-table-heading-actions__buttons">
                <Button
                  danger
                  disabled={selectedOpenOrders.length === 0}
                  onClick={async () => {
                    try {
                      const n = await cancelOrders(selectedRowKeys.map(String))
                      if (n === 0) {
                        void message.warning('No open orders to cancel')
                      } else {
                        void message.success(n === 1 ? 'Order cancelled' : `${n} orders cancelled`)
                      }
                    } catch {
                      void message.error('Cancel failed')
                    }
                  }}
                >
                  Cancel selected
                </Button>
                <Button
                  disabled={selectedOpenOrders.length !== 1}
                  onClick={() => setAmendModalOpen(true)}
                >
                  Amend selected
                </Button>
              </Space>
            </div>
          </div>

          {orderFormOpen ? <OrderEntryForm /> : null}

          <section className="order-table-section" aria-label="Order table">
            <Card className="app-card">
              <BlotterTable
                data={orders}
                selectedRowKeys={selectedRowKeys}
                onSelectedRowKeysChange={setSelectedRowKeys}
              />
            </Card>
          </section>
        </div>

        <section className="audit-trail-section" aria-label="Audit trail">
          <div className="surface-section-label-row">
            <Typography.Title level={5} className="surface-section-label">
              Audit trail
            </Typography.Title>
          </div>
          <Card className="app-card">
            <AuditTrailTable />
          </Card>
        </section>
      </Layout.Content>
    </Layout>
  )
}

export default App
