# FlowDesk

**FlowDesk** is aimed at becoming a **modern order-management and trading workspace**: one place to watch **live order flow**, manage lifecycle (submit, amend, cancel), see **P&L and exposure**, drill into a **field-level audit trail**, and layer **AI and natural language** on top—always anchored to structured, verifiable facts from the book, not hand-wavy guesses.

![FlowDesk landing page](screens/home-page.png)

![FlowDesk workspace — blotter, order entry, stats, audit trail](screens/blotter.png)

**Where this repo is headed**

- **Real connectivity** — authenticated APIs and WebSockets for orders, fills, and reference data; server-side validation, idempotent submits, and durable history.  
- **Desk-grade UX** — fast virtualized blotters, saved layouts, alerts, and workflows that match how PMs and traders actually work.  
- **Compliance and ops** — immutable-style audit narratives, exportable trails, and clear separation between **deterministic metrics** and **optional LLM prose**.  
- **AI as an assistant** — row summaries, EOD narratives, and NLP filters that consume **typed facts** from the store (summaries, selections, aggregates) so outputs stay checkable against the grid.

**What ships today**

A **demo workspace** with a marketing **landing page**, a **dark Ant Design** shell, a **typed blotter domain** in **Zustand**, mock **real-time-style** stream events, virtualized **tables**, **order entry**, **stats / NLP filter UI**, and an **order → event audit tree** wired to the same ingestion path—built with **Vite**, **React**, and **TypeScript**.

## Stack

- React 19 + TypeScript + Vite  
- Ant Design 6 (layout, form, tables, dark `ConfigProvider`)  
- Zustand for blotter state and stream ingestion  

## Run it

### Client (Vite + React)

```bash
npm install
npm run dev
```

Open `/` for the landing experience and `/app` for the FlowDesk workspace.

Other client/root scripts:
- `npm run build`
- `npm run lint`
- `npm run preview`

The React app lives under **`client/`** (`client/src`, `client/index.html`, `client/public`). Builds emit to **`dist/`** at the repository root.

### Server (Express + ws)

Express + **`ws`** in **`server/`**: **`GET /health`**, WebSocket **`/blotter-stream`**, and one JSON text frame per message using the same discriminated event shape the client ingests (`order_created`, `order_updated`, `order_cancelled`, `order_rejected`, `heartbeat`).

Current behavior in `server/src/index.ts`:

- Per-connection state (`sequence`, order counter, in-memory live order map)
- Immediate `order_created` on connect
- Continuous interval-based mock lifecycle events (create/update/reject/cancel)
- Independent heartbeat tick every 4s
- Interval cleanup on socket close

`GET /blotter-stream` returns a JSON hint (streams are **WebSocket**, not a normal HTTP page).

Dev proxy: with client `npm run dev`, Vite proxies **`/blotter-stream`** to **`127.0.0.1:3001`**.  
Server default port is **`8000`**, so set `PORT=3001` when using the proxy target.

```bash
cd server && npm install
# start server
npm run dev
# if using Vite proxy target from vite.config.ts:
# PORT=3001 npm run dev
# other terminal:
curl http://localhost:3001/health
# optional: npx wscat -c ws://localhost:3001/blotter-stream
```

From the repo root you can run **`npm run dev:server`** (same as running `npm run dev` inside `server/`). Override port with **`PORT`** (for example `PORT=3001 npm run dev:server`).

To drive the workspace from the stream server instead of the in-browser mock, set **`VITE_BLOTTER_WS_URL`** (see [`.env.example`](.env.example)), e.g. `ws://127.0.0.1:3001/blotter-stream`, or use the Vite dev proxy with **`ws://127.0.0.1:5173/blotter-stream`** while **`npm run dev`** and **`npm run dev:server`** are both running.

## Features covered

