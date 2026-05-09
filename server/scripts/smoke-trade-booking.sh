#!/usr/bin/env bash
# Smoke POST /nlp/trade-booking and streaming /nlp/trade-booking/stream (server on BASE, default 8000).
# Without OPENAI_API_KEY the server returns 503 JSON (non-stream) or 503 JSON before SSE on stream route.

set -euo pipefail
BASE="${BASE:-http://127.0.0.1:8000}"

echo "--- JSON ---"
curl -sS -X POST "${BASE}/nlp/trade-booking" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Buy 10 AAPL limit 195"}' | head -c 2000
echo
echo "--- SSE (first 4K) ---"
curl -sS -N -X POST "${BASE}/nlp/trade-booking/stream" \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"text":"Buy 10 AAPL limit 195"}' | head -c 4000
echo
