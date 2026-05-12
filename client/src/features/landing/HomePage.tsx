import {
  ApiOutlined,
  CloudOutlined,
  InfoCircleOutlined,
  LaptopOutlined,
  RocketOutlined,
  SafetyOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Bot, ChevronRight, Cpu, Globe, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button, Modal } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'

/* ── Animated ticker bar ────────────────────────────────────────────────── */
function TickerBar() {
  const tickers = [
    { sym: 'BTC/USDT', price: '$103,482', change: '+2.4%', up: true },
    { sym: 'ETH/USDT', price: '$2,531', change: '+1.8%', up: true },
    { sym: 'SOL/USDT', price: '$172.40', change: '-0.6%', up: false },
    { sym: 'BNB/USDT', price: '$648.20', change: '+0.9%', up: true },
    { sym: 'XRP/USDT', price: '$2.34', change: '+3.1%', up: true },
    { sym: 'DOGE/USDT', price: '$0.224', change: '-1.2%', up: false },
    { sym: 'ADA/USDT', price: '$0.78', change: '+0.5%', up: true },
    { sym: 'AVAX/USDT', price: '$24.50', change: '+1.3%', up: true },
  ]
  return (
    <div className="ticker-bar" aria-label="Live crypto prices">
      <div className="ticker-bar__track">
        {[...tickers, ...tickers].map((t, i) => (
          <span key={i} className="ticker-bar__item">
            <span className="ticker-bar__sym">{t.sym}</span>
            <span className="ticker-bar__price">{t.price}</span>
            <span className={`ticker-bar__change ${t.up ? 'ticker-bar__change--up' : 'ticker-bar__change--down'}`}>
              {t.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Mode info dialogs ──────────────────────────────────────────────────── */

function OnlineModeContent() {
  return (
    <div className="mode-dialog">
      <div className="mode-dialog__header">
        <CloudOutlined className="mode-dialog__icon mode-dialog__icon--online" />
        <h3>Online Mode — Cloud AI</h3>
      </div>
      <p className="mode-dialog__desc">
        Use powerful cloud AI models for the best trading analysis. Requires an API key from any supported provider.
      </p>
      <div className="mode-dialog__models">
        <div className="mode-dialog__model">
          <strong>Claude (Anthropic)</strong>
          <span className="mode-dialog__tag mode-dialog__tag--recommended">Recommended</span>
          <p>Best nuanced market analysis. ~$0.003/cycle</p>
          <code>Get key → console.anthropic.com/settings/keys</code>
        </div>
        <div className="mode-dialog__model">
          <strong>GPT-4o-mini (OpenAI)</strong>
          <span className="mode-dialog__tag">Budget</span>
          <p>Fast and cheap. ~$0.001/cycle</p>
          <code>Get key → platform.openai.com/api-keys</code>
        </div>
        <div className="mode-dialog__model">
          <strong>DeepSeek</strong>
          <span className="mode-dialog__tag">Budget</span>
          <p>Cost-effective reasoning. ~$0.001/cycle</p>
          <code>Get key → platform.deepseek.com</code>
        </div>
        <div className="mode-dialog__model">
          <strong>Grok (xAI)</strong>
          <span className="mode-dialog__tag">Fast</span>
          <p>Real-time market context. ~$0.002/cycle</p>
          <code>Get key → console.x.ai</code>
        </div>
      </div>
      <div className="mode-dialog__steps">
        <h4>Setup in 30 seconds:</h4>
        <ol>
          <li>Get an API key from any provider above</li>
          <li>Open the app → click Settings (gear icon)</li>
          <li>Paste your API key → Save</li>
          <li>Select the model → Start Agent</li>
        </ol>
      </div>
    </div>
  )
}

function OfflineModeContent() {
  return (
    <div className="mode-dialog">
      <div className="mode-dialog__header">
        <LaptopOutlined className="mode-dialog__icon mode-dialog__icon--offline" />
        <h3>Offline Mode — Ollama (Free)</h3>
      </div>
      <p className="mode-dialog__desc">
        Run AI models locally on your own hardware. Completely free, no API keys, works offline. Your data never leaves your machine.
      </p>
      <div className="mode-dialog__models">
        <div className="mode-dialog__model">
          <strong>Qwen 3 8B</strong>
          <span className="mode-dialog__tag mode-dialog__tag--recommended">Default</span>
          <p>Best JSON output + reasoning. Needs ~6GB VRAM</p>
        </div>
        <div className="mode-dialog__model">
          <strong>Gemma 3n E4B</strong>
          <span className="mode-dialog__tag">Lightweight</span>
          <p>Google's efficient model. Needs ~4GB VRAM</p>
        </div>
        <div className="mode-dialog__model">
          <strong>GLM-4 9B</strong>
          <span className="mode-dialog__tag">Strong</span>
          <p>Strong reasoning. Needs ~7GB VRAM</p>
        </div>
        <div className="mode-dialog__model">
          <strong>DeepSeek-R1 8B</strong>
          <span className="mode-dialog__tag">Chain-of-thought</span>
          <p>Deep analysis. Needs ~6GB VRAM</p>
        </div>
      </div>
      <div className="mode-dialog__steps">
        <h4>Setup in 2 minutes:</h4>
        <ol>
          <li>
            <strong>Install Ollama</strong> — go to{' '}
            <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">
              ollama.com/download
            </a>{' '}
            and download for your OS (Windows/Mac/Linux)
          </li>
          <li>
            <strong>Pull a model</strong> — open terminal/command prompt and run:
            <code className="mode-dialog__code-block">ollama pull qwen3:8b</code>
          </li>
          <li><strong>Open the app</strong> → Settings → select "Ollama (Local)"</li>
          <li><strong>Start Agent</strong> — it connects to your local Ollama automatically</li>
        </ol>
      </div>
      <div className="mode-dialog__note">
        <InfoCircleOutlined /> Minimum: 8GB VRAM GPU (GTX 1070+). Works great on RTX 3060, 4060, 5070 etc.
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default function HomePage() {
  const navigate = useNavigate()
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [offlineOpen, setOfflineOpen] = useState(false)

  return (
    <div className="landing">
      <TickerBar />

      <header className="landing-nav">
        <div className="landing-nav__brand">
          <TrendingUp size={24} className="landing-nav__logo-icon" />
          <span className="landing-nav__title">AlgoTrader AI</span>
        </div>
        <nav className="landing-nav__links">
          <a href="#features" className="landing-nav__link">Features</a>
          <a href="#modes" className="landing-nav__link">AI Modes</a>
          <a href="#how-it-works" className="landing-nav__link">How It Works</a>
        </nav>
        <div className="landing-nav__cta">
          <Button
            type="primary"
            className="landing-btn-gradient"
            icon={<RocketOutlined />}
            onClick={() => navigate('/agent')}
          >
            Launch Agent
          </Button>
        </div>
      </header>

      <main>
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <div className="landing-hero__badge">
              <Sparkles size={14} /> AI-Powered Crypto Trading
            </div>
            <h1 className="landing-hero__h1">
              Your AI Trading Agent.
              <br />
              <span className="landing-hero__h1-accent">24/7 Market Intelligence.</span>
            </h1>
            <p className="landing-hero__sub">
              Real-time market data, technical analysis, and AI decision-making — all automated.
              Start with paper trading (zero risk), go live when you're ready.
            </p>
            <div className="landing-hero__actions">
              <Button
                type="primary"
                size="large"
                className="landing-btn-gradient landing-btn-gradient--lg"
                icon={<RocketOutlined />}
                onClick={() => navigate('/agent')}
              >
                Start Paper Trading — Free
              </Button>
              <Button
                size="large"
                className="landing-btn-ghost"
                icon={<SettingOutlined />}
                onClick={() => navigate('/agent')}
              >
                Configure & Go
              </Button>
            </div>
            <div className="landing-hero__badges">
              <span className="landing-hero__trust-badge">
                <SafetyOutlined /> Paper trading — zero risk
              </span>
              <span className="landing-hero__trust-badge landing-hero__trust-badge--highlight">
                <ThunderboltOutlined /> Ollama offline mode — free
              </span>
            </div>
          </div>
          <div className="landing-hero__visual">
            <div className="landing-hero-mock">
              <div className="landing-hero-mock__header">
                <Bot size={16} />
                <span>AI Agent — Live Analysis</span>
                <span className="landing-hero-mock__status">Running</span>
              </div>
              <div className="landing-hero-mock__metrics">
                <div className="landing-hero-mock__metric">
                  <span className="landing-hero-mock__metric-label">Balance</span>
                  <span className="landing-hero-mock__metric-value">$52.40</span>
                </div>
                <div className="landing-hero-mock__metric">
                  <span className="landing-hero-mock__metric-label">P&L</span>
                  <span className="landing-hero-mock__metric-value landing-hero-mock__metric-value--green">+$42.40 (+424%)</span>
                </div>
              </div>
              <div className="landing-hero-mock__chart">
                <svg className="landing-hero-mock__svg" viewBox="0 0 400 120" preserveAspectRatio="none">
                  <title>Portfolio growth</title>
                  <defs>
                    <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,100 C30,95 60,80 90,75 C120,70 150,60 180,45 C210,30 240,35 270,25 C300,15 330,20 360,12 L400,8 L400,120 L0,120 Z"
                    fill="url(#hero-fill)"
                    className="landing-hero-mock__area"
                  />
                  <path
                    d="M0,100 C30,95 60,80 90,75 C120,70 150,60 180,45 C210,30 240,35 270,25 C300,15 330,20 360,12 L400,8"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                    className="landing-hero-mock__line"
                  />
                </svg>
              </div>
              <div className="landing-hero-mock__decision">
                <Sparkles size={14} className="landing-hero-mock__sparkle" />
                <div>
                  <div className="landing-hero-mock__decision-label">AI Decision — 87% confidence</div>
                  <div className="landing-hero-mock__decision-text">
                    BUY: RSI oversold at 32.4, bullish MACD crossover, price near lower Bollinger band
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── AI Modes Section ──────────────────────────────────────── */}
        <section className="landing-modes" id="modes">
          <h2 className="landing-section__title">Choose Your AI Mode</h2>
          <p className="landing-section__subtitle">
            Run with cloud APIs for maximum power, or go fully offline with local models — your choice.
          </p>
          <div className="landing-modes__grid">
            <div className="landing-mode-card landing-mode-card--online" onClick={() => setOnlineOpen(true)}>
              <div className="landing-mode-card__icon-wrap landing-mode-card__icon-wrap--online">
                <Globe size={28} />
              </div>
              <h3>Online Mode</h3>
              <p>Cloud AI models — Claude, GPT, DeepSeek, Grok</p>
              <ul>
                <li><Zap size={14} /> Most powerful analysis</li>
                <li><ApiOutlined /> Requires API key</li>
                <li><WalletOutlined /> ~$0.001–0.003 per cycle</li>
              </ul>
              <button className="landing-mode-card__info-btn" type="button">
                <InfoCircleOutlined /> How to set up <ChevronRight size={14} />
              </button>
            </div>
            <div className="landing-mode-card landing-mode-card--offline" onClick={() => setOfflineOpen(true)}>
              <div className="landing-mode-card__icon-wrap landing-mode-card__icon-wrap--offline">
                <Cpu size={28} />
              </div>
              <h3>Offline Mode</h3>
              <p>Local Ollama models — Qwen 3, Gemma, GLM-4, DeepSeek</p>
              <ul>
                <li><Shield size={14} /> 100% free — no API costs</li>
                <li><LaptopOutlined /> Runs on your GPU</li>
                <li><SafetyOutlined /> Data never leaves your machine</li>
              </ul>
              <button className="landing-mode-card__info-btn" type="button">
                <InfoCircleOutlined /> How to set up <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────── */}
        <section className="landing-features" id="features">
          <h2 className="landing-section__title">What You Get</h2>
          <p className="landing-section__subtitle">
            Everything you need for AI-powered crypto trading, out of the box.
          </p>
          <div className="landing-features__grid">
            {[
              { icon: <Bot size={22} />, title: 'AI Trading Agent', desc: 'Automated buy/sell/hold decisions every 60 seconds with confidence scoring' },
              { icon: <TrendingUp size={22} />, title: 'Technical Analysis', desc: 'RSI, MACD, Bollinger Bands, SMA, EMA, ATR — all computed in real-time' },
              { icon: <Shield size={22} />, title: 'Risk Management', desc: 'Auto stop-loss (-3%) and take-profit (+5%) protect your capital' },
              { icon: <Globe size={22} />, title: 'Real Market Data', desc: 'Live prices from KuCoin, Bybit, Kraken, Binance — auto-detects best exchange' },
              { icon: <Cpu size={22} />, title: '5 AI Models', desc: 'Claude, GPT, DeepSeek, Grok, or Ollama local — compare and pick your best' },
              { icon: <Zap size={22} />, title: '24/7 Night Mode', desc: 'Toggle night mode and let the agent trade while you sleep' },
            ].map((f, i) => (
              <div key={i} className="landing-feature-card">
                <div className="landing-feature-card__icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────── */}
        <section className="landing-how" id="how-it-works">
          <h2 className="landing-section__title">How It Works</h2>
          <p className="landing-section__subtitle">From zero to trading in under 3 minutes.</p>
          <div className="landing-how__steps">
            {[
              { step: '1', title: 'Configure AI', desc: 'Add an API key or install Ollama for free local AI' },
              { step: '2', title: 'Choose Pair', desc: 'Pick BTC/USDT, ETH/USDT, or any of 8 supported pairs' },
              { step: '3', title: 'Start Agent', desc: 'Paper mode for practice, live mode when you\'re confident' },
              { step: '4', title: 'Watch & Earn', desc: 'AI analyzes markets every 60s and trades on high confidence signals' },
            ].map((s, i) => (
              <div key={i} className="landing-how__step">
                <div className="landing-how__step-num">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <section className="landing-cta">
          <h2>Ready to Start Trading?</h2>
          <p>Paper trading is free and uses real market data. No risk, no API keys required to browse.</p>
          <Button
            type="primary"
            size="large"
            className="landing-btn-gradient landing-btn-gradient--lg"
            icon={<RocketOutlined />}
            onClick={() => navigate('/agent')}
          >
            Launch Trading Agent
          </Button>
        </section>

        <footer className="landing-footer">
          <span className="landing-footer__brand">
            <TrendingUp size={16} /> AlgoTrader AI
          </span>
          <span className="landing-footer__muted">
            Built on FlowDesk · Personal use · Not financial advice
          </span>
        </footer>
      </main>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <Modal
        title={null}
        open={onlineOpen}
        onCancel={() => setOnlineOpen(false)}
        footer={
          <Button type="primary" onClick={() => { setOnlineOpen(false); navigate('/agent') }}>
            Open Agent & Configure
          </Button>
        }
        width={560}
        className="mode-modal"
      >
        <OnlineModeContent />
      </Modal>

      <Modal
        title={null}
        open={offlineOpen}
        onCancel={() => setOfflineOpen(false)}
        footer={
          <Button type="primary" onClick={() => { setOfflineOpen(false); navigate('/agent') }}>
            Open Agent & Configure
          </Button>
        }
        width={560}
        className="mode-modal"
      >
        <OfflineModeContent />
      </Modal>
    </div>
  )
}