- [x] **Typed blotter domain** — `Order`, branded ids, and discriminated `BlotterStreamEvent` shapes shared by mock stream and UI  
- [x] **Single ingestion path** — Zustand store merges all stream-style events via `ingestEvent` (no ad-hoc row patches in components)  
- [x] **Dual entry of orders** — configurable mock emitter plus delayed `submitOrder` API; both emit `order_created` / updates into the store  
- [x] **Blotter table UX** — sort & column filters, virtual scroll, grouped headers, fixed selection + key reference columns, P&L column  
- [x] **Order ticket & layout** — Ant `Form` + validation, collapsible order column (preference persisted in `localStorage`), stats strip  
- [ ] **Audit trail (mocked for now)** — tree-table style audit surface for hierarchy previews (mock tree-table UI) plus stream-derived audit domain in store/mappers  

## Main todos

- [x] Enrich mock stream by reusing the same data types and event shapes as the websocket/backend feed.
- [ ] Configure backend data layer (Postgres, connection management, migrations baseline).
- [ ] Configure API layer endpoints: `GET /orders`, `GET /orders/:id/audit`.
- [ ] Add Postgres tables for audit and audit events (initial schema).
- [ ] Implement audit trail tree view from API data (shape, transform to tree, render).
- [ ] Configure master/detail view for order list and selected order context.

## Production hardening (todo)

- [ ] **Real services** — authenticated HTTPS APIs for submit and streaming; server-side validation and persistence  
- [ ] **Automated tests** — unit tests for event → store reducer; smoke / e2e for submit and table interactions  
- [ ] **Observability** — client error tracking (e.g. Sentry), RUM / Web Vitals, correlation ids across client and API  
- [ ] **Delivery & config** — CI pipeline, staged envs, secrets outside the repo, versioned releases  
- [ ] **Hardening pass** — accessibility audit, CSP / security headers, rate limits & idempotency on submit, load testing for large blotters  

## AI (todo)

**Approach:** keep **deterministic facts** from the blotter (`client/src/features/insights/deterministicInsights.ts`) as the source of truth; add **LLM / NLP only as a prose layer** on top (or reject outputs that don’t align with those facts).

- [ ] **Insight cards** — optional AI rephrase of the two card bullet lists; inputs = same aggregates used today (exposure + lifecycle)  
- [ ] **Summarize N rows** — call an API with `selectionSummaryFacts`-shaped JSON; return NL summary + optional Q&A; never invent rows outside the selection payload  
- [ ] **End-of-day** — scheduled or on-demand report: fill section 4 with an executive summary from `eodSchemaFacts`; add export (PDF / email) when backend exists  
- [ ] **NLP command bar** — natural language → table filters / navigation; narrow intent + confirm before mutating state  
- [ ] **Guardrails** — mock-data disclaimers in UI, rate limits, logging of prompts/responses, post-check model output against structured facts  

## Where things live

| Area | Path |
|------|------|
| Router (landing vs workspace) | `client/src/App.tsx` |
| Landing page | `client/src/features/landing/HomePage.tsx`, `HomePage.css` |
| Workspace shell (header, stats, form, cards) | `client/src/PrimeBlotterApp.tsx`, `client/src/App.css` |
| Mock stream hook | `client/src/features/blotter/realtime/useBlotterMockStream.ts` |
| Stream + event types | `client/src/features/blotter/types.ts`, `client/src/features/blotter/realtime/mockOrderStream.ts` |
| Store | `client/src/features/blotter/store/useBlotterStore.ts` |
| Order table | `client/src/features/table/BlotterTable.tsx` |
| Audit trail (tree table + audit domain) | `client/src/features/table/AuditTrailTable.tsx`, `client/src/features/blotter/audit/` |
| Deterministic insights + modals (AI hooks later) | `client/src/features/insights/deterministicInsights.ts`, `client/src/features/insights/InsightModals.tsx` |
| Stream server (Express + ws, interval mock lifecycle stream) | `server/src/index.ts` |
| WebSocket client adapter + hook | `client/src/features/blotter/realtime/blotterWebSocketAdapter.ts`, `useBlotterWebSocketStream.ts` |
