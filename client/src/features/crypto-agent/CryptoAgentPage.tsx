import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Pause,
  Play,
  RefreshCw,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AgentDecision, AiModel, Candle, IndicatorSnapshot, TradeRecord, TradingMode } from '../../../../shared/crypto/types'
import { useCryptoStore } from './useCryptoStore'

const MODEL_LABELS: Record<AiModel, string> = {
  claude: 'Claude (Anthropic)',
  gpt: 'GPT-4o-mini (OpenAI)',
  deepseek: 'DeepSeek',
  grok: 'Grok (xAI)',
}

const SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'DOGE/USDT',
  'ADA/USDT',
  'AVAX/USDT',
]

export default function CryptoAgentPage() {
  const store = useCryptoStore()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [selectedModel, setSelectedModel] = useState<AiModel>('claude')
  const [selectedMode, setSelectedMode] = useState<TradingMode>('paper')
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT')
  const [initialBalance, setInitialBalance] = useState(10)

  // Initial load
  useEffect(() => {
    store.fetchAvailableModels()
    store.fetchSettings()
    store.fetchAgentState()
    store.fetchTicker(selectedSymbol)
    store.fetchCandles(selectedSymbol)
    store.fetchIndicators(selectedSymbol)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Polling when agent is running
  useEffect(() => {
    if (store.agentState?.status === 'running') {
      pollRef.current = setInterval(() => {
        store.fetchAgentState()
        store.fetchTicker(selectedSymbol)
        store.fetchCandles(selectedSymbol)
        store.fetchIndicators(selectedSymbol)
      }, 15_000)
    } else if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.agentState?.status, selectedSymbol])

  const handleStart = useCallback(async () => {
    await store.startAgent(selectedModel, selectedMode, selectedSymbol, initialBalance)
  }, [store, selectedModel, selectedMode, selectedSymbol, initialBalance])

  const handleStop = useCallback(async () => {
    await store.stopAgent()
  }, [store])

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      store.fetchAgentState(),
      store.fetchTicker(selectedSymbol),
      store.fetchCandles(selectedSymbol),
      store.fetchIndicators(selectedSymbol),
    ])
  }, [store, selectedSymbol])

  const isRunning = store.agentState?.status === 'running'
  const portfolio = store.agentState?.portfolio ?? store.portfolio
  const ticker = store.ticker
  const indicators = store.indicators

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto', minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0, color: '#fff' }}>
            <Bot size={28} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Crypto AI Trading Agent
          </Typography.Title>
          <Typography.Text type="secondary">
            AI-powered cryptocurrency trading • Paper &amp; Live modes
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={handleRefresh}>
            Refresh
          </Button>
          <Button icon={<Settings size={14} />} onClick={() => store.setSettingsOpen(true)}>
            Settings
          </Button>
        </Space>
      </div>

      {store.error && (
        <Alert
          type="error"
          message={store.error}
          closable
          onClose={store.clearError}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Agent Controls */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: '#111118', border: '1px solid #1f1f2e' }}
      >
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <Select
                value={selectedSymbol}
                onChange={async (v) => {
                  setSelectedSymbol(v)
                  await Promise.all([
                    store.fetchTicker(v),
                    store.fetchCandles(v),
                    store.fetchIndicators(v),
                  ])
                }}
                style={{ width: 140 }}
                options={SYMBOLS.map((s) => ({ label: s, value: s }))}
              />
              <Select
                value={selectedModel}
                onChange={(v) => setSelectedModel(v)}
                style={{ width: 200 }}
                options={Object.entries(MODEL_LABELS).map(([k, v]) => ({
                  label: v,
                  value: k,
                  disabled: store.availableModels.length > 0 && !store.availableModels.includes(k as AiModel),
                }))}
              />
              <Radio.Group value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)}>
                <Radio.Button value="paper">Paper</Radio.Button>
                <Radio.Button value="live">Live</Radio.Button>
              </Radio.Group>
              <InputNumber
                prefix="$"
                value={initialBalance}
                min={1}
                max={1000}
                onChange={(v) => setInitialBalance(v ?? 10)}
                style={{ width: 100 }}
              />
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              {isRunning ? (
                <Button danger icon={<Pause size={14} />} onClick={handleStop}>
                  Stop Agent
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<Play size={14} />}
                  onClick={handleStart}
                  loading={store.loading}
                >
                  Start Agent
                </Button>
              )}
              <Tag color={isRunning ? 'green' : 'default'}>
                {store.agentState?.status?.toUpperCase() ?? 'IDLE'}
              </Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>{selectedSymbol} Price</span>}
              value={ticker?.price ?? 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#fff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>24h Change</span>}
              value={ticker?.change24h ?? 0}
              precision={2}
              suffix="%"
              valueStyle={{
                color: (ticker?.change24h ?? 0) >= 0 ? '#52c41a' : '#ff4d4f',
                fontSize: 20,
              }}
              prefix={(ticker?.change24h ?? 0) >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>Balance (USDT)</span>}
              value={portfolio?.balanceUSDT ?? 0}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#fff', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>Total P&amp;L</span>}
              value={portfolio?.totalPnl ?? 0}
              precision={4}
              prefix="$"
              valueStyle={{
                color: (portfolio?.totalPnl ?? 0) >= 0 ? '#52c41a' : '#ff4d4f',
                fontSize: 20,
              }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>Win Rate</span>}
              value={portfolio?.winRate ?? 0}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#faad14', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ background: '#111118', border: '1px solid #1f1f2e' }}>
            <Statistic
              title={<span style={{ color: '#888' }}>Trades</span>}
              value={portfolio?.totalTrades ?? 0}
              valueStyle={{ color: '#fff', fontSize: 20 }}
              suffix={
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ({portfolio?.wins ?? 0}W / {portfolio?.losses ?? 0}L)
                </Typography.Text>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* Left: Candle Chart + Indicators */}
        <Col span={16}>
          <Card
            title={<span style={{ color: '#fff' }}>Price Chart — {selectedSymbol}</span>}
            size="small"
            style={{ background: '#111118', border: '1px solid #1f1f2e', marginBottom: 16 }}
          >
            <CandleChart candles={store.candles} indicators={indicators} />
          </Card>

          {/* Trades Table */}
          <Card
            title={<span style={{ color: '#fff' }}>Trade History</span>}
            size="small"
            style={{ background: '#111118', border: '1px solid #1f1f2e' }}
          >
            <TradesTable trades={portfolio?.trades ?? []} />
          </Card>
        </Col>

        {/* Right: AI Reasoning + Positions */}
        <Col span={8}>
          {/* AI Decision */}
          <Card
            title={
              <span style={{ color: '#fff' }}>
                <TrendingUp size={14} style={{ marginRight: 6 }} />
                AI Reasoning
              </span>
            }
            size="small"
            style={{ background: '#111118', border: '1px solid #1f1f2e', marginBottom: 16 }}
          >
            <AgentReasoningPanel
              lastDecision={store.agentState?.lastDecision ?? null}
              decisionHistory={store.agentState?.decisionHistory ?? []}
              cycleCount={store.agentState?.cycleCount ?? 0}
            />
          </Card>

          {/* Indicators Panel */}
          <Card
            title={<span style={{ color: '#fff' }}>Technical Indicators</span>}
            size="small"
            style={{ background: '#111118', border: '1px solid #1f1f2e', marginBottom: 16 }}
          >
            <IndicatorsPanel indicators={indicators} />
          </Card>

          {/* Positions */}
          <Card
            title={<span style={{ color: '#fff' }}>Open Positions</span>}
            size="small"
            style={{ background: '#111118', border: '1px solid #1f1f2e' }}
          >
            {(portfolio?.positions?.length ?? 0) === 0 ? (
              <Typography.Text type="secondary">No open positions</Typography.Text>
            ) : (
              portfolio?.positions.map((pos) => (
                <div key={pos.symbol} style={{ marginBottom: 8 }}>
                  <Descriptions
                    size="small"
                    column={1}
                    labelStyle={{ color: '#888' }}
                    contentStyle={{ color: '#fff' }}
                  >
                    <Descriptions.Item label="Symbol">{pos.symbol}</Descriptions.Item>
                    <Descriptions.Item label="Side">
                      <Tag color={pos.side === 'buy' ? 'green' : 'red'}>{pos.side.toUpperCase()}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Qty">{pos.quantity.toFixed(8)}</Descriptions.Item>
                    <Descriptions.Item label="Entry">${pos.avgEntryPrice.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="Current">${pos.currentPrice.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="Unrealized P&L">
                      <span style={{ color: pos.unrealizedPnl >= 0 ? '#52c41a' : '#ff4d4f' }}>
                        ${pos.unrealizedPnl.toFixed(4)}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* Settings Drawer */}
      <SettingsDrawer />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CandleChart({ candles, indicators }: { candles: Candle[]; indicators: IndicatorSnapshot | null }) {
  if (!candles.length) {
    return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography.Text type="secondary">Loading chart data...</Typography.Text>
    </div>
  }

  const recent = candles.slice(-50)
  const minLow = Math.min(...recent.map((c) => c.l))
  const maxHigh = Math.max(...recent.map((c) => c.h))
  const range = maxHigh - minLow || 1
  const chartH = 280
  const chartW = '100%'

  return (
    <div style={{ position: 'relative', height: chartH, width: chartW, overflow: 'hidden' }}>
      <svg width="100%" height={chartH} viewBox={`0 0 ${recent.length * 14} ${chartH}`} preserveAspectRatio="none">
        {recent.map((c, i) => {
          const isGreen = c.c >= c.o
          const bodyTop = ((maxHigh - Math.max(c.o, c.c)) / range) * (chartH - 20) + 10
          const bodyBot = ((maxHigh - Math.min(c.o, c.c)) / range) * (chartH - 20) + 10
          const wickTop = ((maxHigh - c.h) / range) * (chartH - 20) + 10
          const wickBot = ((maxHigh - c.l) / range) * (chartH - 20) + 10
          const x = i * 14
          const bodyH = Math.max(1, bodyBot - bodyTop)

          return (
            <g key={i}>
              <line
                x1={x + 6}
                y1={wickTop}
                x2={x + 6}
                y2={wickBot}
                stroke={isGreen ? '#52c41a' : '#ff4d4f'}
                strokeWidth={1}
              />
              <rect
                x={x + 2}
                y={bodyTop}
                width={9}
                height={bodyH}
                fill={isGreen ? '#52c41a' : '#ff4d4f'}
                rx={1}
              />
            </g>
          )
        })}
        {/* SMA 20 line */}
        {indicators?.sma20 && (
          <line
            x1={0}
            y1={((maxHigh - indicators.sma20) / range) * (chartH - 20) + 10}
            x2={recent.length * 14}
            y2={((maxHigh - indicators.sma20) / range) * (chartH - 20) + 10}
            stroke="#faad14"
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.6}
          />
        )}
        {/* Bollinger Bands */}
        {indicators?.bollingerUpper && (
          <line
            x1={0}
            y1={((maxHigh - indicators.bollingerUpper) / range) * (chartH - 20) + 10}
            x2={recent.length * 14}
            y2={((maxHigh - indicators.bollingerUpper) / range) * (chartH - 20) + 10}
            stroke="#1890ff"
            strokeWidth={1}
            strokeDasharray="2,4"
            opacity={0.4}
          />
        )}
        {indicators?.bollingerLower && (
          <line
            x1={0}
            y1={((maxHigh - indicators.bollingerLower) / range) * (chartH - 20) + 10}
            x2={recent.length * 14}
            y2={((maxHigh - indicators.bollingerLower) / range) * (chartH - 20) + 10}
            stroke="#1890ff"
            strokeWidth={1}
            strokeDasharray="2,4"
            opacity={0.4}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 10, color: '#888' }}>
        <span style={{ color: '#faad14' }}>— SMA(20)</span>
        {' '}
        <span style={{ color: '#1890ff' }}>-- Bollinger</span>
      </div>
    </div>
  )
}

function AgentReasoningPanel({
  lastDecision,
  decisionHistory,
  cycleCount,
}: {
  lastDecision: AgentDecision | null
  decisionHistory: AgentDecision[]
  cycleCount: number
}) {
  if (!lastDecision) {
    return <Typography.Text type="secondary">Agent has not made any decisions yet. Start the agent to begin.</Typography.Text>
  }

  const actionColor = lastDecision.action === 'buy' ? '#52c41a' : lastDecision.action === 'sell' ? '#ff4d4f' : '#faad14'
  const recent = decisionHistory.slice(-5).reverse()

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Tag color={actionColor} style={{ fontSize: 16, padding: '4px 12px' }}>
          {lastDecision.action.toUpperCase()}
        </Tag>
        <Tag>{lastDecision.confidence}% confidence</Tag>
        <Tag>{MODEL_LABELS[lastDecision.model] ?? lastDecision.model}</Tag>
      </div>
      <Typography.Paragraph style={{ color: '#ccc', fontSize: 13 }}>
        {lastDecision.reasoning}
      </Typography.Paragraph>
      <Divider style={{ margin: '8px 0', borderColor: '#1f1f2e' }} />
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        Cycle #{cycleCount} • Recent decisions:
      </Typography.Text>
      <div style={{ marginTop: 4 }}>
        {recent.map((d, i) => (
          <div key={i} style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
            <Tag
              color={d.action === 'buy' ? 'green' : d.action === 'sell' ? 'red' : 'default'}
              style={{ fontSize: 10 }}
            >
              {d.action}
            </Tag>
            {d.confidence}% — {d.reasoning.slice(0, 60)}
            {d.reasoning.length > 60 ? '…' : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function IndicatorsPanel({ indicators }: { indicators: IndicatorSnapshot | null }) {
  if (!indicators) {
    return <Typography.Text type="secondary">Loading indicators...</Typography.Text>
  }

  const rsiColor = (indicators.rsi14 ?? 50) > 70 ? '#ff4d4f' : (indicators.rsi14 ?? 50) < 30 ? '#52c41a' : '#faad14'

  return (
    <Descriptions
      size="small"
      column={1}
      labelStyle={{ color: '#888', fontSize: 12 }}
      contentStyle={{ color: '#fff', fontSize: 12 }}
    >
      <Descriptions.Item label="RSI(14)">
        <span style={{ color: rsiColor, fontWeight: 600 }}>
          {indicators.rsi14?.toFixed(1) ?? '—'}
        </span>
        <span style={{ color: '#666', marginLeft: 4, fontSize: 10 }}>
          {(indicators.rsi14 ?? 50) > 70 ? '(Overbought)' : (indicators.rsi14 ?? 50) < 30 ? '(Oversold)' : '(Neutral)'}
        </span>
      </Descriptions.Item>
      <Descriptions.Item label="MACD">
        <span style={{ color: (indicators.macdHist ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {indicators.macdHist?.toFixed(2) ?? '—'}
        </span>
      </Descriptions.Item>
      <Descriptions.Item label="Bollinger">
        {indicators.bollingerLower?.toFixed(2) ?? '—'} / {indicators.bollingerMiddle?.toFixed(2) ?? '—'} / {indicators.bollingerUpper?.toFixed(2) ?? '—'}
      </Descriptions.Item>
      <Descriptions.Item label="SMA(20)">${indicators.sma20?.toFixed(2) ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="ATR(14)">{indicators.atr14?.toFixed(2) ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Volume vs Avg">
        {indicators.currentVolume && indicators.volumeSma20
          ? `${((indicators.currentVolume / indicators.volumeSma20) * 100).toFixed(0)}%`
          : '—'}
      </Descriptions.Item>
    </Descriptions>
  )
}

const TRADE_COLUMNS: ColumnsType<TradeRecord> = [
  {
    title: 'Time',
    dataIndex: 'ts',
    key: 'ts',
    width: 150,
    render: (ts: number) => new Date(ts).toLocaleString(),
  },
  {
    title: 'Side',
    dataIndex: 'side',
    key: 'side',
    width: 60,
    render: (side: string) => (
      <Tag color={side === 'buy' ? 'green' : 'red'}>{side.toUpperCase()}</Tag>
    ),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    key: 'price',
    width: 100,
    render: (p: number) => `$${p.toFixed(2)}`,
  },
  {
    title: 'Amount',
    dataIndex: 'cost',
    key: 'cost',
    width: 80,
    render: (c: number) => `$${c.toFixed(2)}`,
  },
  {
    title: 'P&L',
    dataIndex: 'pnl',
    key: 'pnl',
    width: 80,
    render: (pnl: number | undefined) => (
      <span style={{ color: (pnl ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
        ${(pnl ?? 0).toFixed(4)}
      </span>
    ),
  },
  {
    title: 'Model',
    dataIndex: 'model',
    key: 'model',
    width: 80,
  },
  {
    title: 'Reasoning',
    dataIndex: 'reasoning',
    key: 'reasoning',
    ellipsis: true,
  },
]

function TradesTable({ trades }: { trades: TradeRecord[] }) {
  const sorted = [...trades].reverse()
  return (
    <Table
      dataSource={sorted}
      columns={TRADE_COLUMNS}
      rowKey="id"
      size="small"
      pagination={{ pageSize: 10, size: 'small' }}
      scroll={{ x: 700 }}
      style={{ background: 'transparent' }}
    />
  )
}

function SettingsDrawer() {
  const { settingsOpen, setSettingsOpen, settings, updateSettings, fetchAvailableModels, fetchSettings } = useCryptoStore()
  const [form] = Form.useForm()

  useEffect(() => {
    if (settingsOpen && settings) {
      form.setFieldsValue(settings)
    }
  }, [settingsOpen, settings, form])

  const handleSave = async () => {
    const values = form.getFieldsValue()
    // Only send non-masked values
    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) {
      if (typeof v === 'string' && v.startsWith('••••')) continue
      if (v !== undefined && v !== '') patch[k] = v
    }
    await updateSettings(patch)
    await fetchAvailableModels()
    await fetchSettings()
    setSettingsOpen(false)
  }

  return (
    <Drawer
      title="Agent Settings"
      open={settingsOpen}
      onClose={() => setSettingsOpen(false)}
      width={480}
      extra={
        <Button type="primary" onClick={handleSave}>
          Save
        </Button>
      }
    >
      <Form form={form} layout="vertical">
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>API Keys</Typography.Text>
        <Form.Item label="Anthropic API Key (Claude)" name="anthropicApiKey">
          <Input.Password placeholder="sk-ant-..." />
        </Form.Item>
        <Form.Item label="OpenAI API Key (GPT)" name="openaiApiKey">
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item label="DeepSeek API Key" name="deepseekApiKey">
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item label="Grok API Key (xAI)" name="grokApiKey">
          <Input.Password placeholder="xai-..." />
        </Form.Item>

        <Divider plain />
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Exchange (Live Trading)</Typography.Text>
        <Form.Item label="Binance API Key" name="binanceApiKey">
          <Input.Password placeholder="Required for live trading only" />
        </Form.Item>
        <Form.Item label="Binance API Secret" name="binanceApiSecret">
          <Input.Password placeholder="Required for live trading only" />
        </Form.Item>

        <Divider plain />
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Risk Management</Typography.Text>
        <Form.Item label="Max Position (USDT)" name="maxPositionUSDT">
          <InputNumber min={1} max={10000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Stop Loss %" name="stopLossPct">
          <InputNumber min={0.1} max={50} step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Take Profit %" name="takeProfitPct">
          <InputNumber min={0.1} max={100} step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Trade Interval (seconds)" name="tradeIntervalMs">
          <InputNumber
            min={10}
            max={3600}
            step={10}
            formatter={(v) => `${((v as number) / 1000).toFixed(0)}s`}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Divider plain />
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>24/7 Night Mode</Typography.Text>
        <Form.Item
          label="Night Trading (auto-trade when you're away)"
          name="nightMode"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Alert
          type="info"
          message="Paper trading uses real market prices but simulated execution. No real money involved."
          style={{ marginTop: 16 }}
        />
      </Form>
    </Drawer>
  )
}
