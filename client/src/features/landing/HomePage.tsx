import {
  ArrowRightOutlined,
  AuditOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { Sparkles } from 'lucide-react'
import { Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import './HomePage.css'

function HeroDashboardMock() {
  return (
    <div className="landing-hero-mock" aria-hidden>
      <div className="landing-hero-mock__tabs">
        <span className="landing-hero-mock__tab landing-hero-mock__tab--active">Dashboard</span>
        <span className="landing-hero-mock__tab">Blotter</span>
        <span className="landing-hero-mock__tab">Positions</span>
        <span className="landing-hero-mock__tab">Analytics</span>
      </div>
      <div className="landing-hero-mock__metrics">
        <div className="landing-hero-mock__metric">
          <span className="landing-hero-mock__metric-label">Total orders</span>
          <span className="landing-hero-mock__metric-value">142</span>
        </div>
        <div className="landing-hero-mock__metric">
          <span className="landing-hero-mock__metric-label">Total P&amp;L</span>
          <span className="landing-hero-mock__metric-value landing-hero-mock__metric-value--green">+$12,847</span>
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
            d="M0,100 C60,95 80,70 130,75 C180,80 200,45 260,40 C310,36 340,20 400,15 L400,140 L0,140 Z"
            fill="url(#landing-equity-fill)"
          />
          <path
            d="M0,100 C60,95 80,70 130,75 C180,80 200,45 260,40 C310,36 340,20 400,15"
            fill="none"
            stroke="#34d399"
            strokeWidth="2.5"
            filter="url(#landing-equity-glow)"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="landing-hero-mock__chart-caption">Equity curve</span>
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
              Real-time order flow. AI-powered insights. Built for modern trading desks.
            </p>
            <p className="landing-hero__lead">
              A portfolio demonstration of a production-grade order management system — real-time blotter, full audit
              trail, AI summarization, and NLP filtering. Built with React, TypeScript, and WebSockets.
            </p>
            <div className="landing-hero__actions">
              <Button
                type="primary"
                size="large"
                className="landing-btn-gradient landing-btn-gradient--lg"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/app')}
              >
                Start free
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
          <p className="landing-features__subtitle">Everything you need to review performance without another bloated terminal.</p>
          <div className="landing-features__grid">
            <article className="landing-card landing-card--built">
              <h3 className="landing-card__h3">Built</h3>
              <ul className="landing-card__list">
                <li>Real-time order blotter with P&amp;L</li>
                <li>Order lifecycle and status tracking</li>
                <li>Grouped audit trail with field-level changes</li>
                <li>Order form — submit, reset</li>
                <li>Bulk cancel and amend actions</li>
                <li>AI natural language filter (text match)</li>
              </ul>
            </article>
            <article className="landing-card landing-card--roadmap">
              <h3 className="landing-card__h3">Roadmap</h3>
              <ul className="landing-card__list">
                <li>Live market data feed (Polygon.io)</li>
                <li>Real order submission (Alpaca paper trading)</li>
                <li>Persistent filters and column preferences</li>
                <li>Positions real-time updates</li>
                <li>Analytics P&amp;L charts</li>
                <li>WebSocket stream for audit trail</li>
              </ul>
            </article>
            <article className="landing-card landing-card--ai">
              <h3 className="landing-card__h3">
                <Sparkles className="landing-card__ai-sparkle" size={18} aria-hidden strokeWidth={2} />
                AI
              </h3>
              <ul className="landing-card__list">
                <li>Summarize selected rows — live</li>
                <li>EOD report — live</li>
                <li>NLP filter → structured query (swap in API when ready)</li>
                <li>Risk breach natural language alerts</li>
                <li>Position concentration warnings</li>
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
