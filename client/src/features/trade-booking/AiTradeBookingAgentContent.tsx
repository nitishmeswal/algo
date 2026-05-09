import { Alert, Button, Divider, Input, Steps, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Check } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import type { StepLog, TradeBookingResponse } from '../../../../shared/nlp/tradeBookingAgent'

import { inferTradeFieldsPreview } from './inferTradeFieldsPreview'

const TRADE_DESCRIPTION_MAX_LEN = 4000

/** Mock booking history — replace with persisted runs (or session stack) when wiring data. */
const MOCK_BOOKING_HISTORY_ROWS = [
  {
    key: '1',
    at: '2026-05-09T09:14:22.000Z',
    summary: 'Sell 50 MSFT limit 400, day, account OMS-A',
    status: 'booked' as const,
    detail: 'Order 8f3a…c21 on blotter.',
  },
  {
    key: '2',
    at: '2026-05-09T09:08:01.000Z',
    summary: 'Buy 2,000 AAPL limit 285 GTC',
    status: 'blocked' as const,
    detail: 'Limit outside allowed band vs reference — edit price and retry.',
  },
  {
    key: '3',
    at: '2026-05-09T08:55:40.000Z',
    summary: 'Sell 500 META market, venue NSDQ',
    status: 'booked' as const,
    detail: 'Order 2d91…7ae on blotter.',
  },
  {
    key: '4',
    at: '2026-05-09T08:41:12.000Z',
    summary: 'Buy 100 AMZN limit 190',
    status: 'error' as const,
    detail: 'Agent unavailable — try again.',
  },
] as const

type MockBookingHistoryRow = (typeof MOCK_BOOKING_HISTORY_ROWS)[number]

