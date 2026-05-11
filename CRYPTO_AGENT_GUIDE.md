# Crypto AI Trading Agent — Setup & Usage Guide

## What This Is

An AI-powered cryptocurrency trading agent built on top of FlowDesk. It uses real-time market data from Binance and AI models (Claude, GPT, DeepSeek, Grok) to make automated trading decisions.

**Two modes:**
- **Paper Trading** — Uses real market prices but simulated money. Zero risk. Start here.
- **Live Trading** — Executes real trades on Binance with your actual funds.

---

## Quick Start (Paper Trading — 2 minutes)

### 1. Start the server

```bash
cd server && npm install && npm run dev
```

### 2. Start the client (in another terminal)

```bash
npm install && npm run dev
```

### 3. Open the app

Go to `http://localhost:5173/agent` in your browser.

### 4. Configure your AI model

Click **Settings** (gear icon) and enter at least one API key:
- **Claude** (recommended): Get a key at https://console.anthropic.com/settings/keys
- **GPT**: Get a key at https://platform.openai.com/api-keys
- **DeepSeek**: Get a key at https://platform.deepseek.com
- **Grok**: Get a key at https://console.x.ai

Click **Save**.

### 5. Start the agent

1. Choose your **symbol** (BTC/USDT, ETH/USDT, etc.)
2. Select your **AI model** (whichever you configured)
3. Keep mode as **Paper**
4. Set **initial balance** (default $10)
5. Click **Start Agent**

The agent will:
- Fetch real-time candle data from Binance
- Compute technical indicators (RSI, MACD, Bollinger Bands, etc.)
- Send market context to the AI model
- Receive BUY/SELL/HOLD decision with confidence score
- Execute paper trades when confidence > 65%
- Auto stop-loss at -3% and take-profit at +5% (configurable)

---

## Live Trading Setup (Real Money)

> **WARNING**: Live trading involves real financial risk. Start with the minimum amount ($5). The AI can and will make losing trades.

### 1. Create a Binance account

1. Go to https://www.binance.com and sign up
2. Complete KYC verification
3. Deposit USDT (minimum ~$5)

### 2. Create API keys

1. Go to https://www.binance.com/en/my/settings/api-management
2. Click **Create API** → **System Generated**
3. Name it "FlowDesk Agent"
4. Enable **Spot Trading** permission
5. **Disable** withdrawal permission (for safety)
6. Copy the **API Key** and **Secret Key**

### 3. Configure in the app

1. Open Settings in the agent dashboard
2. Paste your **Binance API Key** and **Secret**
3. Switch mode to **Live**
4. Set **Max Position** to your budget (e.g., $5)
5. Click **Start Agent**

### 4. How profits work

- Your trades execute directly on Binance
- Profits stay in your Binance USDT balance
- To cash out: Binance → Withdraw → Your bank/wallet
- The agent never has withdrawal permissions

---

## How the AI Decision-Making Works

Each cycle (default: every 60 seconds):

1. **Fetch Data**: Gets last 100 candles (5-min) from Binance
2. **Compute Indicators**:
   - RSI(14) — momentum oscillator
   - MACD — trend direction
   - Bollinger Bands — volatility
   - SMA(20), EMA(12/26) — moving averages
   - ATR(14) — volatility
   - Volume analysis
3. **AI Analysis**: Sends all data to your chosen model with trading rules
4. **Decision**: Model returns BUY/SELL/HOLD + confidence (0-100%)
5. **Execution**: Only trades when confidence > 65%
6. **Risk Management**: Auto stop-loss and take-profit protect your capital

### AI Rules

- Conservative approach — only trades on high-confidence signals
- Looks for: oversold RSI, bullish/bearish MACD crossovers, Bollinger Band touches
- Never risks more than the allocated budget
- Won't buy if already holding a position
- Triggers auto-sell on stop-loss (-3%) or take-profit (+5%)

---

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| Max Position (USDT) | $5 | Maximum trade size |
| Stop Loss % | 3% | Auto-sell if position drops this much |
| Take Profit % | 5% | Auto-sell if position gains this much |
| Trade Interval | 60s | How often the agent analyzes and trades |
| Night Mode | Off | When on, agent continues trading 24/7 |

---

## Multi-Model Comparison

You can run the agent with different AI models to compare performance:

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| Claude | Medium | ~$0.003/cycle | Nuanced analysis |
| GPT-4o-mini | Fast | ~$0.001/cycle | Budget-friendly |
| DeepSeek | Fast | ~$0.001/cycle | Cost-effective |
| Grok | Fast | ~$0.002/cycle | Real-time market context |

To test multiple models:
1. Run agent with Model A for N cycles
2. Stop, note the P&L
3. Reset portfolio
4. Run agent with Model B for N cycles
5. Compare results

---

## Cash-Out Flow

1. Profits accumulate in your Binance USDT balance
2. Stop the agent when you want to withdraw
3. In Binance:
   - Go to **Wallet** → **Fiat and Spot**
   - Click **Withdraw** on USDT
   - Choose your withdrawal method:
     - **Bank transfer** (ACH/wire)
     - **Crypto withdrawal** to external wallet
     - **P2P trading** to sell for local currency
4. Funds arrive in your account (timing depends on method)

---

## Troubleshooting

**"Model X is not available"**
→ Configure the API key in Settings

**"Insufficient balance"**
→ Reset portfolio (paper) or deposit more USDT (live)

**Agent stuck on HOLD**
→ Normal when market signals are mixed. Lower confidence threshold in the trading system.

**Price not updating**
→ Check your internet connection. Binance public API requires no auth.

**Build errors**
→ Run `npm install` in both root and `server/` directories.

---

## Architecture

```
Client (React + Vite)         Server (Express + Node)
  /agent                        /crypto/price/:symbol    → Binance public API
  CryptoAgentPage               /crypto/candles/:symbol  → Binance OHLCV
  ├── Live chart (SVG)          /crypto/indicators/:sym  → Computed indicators
  ├── Agent controls            /crypto/agent/start      → Start AI agent loop
  ├── Portfolio stats           /crypto/agent/stop       → Stop agent
  ├── AI reasoning panel        /crypto/agent/state      → Current state + decisions
  ├── Technical indicators      /crypto/portfolio        → Paper portfolio
  ├── Trade history             /crypto/settings         → Risk & API config
  └── Settings drawer
```

**Key files:**
- `server/src/ai/tradingAgent.ts` — Main agent loop
- `server/src/ai/modelAdapters.ts` — Claude/GPT/DeepSeek/Grok adapters
- `server/src/crypto/exchange.ts` — Binance API via ccxt
- `server/src/crypto/indicators.ts` — RSI, MACD, Bollinger, SMA, EMA, ATR
- `server/src/crypto/paperEngine.ts` — Simulated trading engine
- `client/src/features/crypto-agent/` — Full dashboard UI
