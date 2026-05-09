import {
  CloseOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Key } from 'react'
import { Alert, Avatar, Button, Card, Dropdown, Input, Layout, Menu, Space, Spin, Tag, Typography, message } from 'antd'
import { useBlotterLiveBootstrap } from './features/blotter/realtime/useBlotterLiveBootstrap'
import { useBlotterWebSocketStream } from './features/blotter/realtime/useBlotterWebSocketStream'
import OrderEntryForm from './features/order-entry/OrderEntryForm'
import AmendOrderModal from './features/blotter/AmendOrderModal'
import { amendOrder, cancelOrders, isOrderOpenForAction } from './features/blotter/api/orderActions'
import { fetchBreachInsight } from './features/blotter/api/fetchBreachInsightApi'
import { useBlotterStore } from './features/blotter/store/useBlotterStore'
import { aggregatePnlFromOrders, evaluateBreachTransition } from './features/blotter/breachMonitor'
import { eodSchemaFacts, selectionSummaryFacts } from './features/insights/deterministicInsights'
import { EodReportModal, SelectionSummaryModal } from './features/insights/InsightModals'
import { fetchParsedOrderFilterFromNlp } from './features/blotter/api/parseOrderFilterNlpApi'
import { filterOrdersByParsedFilter } from './features/blotter/nlp/applyParsedOrderFilter'
import { appliedFilterChips } from './features/blotter/nlp/nlpFilterSummary'
import { isParsedOrderFilterEmpty, type ParsedOrderFilter } from './features/blotter/nlp/parsedOrderFilter'
import { orderId, type Order } from './features/blotter/types'
import { buildSimulatedBreachEvent, buildSimulatedRecoveryEvent } from './features/blotter/realtime/simulateBreachEvent'
import AuditTrailTable, { type AuditTrailTableProps } from './features/table/AuditTrailTable'
import BlotterTable from './features/table/BlotterTable'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import './App.css'

const ORDER_FORM_OPEN_KEY = 'prime-blotter-order-form-open'

/** Set to `true` to re-enable Summarize + EOD report in the stats strip. */
const STATS_AI_ACTIONS_ENABLED = false

const BLOTTER_WS_URL = (import.meta.env.VITE_BLOTTER_WS_URL as string | undefined)?.trim() ?? ''
const USE_BLOTTER_WEBSOCKET = BLOTTER_WS_URL.length > 0
const BREACH_PNL_THRESHOLD = -80_000

const DUMMY_DISPLAY_NAME = 'Chris Taylor'

const TOP_NAV_ITEMS = [
  { key: 'blotter', label: 'Blotter' },
  { key: 'positions', label: 'Positions' },
  { key: 'analytics', label: 'Analytics' },
] as const

const STATS_MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatBreachTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

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