/** One line, desk-friendly: local `YYYY-MM-DD HH:mm` (24h). */
function formatRunHistoryWhen(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${m}`
}

const OUTCOME_TAG: Record<MockBookingHistoryRow['status'], { color: 'success' | 'warning' | 'error'; label: string }> = {
  booked: { color: 'success', label: 'Booked' },
  blocked: { color: 'warning', label: 'Blocked' },
  error: { color: 'error', label: 'Error' },
}

const BOOKING_HISTORY_COLUMNS: ColumnsType<MockBookingHistoryRow> = [
  {
    title: 'When',
    dataIndex: 'at',
    key: 'at',
    width: 100,
    className: 'ai-trade-agent__run-history-col-when',
    render: (at: string) => (
      <Typography.Text
        type="secondary"
        ellipsis={{ tooltip: at }}
        className="ai-trade-agent__run-history-time"
      >
        {formatRunHistoryWhen(at)}
      </Typography.Text>
    ),
  },
  {
    title: 'Trade',
    dataIndex: 'summary',
    key: 'summary',
    ellipsis: true,
    className: 'ai-trade-agent__run-history-col-trade',
    render: (text: string) => (
      <Typography.Text ellipsis={{ tooltip: text }} className="ai-trade-agent__run-history-trade">
        {text}
      </Typography.Text>
    ),
  },
  {
    title: 'Outcome',
    key: 'outcome',
    width: 158,
    align: 'left',
    className: 'ai-trade-agent__run-history-col-outcome',
    render: (_, row) => {
      const tag = OUTCOME_TAG[row.status]
      return (
        <div className="ai-trade-agent__run-history-outcome">
          <Tag color={tag.color} className="ai-trade-agent__run-history-tag">
            {tag.label}
          </Tag>
          <Typography.Text
            type="secondary"
            ellipsis={{ tooltip: row.detail }}
            className="ai-trade-agent__run-history-detail"
          >
            {row.detail}
          </Typography.Text>
        </div>
      )
    },
  },
]

const AGENT_STEP_META = [
  { title: 'Intent parsed', sub: 'Symbol, side, qty, price, order type' },
  { title: 'Symbol valid', sub: 'Universe / reference data check' },
  { title: 'Quantity within limits', sub: 'Risk caps & exposure' },
  { title: 'Price validated', sub: 'Vs reference or market band' },
  { title: 'Trade booked', sub: 'Order created + stream update' },
] as const

function mapStepStatus(s: string): 'wait' | 'process' | 'finish' | 'error' {
  if (s === 'pending') return 'wait'
  if (s === 'running') return 'process'
  if (s === 'ok') return 'finish'
  if (s === 'fail') return 'error'
  return 'wait'
}

function buildVerticalSteps(stepSnapshot: StepLog[] | null) {
  if (!stepSnapshot?.length) {
    return AGENT_STEP_META.map(({ title, sub }) => ({
      status: 'wait' as const,
      title,
      description: sub,
    }))
  }
  const ordered = [...stepSnapshot].sort((a, b) => a.id - b.id)
  return ordered.map((step, i) => {
    const meta = AGENT_STEP_META[i] ?? { title: step.tool, sub: '' }
    return {
      status: mapStepStatus(step.status),
      title: meta.title,
      description: step.detail?.trim() ? step.detail : meta.sub,
    }
  })
}

export function AiTradeBookingAgentTitle() {
  return (
    <div className="ai-trade-agent__modal-title">
      <Typography.Text className="ai-trade-agent__modal-title-name">AI Trade Booking Agent</Typography.Text>
      <Typography.Text type="secondary" className="ai-trade-agent__modal-title-sub">
        Natural language → validated order
      </Typography.Text>
    </div>
  )
}

export type AiTradeBookingAgentContentProps = {
  tradeDescription: string
  onTradeDescriptionChange: (value: string) => void
  agentLoading: boolean
  agentError: string | null
  agentResult: TradeBookingResponse | null
  /** Latest `steps[]` from SSE while running, or final steps from the last response. */
  agentStepSnapshot: StepLog[] | null
  onClearAgentResult: () => void
  /** Extra line(s) below recent runs (e.g. drawer resize hint). */
  footerExtra?: ReactNode
}

export function AiTradeBookingAgentContent({
  tradeDescription,
  onTradeDescriptionChange,
  agentLoading,
  agentError,
  agentResult,
  agentStepSnapshot,
  onClearAgentResult,
  footerExtra,
}: AiTradeBookingAgentContentProps) {
  const [escalationBannerOpen, setEscalationBannerOpen] = useState(true)

  const fieldChecks = useMemo(() => inferTradeFieldsPreview(tradeDescription), [tradeDescription])
  const verticalSteps = useMemo(() => buildVerticalSteps(agentStepSnapshot), [agentStepSnapshot])

  const requirementRow = [
    { key: 'side', label: 'Buy or sell', ok: fieldChecks.side },
    { key: 'symbol', label: 'Symbol', ok: fieldChecks.symbol },
    { key: 'quantity', label: 'Quantity', ok: fieldChecks.quantity },
    { key: 'price', label: 'Price or market', ok: fieldChecks.price },
  ] as const

  const booked = agentResult?.outcome === 'booked' ? agentResult : null
  const escalated = agentResult?.outcome === 'escalated' ? agentResult : null
  const errored = agentResult?.outcome === 'error' ? agentResult : null

  return (
    <div className="ai-trade-agent">
      {agentError ? (
        <Alert type="error" showIcon message="Request failed" description={agentError} className="ai-trade-agent__alert" />
      ) : null}

      {booked ? (
        <Alert
          type="success"
          showIcon
          message="Trade booked"
          description={
            <span>
              Order <Typography.Text code>{booked.order.id}</Typography.Text> was created and merged into the blotter.
            </span>
          }
          className="ai-trade-agent__alert"
        />
      ) : null}

      {escalated && escalationBannerOpen ? (
        <Alert
          type="warning"
          showIcon
          message="Needs attention"
          description={
            <div>
              <Typography.Paragraph className="ai-trade-agent__alert-escalation-reason">
                {escalated.reason}
              </Typography.Paragraph>
              <Typography.Text type="secondary" className="ai-trade-agent__alert-escalation-hint">
                Failed step: <Typography.Text code>{escalated.failedStep}</Typography.Text>. Confirm does not force a
                bypass in v1 — edit the description and run the agent again. Reject clears this banner.
              </Typography.Text>
              <div className="ai-trade-agent__alert-escalation-actions">
                <Button type="primary" size="small" onClick={() => setEscalationBannerOpen(false)}>
                  Confirm (dismiss)
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    onClearAgentResult()
                    setEscalationBannerOpen(true)
                  }}
                >
                  Reject (clear result)
                </Button>
              </div>
            </div>
          }
          className="ai-trade-agent__alert ai-trade-agent__alert--escalation"
        />
      ) : null}

      {errored ? (
        <Alert type="error" showIcon message="Agent did not book" description={errored.message} className="ai-trade-agent__alert" />
      ) : null}

      <section className="ai-trade-agent__section ai-trade-agent__section--input">
        <Typography.Title level={5} className="ai-trade-agent__section-title">
          Trade description
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="ai-trade-agent__section-lead">
          Describe your trade in plain English. Example:{' '}
          <Typography.Text keyboard className="ai-trade-agent__kbd">
            Buy 1000 AAPL limit 285
          </Typography.Text>
        </Typography.Paragraph>
        <Input.TextArea
          value={tradeDescription}
          onChange={(e) => onTradeDescriptionChange(e.target.value)}
          placeholder="e.g. Sell 500 MSFT market, account OMS-A, venue NYSE"
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={TRADE_DESCRIPTION_MAX_LEN}
          className="ai-trade-agent__textarea"
          allowClear
          disabled={agentLoading}
        />
        <div className="ai-trade-agent__char-count" aria-live="polite">
          <Typography.Text type="secondary" className="ai-trade-agent__char-count-text">
            {tradeDescription.length} / {TRADE_DESCRIPTION_MAX_LEN}
          </Typography.Text>
        </div>
        <div className="ai-trade-agent__intent-panel">
          <p className="ai-trade-agent__intent-panel-hint">Include in your description</p>
          <div className="ai-trade-agent__intent-strip" role="status" aria-live="polite" aria-label="Trade field checks">
            {requirementRow.flatMap(({ key, label, ok }, i) => {
              const row = (
                <div
                  key={key}
                  className={`ai-trade-req${ok ? ' ai-trade-req--ok' : ''}`}
                  title={ok ? `${label} detected` : `Add ${label.toLowerCase()}`}
                >
                  <span className="ai-trade-req__glyph" aria-hidden>
                    {ok ? <Check className="ai-trade-req__check" size={10} strokeWidth={2.5} /> : null}
                  </span>
                  <span className="ai-trade-req__label">{label}</span>
                </div>
              )
              if (i === 0) return [row]
              return [
                <span key={`${key}-sep`} className="ai-trade-agent__intent-sep" aria-hidden />,
                row,
              ]
            })}
          </div>
        </div>
      </section>

      <div className="ai-trade-agent__dual">
        <section className="ai-trade-agent__section ai-trade-agent__section--muted ai-trade-agent__section--validation">
          <Typography.Title level={5} className="ai-trade-agent__section-title">
            Agent validation
          </Typography.Title>
          <Steps
            direction="vertical"
            size="small"
            className="ai-trade-agent__steps"
            items={verticalSteps.map((item) => ({
              ...item,
              status:
                agentLoading && agentStepSnapshot == null && item.status === 'wait' ? 'process' : item.status,
            }))}
          />
        </section>

        <section className="ai-trade-agent__section ai-trade-agent__section--muted ai-trade-agent__section--audit">
          <Typography.Title level={5} className="ai-trade-agent__section-title">
            Recent runs
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="ai-trade-agent__run-history-lead">
            See what you already sent and whether it landed — less duplicate tickets, faster handoffs to ops. (Mock
            data.)
          </Typography.Paragraph>
          <Table<MockBookingHistoryRow>
            className="ai-trade-agent__run-history"
            tableLayout="fixed"
            size="small"
            pagination={false}
            columns={BOOKING_HISTORY_COLUMNS}
            dataSource={[...MOCK_BOOKING_HISTORY_ROWS]}
          />
          {footerExtra ? (
            <>
              <Divider className="ai-trade-agent__divider" />
              <div className="ai-trade-agent__footer-extra">{footerExtra}</div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
