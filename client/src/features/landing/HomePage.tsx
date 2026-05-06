import {
  ArrowRightOutlined,
  AuditOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { Sparkles } from 'lucide-react'
import { Button } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './HomePage.css'

function HeroDashboardMock() {
  const PASSES = [
    {
      totalOrders: 138,
      totalPnl: '+$10,482',
      pnlTone: 'up',
      regime: 'Trend up',
      linePath: 'M0,114 C44,112 74,96 120,88 C168,80 208,64 254,52 C308,40 354,24 400,18',
      areaPath: 'M0,114 C44,112 74,96 120,88 C168,80 208,64 254,52 C308,40 354,24 400,18 L400,140 L0,140 Z',
    },
    {
      totalOrders: 172,
      totalPnl: '+$14,931',
      pnlTone: 'up',
      regime: 'High churn',
      linePath: 'M0,108 C46,90 72,112 110,84 C148,58 188,96 226,66 C266,38 302,78 340,42 C362,28 380,30 400,20',
      areaPath: 'M0,108 C46,90 72,112 110,84 C148,58 188,96 226,66 C266,38 302,78 340,42 C362,28 380,30 400,20 L400,140 L0,140 Z',
    },
    {
      totalOrders: 127,
      totalPnl: '-$2,184',
      pnlTone: 'down',
      regime: 'Pullback',
      linePath: 'M0,74 C40,70 78,56 118,64 C158,72 198,90 236,98 C282,108 334,112 400,118',
      areaPath: 'M0,74 C40,70 78,56 118,64 C158,72 198,90 236,98 C282,108 334,112 400,118 L400,140 L0,140 Z',
    },
    {
      totalOrders: 149,
      totalPnl: '+$412',
      pnlTone: 'flat',
      regime: 'Range-bound',
      linePath: 'M0,94 C50,86 88,98 132,88 C176,78 214,92 256,82 C304,72 346,90 400,84',
      areaPath: 'M0,94 C50,86 88,98 132,88 C176,78 214,92 256,82 C304,72 346,90 400,84 L400,140 L0,140 Z',
    },
  ] as const

  const [passIndex, setPassIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPassIndex((prev) => (prev + 1) % PASSES.length)
    }, 2800)
    return () => window.clearInterval(id)
  }, [PASSES.length])

  const current = PASSES[passIndex]

  return (
    <div className="landing-hero-mock" aria-hidden>
      <div className="landing-hero-mock__tabs">
        <span className="landing-hero-mock__tab landing-hero-mock__tab--active">Dashboard</span>
        <span className="landing-hero-mock__tab">Blotter</span>
        <span className="landing-hero-mock__tab">Positions</span>
        <span className="landing-hero-mock__tab">Analytics</span>
      </div>
      <div className="landing-hero-mock__metrics">
        <div className="landing-hero-mock__metric" key={`orders-${passIndex}`}>
          <span className="landing-hero-mock__metric-label">Total orders</span>
          <span className="landing-hero-mock__metric-value">{current.totalOrders}</span>
        </div>
        <div className="landing-hero-mock__metric" key={`pnl-${passIndex}`}>
          <span className="landing-hero-mock__metric-label">Total P&amp;L</span>
          <span
            className={`landing-hero-mock__metric-value ${
              current.pnlTone === 'up'
                ? 'landing-hero-mock__metric-value--green'
                : current.pnlTone === 'down'
                  ? 'landing-hero-mock__metric-value--red'
                  : 'landing-hero-mock__metric-value--flat'
            }`}
          >
            {current.totalPnl}
          </span>
        </div>
      </div>
      <div className="landing-hero-mock__chart">
        <svg className="landing-hero-mock__svg" viewBox="0 0 400 140" preserveAspectRatio="none">
          <title>Equity curve preview</title>
          <defs>
            <linearGradient id="landing-equity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <filter id="landing-equity-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            key={`area-${passIndex}`}
            d={current.areaPath}
            fill="url(#landing-equity-fill)"
            className="landing-hero-mock__area"
          />
          <path
            key={`line-a-${passIndex}`}
            d={current.linePath}
            fill="none"
            stroke="#34d399"
            strokeWidth="2.5"
            filter="url(#landing-equity-glow)"
            vectorEffect="non-scaling-stroke"
            className="landing-hero-mock__line landing-hero-mock__line--primary"
          />
          <path
            key={`line-b-${passIndex}`}
            d={current.linePath}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="2"
            opacity="0.75"
            vectorEffect="non-scaling-stroke"
            className="landing-hero-mock__line landing-hero-mock__line--secondary"
          />
        </svg>
        <span className="landing-hero-mock__chart-caption">Equity curve · {current.regime}</span>
      </div>
      <div className="landing-hero-mock__ai">
        <div className="landing-hero-mock__ai-label">
          <Sparkles className="landing-hero-mock__ai-sparkle" size={14} aria-hidden strokeWidth={2} />
          FlowDesk AI
        </div>
        <p className="landing-hero-mock__ai-text">
          <span className="landing-hero-mock__ai-hl">Full book. Zero fog.</span>
          {' '}AI reads your blotter so you move on risk and flow — not another slow scroll.
        </p>
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="/" className="landing-nav__brand">
          <span className="landing-nav__logo" aria-hidden>
            {'\u25A6'}
          </span>
          <span className="landing-nav__title">FlowDesk</span>
        </Link>
        {/* Center nav: add links and remove aria-hidden + --placeholder when ready */}
        <nav className="landing-nav__links landing-nav__links--placeholder" aria-hidden="true" />
        <div className="landing-nav__cta">
          <button type="button" className="landing-nav__signin" onClick={() => navigate('/app')}>
            Sign in
          </button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <h1 className="landing-hero__h1">FlowDesk</h1>
            <p className="landing-hero__sub">
              Built for execution desks running high-velocity order flow.
            </p>
            <p className="landing-hero__lead">
              Real-time blotter, grouped audit trail, and NLP filter are live in this demo workspace.
              Summarize-selected and EOD report remain preview roadmap items.
            </p>
            <p className="landing-hero__live-now">Live now: persistent filters, audit stream, and natural-language filter.</p>
            <div className="landing-hero__actions">
              <Button
                type="primary"
                size="large"
                className="landing-btn-gradient landing-btn-gradient--lg"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/app')}
              >
                Open demo workspace
              </Button>
              <Button
                size="large"
                className="landing-btn-ghost"
                icon={<Sparkles className="landing-btn-ghost__sparkle" size={16} aria-hidden strokeWidth={2} />}
                disabled
              >
                Meet AI Analyst
              </Button>
            </div>
            <p className="landing-hero__trust-badge landing-hero__trust-badge--demo">
              <InfoCircleOutlined className="landing-hero__trust-icon" aria-hidden />
              Demo only — mock orders and simulated data · Not live trading · No billing
            </p>
          </div>
          <div className="landing-hero__visual">
            <HeroDashboardMock />
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="Trust">
          <span className="landing-trust-strip__item">
            <AuditOutlined /> Compliance-ready audit trail
          </span>
          <span className="landing-trust-strip__item">
            <DashboardOutlined /> Real-time analytics
          </span>
          <span className="landing-trust-strip__item">
            <RobotOutlined /> AI-powered insights
          </span>
        </section>

        <section className="landing-features" id="features">
          <h2 className="landing-features__title">What you get</h2>
          <p className="landing-features__subtitle">Live capabilities first, with roadmap items clearly separated.</p>
          <div className="landing-features__grid">
            <article className="landing-card landing-card--built">
              <h3 className="landing-card__h3">
                Live now
                <span className="landing-status-chip landing-status-chip--live">Live</span>
              </h3>
              <ul className="landing-card__list">
                <li>Real-time order blotter with P&amp;L</li>
                <li>Order lifecycle and status tracking</li>
                <li>Grouped audit trail with field-level changes</li>
                <li>Order form — submit, reset</li>
                <li>Bulk cancel and amend actions</li>
                <li>AI natural language filter (OpenAI parse → structured filter)</li>
                <li>Persistent filters and column preferences</li>
                <li>WebSocket stream for audit trail</li>
              </ul>
            </article>
            <article className="landing-card landing-card--ai">
              <h3 className="landing-card__h3">
                <Sparkles className="landing-card__ai-sparkle" size={18} aria-hidden strokeWidth={2} />
                AI status
              </h3>
              <ul className="landing-card__list">
                <li>
                  NLP filter (text to structured query)
                  <span className="landing-inline-status landing-inline-status--live">Live</span>
                </li>
                <li>
                  Summarize selected rows
                  <span className="landing-inline-status landing-inline-status--preview">Preview</span>
                </li>
                <li>
                  EOD report
                  <span className="landing-inline-status landing-inline-status--preview">Preview</span>
                </li>
                <li>Risk breach natural language alerts</li>
                <li>Position concentration warnings</li>
              </ul>
            </article>
            <article className="landing-card landing-card--roadmap">
              <h3 className="landing-card__h3">
                Roadmap
                <span className="landing-status-chip landing-status-chip--planned">Planned</span>
              </h3>
              <ul className="landing-card__list">
                <li>Live market data feed (Polygon.io)</li>
                <li>Real order submission (Alpaca paper trading)</li>
                <li>Positions real-time updates</li>
                <li>Analytics P&amp;L charts</li>
              </ul>
            </article>
          </div>
        </section>

        <footer className="landing-footer">
          <Link to="/app" className="landing-footer__link">
            Open FlowDesk
          </Link>
          <span className="landing-footer__muted">Mock data · Demo workspace</span>
        </footer>
      </main>
    </div>
  )
}