function PrimeBlotterApp() {
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  /** Row body click — audit trail; separate from checkbox `selectedRowKeys`. */
  const [auditFocusKey, setAuditFocusKey] = useState<Key | null>(null)
  const [selectionModalOpen, setSelectionModalOpen] = useState(false)
  const [eodModalOpen, setEodModalOpen] = useState(false)
  /** Draft text for the AI filter box; applied only after **Apply** (OpenAI + Zod on server). */
  const [nlpFilterDraft, setNlpFilterDraft] = useState('')
  /** Last successfully applied structured filter; `null` means show full book for this path. */
  const [nlpAppliedFilter, setNlpAppliedFilter] = useState<ParsedOrderFilter | null>(null)
  /** Text last successfully sent to Apply (trimmed); used for draft vs applied hint. */
  const [nlpLastAppliedQuery, setNlpLastAppliedQuery] = useState('')
  const [nlpFilterInlineError, setNlpFilterInlineError] = useState<string | null>(null)
  const [nlpApplyLoading, setNlpApplyLoading] = useState(false)
  const [amendModalOpen, setAmendModalOpen] = useState(false)
  const [orderFormOpen, setOrderFormOpen] = useState(readOrderFormOpen)
  const [topNavKey, setTopNavKey] = useState<string>('blotter')
  const [ordersLoadErrorDismissed, setOrdersLoadErrorDismissed] = useState(false)
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_FORM_OPEN_KEY, orderFormOpen ? '1' : '0')
    } catch {
      /* ignore quota / private mode */
    }
  }, [orderFormOpen])

  const { status: liveBootstrapStatus, error: liveBootstrapError } = useBlotterLiveBootstrap(USE_BLOTTER_WEBSOCKET)
  const blotterWsEnabled = USE_BLOTTER_WEBSOCKET && liveBootstrapStatus === 'ready'
  useBlotterWebSocketStream({ url: BLOTTER_WS_URL, enabled: blotterWsEnabled })

  useEffect(() => {
    if (liveBootstrapStatus !== 'error') {
      setOrdersLoadErrorDismissed(false)
    }
  }, [liveBootstrapStatus])
  
  // # TODO: fallback
  // useBlotterMockStream({ enabled: !USE_BLOTTER_WEBSOCKET })
  const orderIds = useBlotterStore((s) => s.orderIds)
  const ordersById = useBlotterStore((s) => s.ordersById)
  const lastBeat = useBlotterStore((s) => s.lastHeartbeatAt)
  const lastStreamSequence = useBlotterStore((s) => s.lastStreamSequence)
  const auditByOrderId = useBlotterStore((s) => s.auditByOrderId)
  const orders = useMemo(
    () => orderIds.map((id) => ordersById[id]).filter(Boolean),
    [orderIds, ordersById],
  )

  const filteredOrders = useMemo(
    () => filterOrdersByParsedFilter(orders, nlpAppliedFilter),
    [orders, nlpAppliedFilter],
  )

  const nlpAppliedChips = useMemo(() => {
    if (nlpAppliedFilter != null && !isParsedOrderFilterEmpty(nlpAppliedFilter)) {
      return appliedFilterChips(nlpAppliedFilter)
    }
    return []
  }, [nlpAppliedFilter])

  const nlpAppliedShowFullBookHint = nlpLastAppliedQuery !== '' && nlpAppliedChips.length === 0

  const nlpDraftDiffersFromApplied = useMemo(() => {
    if (nlpLastAppliedQuery === '') return false
    return nlpFilterDraft.trim() !== nlpLastAppliedQuery.trim()
  }, [nlpFilterDraft, nlpLastAppliedQuery])

  const handleNlpApply = useCallback(async () => {
    const text = nlpFilterDraft.trim()
    if (!text) return
    setNlpApplyLoading(true)
    setNlpFilterInlineError(null)
    try {
      const filter = await fetchParsedOrderFilterFromNlp(text)
      setNlpAppliedFilter(isParsedOrderFilterEmpty(filter) ? null : filter)
      setNlpLastAppliedQuery(text)
      void message.success('Filter applied')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'NLP filter failed'
      setNlpFilterInlineError(msg)
    } finally {
      setNlpApplyLoading(false)
    }
  }, [nlpFilterDraft])

  /** Remount virtual table once per bootstrap phase, not on every new `orderId` (avoids scroll jumping to top on each WS delta). */
  const blotterTableMountKey = USE_BLOTTER_WEBSOCKET
    ? `blotter-live-${liveBootstrapStatus}`
    : 'blotter-local'

  const selectedOrders = useMemo(
    () => selectedRowKeys.map((k) => ordersById[orderId(String(k))]).filter(Boolean),
    [selectedRowKeys, ordersById],
  )

  const selectedOpenOrders = useMemo(
    () => selectedOrders.filter(isOrderOpenForAction),
    [selectedOrders],
  )

  useEffect(() => {
    if (auditFocusKey == null) return
    if (!ordersById[orderId(String(auditFocusKey))]) {
      setAuditFocusKey(null)
    }
  }, [auditFocusKey, ordersById])

  const auditSummaryLine = useMemo(() => {
    if (auditFocusKey == null) return 'None'
    const raw = String(auditFocusKey)
    const oid = orderId(raw)
    const o = ordersById[oid]
    const idShort = raw.length > 22 ? `${raw.slice(0, 18)}…` : raw
    if (o) return `${o.symbol} · ${idShort}`
    return idShort
  }, [auditFocusKey, ordersById])

  const auditSummaryTitle = useMemo(() => {
    if (auditFocusKey == null) return 'No row focused for audit'
    const raw = String(auditFocusKey)
    const o = ordersById[orderId(raw)]
    return o ? `${o.symbol} · ${raw}` : raw
  }, [auditFocusKey, ordersById])

  const auditCheckedDiverge = useMemo(() => {
    if (auditFocusKey == null || selectedRowKeys.length === 0) return false
    const f = String(auditFocusKey)
    return !selectedRowKeys.some((k) => String(k) === f)
  }, [auditFocusKey, selectedRowKeys])

  const auditTrailProps = useMemo((): AuditTrailTableProps => {
    if (auditFocusKey == null) {
      return {
        state: 'empty',
        message: 'Click an order row (outside the checkbox column) to view its audit trail.',
      }
    }
    const rawId = String(auditFocusKey)
    return {
      state: 'single',
      orderId: rawId,
      order: ordersById[orderId(rawId)],
    }
  }, [auditFocusKey, ordersById])

  const amendTargetOrder = selectedOpenOrders.length === 1 ? selectedOpenOrders[0]! : null

  const aggregatePnl = useMemo(() => aggregatePnlFromOrders(orders), [orders])
  const [pnlBreached, setPnlBreached] = useState(false)
  const [breachAcknowledged, setBreachAcknowledged] = useState(false)
  const [breachDetectedAt, setBreachDetectedAt] = useState<string | null>(null)
  const [breachInsight, setBreachInsight] = useState<string | null>(null)
  const [breachInsightLoading, setBreachInsightLoading] = useState(false)
  const prevPnlBreachedRef = useRef(false)

  const lastFiveAuditEvents = useMemo(() => {
    const all = Object.values(auditByOrderId).flat()
    all.sort((a, b) => {
      const seqCmp = Number(b.sequence) - Number(a.sequence)
      if (seqCmp !== 0) return seqCmp
      return b.emittedAt.localeCompare(a.emittedAt)
    })
    return all.slice(0, 5).map((e) => ({
      emittedAt: e.emittedAt,
      summary: e.summary,
    }))
  }, [auditByOrderId])

  const topFivePositionsByAbsPnl = useMemo(() => {
    return [...orders]
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
      .slice(0, 5)
      .map((o) => ({
        symbol: o.symbol,
        side: o.side,
        quantity: o.quantity,
        pnl: o.pnl,
      }))
  }, [orders])

  useEffect(() => {
    const transition = evaluateBreachTransition(aggregatePnl, BREACH_PNL_THRESHOLD, prevPnlBreachedRef.current)
    if (transition.justCrossedDown) {
      setBreachAcknowledged(false)
      setBreachDetectedAt(new Date().toISOString())
      void message.warning(`P&L breach: ${STATS_MONEY.format(transition.aggregatePnl)} <= ${STATS_MONEY.format(BREACH_PNL_THRESHOLD)}`)
      setBreachInsightLoading(true)
      void fetchBreachInsight({
        currentPnl: transition.aggregatePnl,
        threshold: BREACH_PNL_THRESHOLD,
        topPositions: topFivePositionsByAbsPnl,
        lastAuditEvents: lastFiveAuditEvents,
      })
        .then((insight) => {
          setBreachInsight(insight)
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : 'Failed to generate breach insight'
          setBreachInsight(`Insight unavailable: ${msg}`)
        })
        .finally(() => {
          setBreachInsightLoading(false)
        })
    }
    if (!transition.breached) {
      setBreachAcknowledged(false)
      setBreachDetectedAt(null)
      setBreachInsight(null)
      setBreachInsightLoading(false)
    }
    prevPnlBreachedRef.current = transition.breached
    setPnlBreached((prev) => (prev === transition.breached ? prev : transition.breached))
  }, [aggregatePnl, lastFiveAuditEvents, topFivePositionsByAbsPnl])

  const handleSimulateBreach = useCallback(() => {
    const event = buildSimulatedBreachEvent(orders, lastStreamSequence == null ? null : Number(lastStreamSequence))
    if (!event) {
      void message.warning('No orders available for breach simulation')
      return
    }
    useBlotterStore.getState().ingestEvent(event)
    void message.success('Simulated breach event injected')
  }, [lastStreamSequence, orders])

  const handleNormalizePnl = useCallback(() => {
    const event = buildSimulatedRecoveryEvent(orders, lastStreamSequence == null ? null : Number(lastStreamSequence))
    if (!event) {
      void message.warning('No orders available for normalization simulation')
      return
    }
    useBlotterStore.getState().ingestEvent(event)
    void message.success('Simulated normalization event injected')
  }, [lastStreamSequence, orders])

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

  const ordersLoadErrorText =
    USE_BLOTTER_WEBSOCKET && liveBootstrapStatus === 'error'
      ? `Could not load orders - ${(liveBootstrapError ?? 'Unknown error').trim().replace(/\s+/g, ' ')}`
      : null

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-top-nav">
        <div className="app-top-nav__inner">
          <Link to="/" className="page-header-brand page-header-brand--link">
            <span className="page-header-icon" aria-hidden="true">
              {'\u25A6'}
            </span>
            <Typography.Title level={3} className="page-header-title page-header-title--nav">
              FlowDesk
            </Typography.Title>
          </Link>
          <Menu
            mode="horizontal"
            className="app-top-nav__menu"
            selectedKeys={[topNavKey]}
            items={TOP_NAV_ITEMS.map((i) => ({ key: i.key, label: i.label }))}
            onClick={({ key }) => setTopNavKey(String(key))}
          />
          <Dropdown
            menu={{
              items: [
                { key: 'profile', label: 'Profile' },
                { key: 'preferences', label: 'Preferences' },
                { type: 'divider' },
                { key: 'signout', label: 'Sign out' },
              ],
            }}
            trigger={['click']}
          >
            <button type="button" className="app-top-nav__user" aria-label="Account menu">
              <Avatar size="small" icon={<UserOutlined />} className="app-top-nav__avatar" />
              <span className="app-top-nav__user-name">{DUMMY_DISPLAY_NAME}</span>
              <DownOutlined className="app-top-nav__user-caret" aria-hidden />
            </button>
          </Dropdown>
        </div>
      </Layout.Header>

      <Layout.Content className="app-content">
        {USE_BLOTTER_WEBSOCKET && liveBootstrapStatus === 'loading' ? (
          <Alert type="info" showIcon message="Loading orders…" className="app-bootstrap-alert" />
        ) : null}
        {ordersLoadErrorText && !ordersLoadErrorDismissed ? (
          <Alert
            type="error"
            showIcon
            closable
            closeIcon={<CloseOutlined />}
            onClose={() => setOrdersLoadErrorDismissed(true)}
            className="app-bootstrap-alert app-bootstrap-alert--single-line"
            message={
              <span className="app-bootstrap-alert__one-line" title={ordersLoadErrorText}>
                {ordersLoadErrorText}
              </span>
            }
          />
        ) : null}
        {pnlBreached && !breachAcknowledged ? (
          <Alert
            type="warning"
            showIcon
            className="app-bootstrap-alert app-bootstrap-alert--single-line app-breach-alert-banner"
            action={
              <Button
                size="small"
                className="app-breach-alert__ack-btn"
                onClick={() => setBreachAcknowledged(true)}
              >
                Acknowledge
              </Button>
            }
            message={
              <div className="app-breach-alert">
                <span className="app-bootstrap-alert__one-line app-breach-alert__title-row">
                  <span
                    className="app-breach-alert__title"
                    title={`P&L breach: ${STATS_MONEY.format(aggregatePnl)} is below threshold ${STATS_MONEY.format(BREACH_PNL_THRESHOLD)}`}
                  >
                    {`P&L breach: ${STATS_MONEY.format(aggregatePnl)} <= ${STATS_MONEY.format(BREACH_PNL_THRESHOLD)}`}
                  </span>
                  {breachDetectedAt ? (
                    <span className="app-breach-alert__timestamp">| Detected {formatBreachTime(breachDetectedAt)}</span>
                  ) : null}
                </span>
                {breachInsightLoading ? (
                  <span className="app-breach-alert__insight app-breach-alert__insight--loading">
                    <Spin size="small" />
                    <span>Analyzing positions and recent trade events...</span>
                  </span>
                ) : (
                  <span className="app-breach-alert__insight">{breachInsight ?? 'No insight generated yet.'}</span>
                )}
              </div>
            }
          />
        ) : null}
        <Card className="app-card app-card--stats" bordered={false}>
          <div className="stats-strip-layout">
            <div className="stats-strip-cluster">
              <div className="stats-strip-kpis">
                <div className="stats-metric-cards" role="region" aria-label="P and L and risk exposure">
                  <div className="stats-metric-card stats-metric-card--pnl">
                    <div className="stats-item-label">P&amp;L</div>
                    <div
                      className={
                        `stats-item-value ${
                          aggregatePnl > 0
                            ? 'stats-item-value--pnl-up'
                            : aggregatePnl < 0
                              ? 'stats-item-value--pnl-down'
                              : 'stats-item-value--pnl-flat'
                        }${pnlBreached ? ' stats-item-value--pnl-breach-pulse' : ''}`
                      }
                    >
                      {STATS_MONEY.format(aggregatePnl)}
                    </div>
                    <div className="stats-item-hint">Aggregate across visible rows (mock)</div>
                    {pnlBreached ? (
                      <Tag bordered className="stats-pnl-breach-chip">
                        Breach threshold hit ({STATS_MONEY.format(BREACH_PNL_THRESHOLD)})
                      </Tag>
                    ) : null}
                  </div>
                  <div className="stats-metric-card">
                    <div className="stats-item-label">Risk exposure</div>
                    <div className="stats-item-value stats-item-value--risk">{STATS_MONEY.format(grossWorkingNotional)}</div>
                    <div className="stats-item-hint">Gross notional · working orders only</div>
                  </div>
                </div>
                <div className="stats-item stats-item--working-terminal">
                  <div className="stats-item-label">Working / terminal</div>
                  <div className="stats-item-value">{workingCount} / {terminalCount}</div>
                  <div className="stats-item-hint">Non-terminal vs filled, cancelled, rejected</div>
                </div>
              </div>
              <div className="stats-item stats-item--status-inline">
                <div className="stats-item-label">Status</div>
                <div className="stats-status-value">{lastBeatShort}</div>
                <div className="stats-item-hint">Last heartbeat</div>
              </div>
            </div>
            <div className="stats-ai-panel" role="region" aria-label="AI actions">
              <div className="stats-ai-strip">
                <div className="stats-ai-strip__row">
                  <div className="stats-ai-strip__actions-col">
                    <div className="stats-nlp-label-row">
                      <Sparkles className="stats-nlp-label__sparkle" size={14} aria-hidden strokeWidth={2} />
                      <span className="stats-item-label stats-nlp-label__text">AI actions</span>
                    </div>
                    <div className="ai-tile__buttons">
                      <Button
                        type={selectedRowKeys.length > 0 ? 'primary' : 'default'}
                        ghost={selectedRowKeys.length === 0}
                        disabled={!STATS_AI_ACTIONS_ENABLED || selectedRowKeys.length === 0}
                        onClick={() => setSelectionModalOpen(true)}
                        className="ai-tile__action"
                        title={
                          STATS_AI_ACTIONS_ENABLED ? 'Summarize selected rows' : 'Summarize (temporarily disabled)'
                        }
                      >
                        Summarize
                      </Button>
                      <Button
                        type="default"
                        disabled={!STATS_AI_ACTIONS_ENABLED}
                        onClick={() => setEodModalOpen(true)}
                        className="ai-tile__action"
                        title={STATS_AI_ACTIONS_ENABLED ? 'Generate end-of-day report' : 'EOD report (temporarily disabled)'}
                      >
                        EOD report
                      </Button>
                      <Button
                        type="default"
                        className="ai-tile__action ai-tile__action--simulate-breach"
                        onClick={() => void handleSimulateBreach()}
                        disabled={orders.length === 0}
                        title="Inject a deterministic losing AAPL sell fill event"
                      >
                        Simulate breach
                      </Button>
                      <Button
                        type="default"
                        className="ai-tile__action ai-tile__action--normalize-pnl"
                        onClick={() => void handleNormalizePnl()}
                        disabled={orders.length === 0}
                        title="Inject a deterministic favorable AAPL sell fill event to recover P&L"
                      >
                        Normalize P&amp;L
                      </Button>
                    </div>
                  </div>
                  <div className="stats-nlp-field stats-nlp-field--in-strip">
                    <div className="stats-nlp-label-row">
                      <Sparkles className="stats-nlp-label__sparkle" size={14} aria-hidden strokeWidth={2} />
                      <label className="stats-item-label stats-nlp-label__text" htmlFor="stats-nlp-input">
                        AI filter
                      </label>
                    </div>
                    <div className="stats-nlp-apply-row">
                      <Input
                        id="stats-nlp-input"
                        className="stats-nlp-input stats-nlp-input--grow"
                        placeholder="e.g. AAPL buys still open"
                        value={nlpFilterDraft}
                        onChange={(e) => {
                          setNlpFilterDraft(e.target.value)
                          setNlpFilterInlineError(null)
                        }}
                        onPressEnter={() => void handleNlpApply()}
                      />
                      <Button
                        type="primary"
                        className="stats-nlp-apply-btn"
                        loading={nlpApplyLoading}
                        disabled={nlpFilterDraft.trim() === '' || nlpApplyLoading}
                        onClick={() => void handleNlpApply()}
                      >
                        Apply
                      </Button>
                      <Button
                        className="stats-nlp-clear-btn"
                        disabled={nlpAppliedFilter == null && nlpFilterDraft.trim() === '' && nlpLastAppliedQuery === ''}
                        onClick={() => {
                          setNlpAppliedFilter(null)
                          setNlpFilterDraft('')
                          setNlpLastAppliedQuery('')
                          setNlpFilterInlineError(null)
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="stats-nlp-meta" aria-live="polite">
                      {nlpFilterInlineError ? (
                        <Typography.Text type="danger" className="stats-nlp-inline-error">
                          {nlpFilterInlineError}
                        </Typography.Text>
                      ) : null}
                      <div className="stats-nlp-applied-row">
                        <span className="stats-nlp-applied-prefix">Applied</span>
                        {nlpAppliedChips.length > 0 ? (
                          <div className="stats-nlp-chips">
                            {nlpAppliedChips.map((c) => (
                              <Tag
                                key={c.key}
                                bordered
                                className={
                                  c.variant === 'warn'
                                    ? 'stats-nlp-chip stats-nlp-chip--warn'
                                    : 'stats-nlp-chip'
                                }
                              >
                                {c.label}
                              </Tag>
                            ))}
                          </div>
                        ) : nlpAppliedShowFullBookHint ? (
                          <span className="stats-nlp-applied-none">Full book</span>
                        ) : (
                          <span
                            className="stats-nlp-applied-idle"
                            title="No filter applied — describe orders in plain language, then Apply."
                          >
                            <span className="stats-nlp-applied-none stats-nlp-applied-none--muted">—</span>
                            <span className="stats-nlp-applied-hint">Describe orders, then Apply.</span>
                          </span>
                        )}
                      </div>
                      {nlpDraftDiffersFromApplied ? (
                        <Typography.Text type="warning" className="stats-nlp-draft-hint">
                          Draft differs from last Apply — table still matches the applied filter.
                        </Typography.Text>
                      ) : null}
                    </div>
                  </div>
                </div>
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
                  Order Form
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
              Order Table
            </Typography.Title>
            <div className="order-table-heading-actions">
              <Typography.Text type="secondary" className="order-table-heading-actions__hint">
                Open orders only. Checks = bulk actions; row click = audit. AI filter: describe intent, Apply (OpenAI), Clear to reset. Footer shows Checked vs Audit row.
              </Typography.Text>
              <Space wrap className="order-table-heading-actions__buttons" size={6}>
                <Button
                  danger
                  size="small"
                  className="order-table-action-btn"
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
                  size="small"
                  className="order-table-action-btn"
                  disabled={selectedOpenOrders.length !== 1}
                  onClick={() => setAmendModalOpen(true)}
                >
                  Amend selected
                </Button>
              </Space>
            </div>
          </div>

          {orderFormOpen ? <OrderEntryForm /> : null}

          <section className="order-table-section" aria-label="Order Table">
            <Card className="app-card">
              {auditCheckedDiverge ? (
                <Alert
                  type="info"
                  showIcon
                  className="blotter-selection-diverge-alert"
                  message="Audit row is not in your checked set — checks drive bulk actions; row click drives the audit trail."
                />
              ) : null}
              <BlotterTable
                key={blotterTableMountKey}
                data={filteredOrders}
                selectedRowKeys={selectedRowKeys}
                onSelectedRowKeysChange={setSelectedRowKeys}
                auditFocusKey={auditFocusKey}
                onAuditFocusKeyChange={setAuditFocusKey}
                auditSummaryLine={auditSummaryLine}
                auditSummaryTitle={auditSummaryTitle}
                onRowContextSummarize={(orderId) => {
                  setSelectedRowKeys([orderId])
                  setAuditFocusKey(orderId)
                  setSelectionModalOpen(true)
                }}
                onRowContextCancel={async (orderId) => {
                  setSelectedRowKeys([orderId])
                  setAuditFocusKey(orderId)
                  try {
                    const n = await cancelOrders([orderId])
                    if (n === 0) {
                      void message.warning('No open orders to cancel')
                    } else {
                      void message.success(n === 1 ? 'Order cancelled' : `${n} orders cancelled`)
                    }
                  } catch {
                    void message.error('Cancel failed')
                  }
                }}
                onRowContextAmend={(orderId) => {
                  setSelectedRowKeys([orderId])
                  setAuditFocusKey(orderId)
                  setAmendModalOpen(true)
                }}
              />
            </Card>
          </section>
        </div>

        <section className="audit-trail-section" aria-label="Audit Trail">
          <div className="surface-section-label-row">
            <Typography.Title level={5} className="surface-section-label">
              Audit Trail
            </Typography.Title>
          </div>
          <Card className="app-card app-card--audit" bordered={false}>
            <AuditTrailTable {...auditTrailProps} />
          </Card>
        </section>
      </Layout.Content>
    </Layout>
  )
}

export default PrimeBlotterApp
