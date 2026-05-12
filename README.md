# AlgoTrader AI — Crypto Trading Agent

An AI-powered cryptocurrency trading agent that uses real-time market data and AI models to make automated trading decisions. Supports **paper trading** (zero risk) and **live trading** (real money on exchanges).

**Live demo:** [algo-chi-five.vercel.app](https://algo-chi-five.vercel.app/)

---

## What It Does

- Fetches real-time crypto prices from exchanges (KuCoin, Bybit, Kraken, Binance — auto-detects best available)
- Computes technical indicators: RSI(14), MACD, Bollinger Bands, SMA(20), EMA(12/26), ATR(14)
- Sends market data to your chosen AI model
- AI returns BUY / SELL / HOLD with confidence score (0–100%)
- Executes trades automatically when confidence > 65%
- Auto stop-loss (-3%) and take-profit (+5%) protect your capital
- Runs every 60 seconds, 24/7

## AI Models Supported

| Mode | Model | Cost | Setup |
|------|-------|------|-------|
| **Offline (Free)** | Ollama (Qwen 3, Gemma, GLM-4, DeepSeek local) | Free | Install Ollama + pull model |
| Online | Claude (Anthropic) | ~$0.003/cycle | API key |
| Online | GPT-4o-mini (OpenAI) | ~$0.001/cycle | API key |
| Online | DeepSeek | ~$0.001/cycle | API key |
| Online | Grok (xAI) | ~$0.002/cycle | API key |

---

## Local Setup (Step by Step)

### Prerequisites

You need **Node.js** (v18 or higher) installed on your computer.

- **Windows:** Download from [nodejs.org](https://nodejs.org/) → run the installer
- **Mac:** `brew install node` or download from [nodejs.org](https://nodejs.org/)
- **Linux:** `sudo apt install nodejs npm` or use [nvm](https://github.com/nvm-sh/nvm)

### Step 1: Clone the repo

Open a terminal (Command Prompt on Windows, Terminal on Mac/Linux):

```bash
git clone https://github.com/nitishmeswal/algo.git
cd algo
```

### Step 2: Install dependencies

```bash
npm install
cd server && npm install && cd ..
```

### Step 3: Start the backend server

```bash
cd server
npm run dev
```

Leave this terminal running. You should see `Server listening on port 8000`.

### Step 4: Start the frontend (new terminal)

Open a **new** terminal window:

```bash
cd algo
npm run dev
```

You should see `Local: http://localhost:5173/`.

### Step 5: Open the app

Go to **http://localhost:5173/agent** in your browser.

### Step 6: Configure your AI model

Click the **Settings** gear icon in the top-right.

**Option A — Free local AI (Ollama):**

1. Download Ollama from [ollama.com/download](https://ollama.com/download)
   - **Windows:** Run the `.exe` installer
   - **Mac:** Download the `.dmg`, drag to Applications
   - **Linux:** `curl -fsSL https://ollama.com/install.sh | sh`
2. Open a terminal and run:
   ```bash
   ollama pull qwen3:8b
   ```
   Wait for the download (~5GB). This only needs to happen once.
3. In the app Settings, select **"Ollama (Local)"** as your model
4. Leave the Ollama URL as default (`http://localhost:11434`)

**Option B — Cloud API key:**

1. Get an API key from any provider:
   - Claude: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - GPT: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - DeepSeek: [platform.deepseek.com](https://platform.deepseek.com)
   - Grok: [console.x.ai](https://console.x.ai)
2. Paste the key in Settings under the corresponding field
3. Click **Save**

### Step 7: Start trading

1. Select your **crypto pair** (BTC/USDT, ETH/USDT, etc.)
2. Select your **AI model**
3. Keep mode as **Paper** (simulated — no real money)
4. Set initial balance (default $10)
5. Click **Start Agent**

The agent will analyze markets every 60 seconds and make trading decisions automatically.

---

## Live Trading (Real Money)

> **WARNING:** Live trading involves real financial risk. The AI can and will make losing trades. Start with the minimum amount.

1. Create a [Binance](https://www.binance.com) account (or use your existing one)
2. Create API keys: Binance → API Management → Create API
   - Enable **Spot Trading** permission
   - **Disable** withdrawal permission (safety)
3. In the app Settings:
   - Paste your **Binance API Key** and **Secret**
   - Switch mode to **Live**
   - Set **Max Position** to your budget
4. Click **Start Agent**

Profits accumulate in your Binance USDT balance. Cash out via Binance → Wallet → Withdraw.

---

## Recommended Ollama Models

For an **RTX 5070 (12GB VRAM)** or similar GPU:

| Model | Pull Command | VRAM | Best For |
|-------|-------------|------|----------|
| **Qwen 3 8B** (default) | `ollama pull qwen3:8b` | ~6GB | Best structured output |
| Gemma 3n E4B | `ollama pull gemma3n:e4b` | ~4GB | Lightweight, fast |
| GLM-4 9B | `ollama pull glm4:9b` | ~7GB | Strong reasoning |
| DeepSeek-R1 8B | `ollama pull deepseek-r1:8b` | ~6GB | Chain-of-thought |
| Llama 3.1 8B | `ollama pull llama3.1:8b` | ~6GB | Reliable workhorse |

You can change the model in Settings → Ollama → Model Name.

---

## Project Structure

| Area | Path |
|------|------|
| Landing page | `client/src/features/landing/` |
| Trading agent dashboard | `client/src/features/crypto-agent/` |
| AI model adapters | `server/src/ai/modelAdapters.ts` |
| Trading agent loop | `server/src/ai/tradingAgent.ts` |
| Exchange connectivity | `server/src/crypto/exchange.ts` |
| Technical indicators | `server/src/crypto/indicators.ts` |
| Paper trading engine | `server/src/crypto/paperEngine.ts` |
| API routes | `server/src/api/cryptoRouter.ts` |
| Shared types | `shared/crypto/types.ts` |

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Ant Design 5
- **Backend:** Node.js, Express, TypeScript
- **Exchange:** CCXT (KuCoin, Bybit, Kraken, Binance)
- **AI:** Anthropic SDK, OpenAI SDK, Ollama API, DeepSeek, Grok
- **Indicators:** Custom RSI, MACD, Bollinger, SMA, EMA, ATR

---

## Troubleshooting

**"Cannot connect to Ollama"**
→ Make sure Ollama is running. Open a terminal and run `ollama serve`.

**"Model not found"**
→ Pull the model first: `ollama pull qwen3:8b`

**"Model X is not available"**
→ Configure the API key in Settings for that model.

**Agent stuck on HOLD**
→ Normal when market signals are mixed. The AI only trades on high-confidence signals (>65%).

**Build errors**
→ Run `npm install` in both the root and `server/` directories.

**Port already in use**
→ Kill the existing process: `npx kill-port 8000` and `npx kill-port 5173`

---

*Built on [FlowDesk](https://github.com/ahadb/flow-desk) · Personal use · Not financial advice*
