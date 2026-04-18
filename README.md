# Prime Blotter

Order-blotter UI with live-style mock events, normalized orders in **Zustand**, and **Ant Design** tables (orders + dummy audit trail). Built with **Vite**, **React**, and **TypeScript**.

## Stack

- React 19 + TypeScript + Vite  
- Ant Design 6 (layout, form, tables, dark `ConfigProvider`)  
- Zustand for blotter state and stream ingestion  

## Run it

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run preview`.

## Features covered

- [x] **Typed blotter domain** — `Order`, branded ids, and discriminated `BlotterStreamEvent` shapes shared by mock stream and UI  
- [x] **Single ingestion path** — Zustand store merges all stream-style events via `ingestEvent` (no ad-hoc row patches in components)  
- [x] **Dual entry of orders** — configurable mock emitter plus delayed `submitOrder` API; both emit `order_created` / updates into the store  
- [x] **Blotter table UX** — sort & column filters, virtual scroll, grouped headers, fixed selection + key reference columns, P&L column  
- [x] **Order ticket & layout** — Ant `Form` + validation, collapsible order column (preference persisted in `localStorage`), stats strip  

## Production hardening (todo)

- [ ] **Real services** — authenticated HTTPS APIs for submit and streaming; server-side validation and persistence  
- [ ] **Automated tests** — unit tests for event → store reducer; smoke / e2e for submit and table interactions  
- [ ] **Observability** — client error tracking (e.g. Sentry), RUM / Web Vitals, correlation ids across client and API  
- [ ] **Delivery & config** — CI pipeline, staged envs, secrets outside the repo, versioned releases  
- [ ] **Hardening pass** — accessibility audit, CSP / security headers, rate limits & idempotency on submit, load testing for large blotters  

## AI (todo)

**Approach:** keep **deterministic facts** from the blotter (`src/features/insights/deterministicInsights.ts`) as the source of truth; add **LLM / NLP only as a prose layer** on top (or reject outputs that don’t align with those facts).

- [ ] **Insight cards** — optional AI rephrase of the two card bullet lists; inputs = same aggregates used today (exposure + lifecycle)  
- [ ] **Summarize N rows** — call an API with `selectionSummaryFacts`-shaped JSON; return NL summary + optional Q&A; never invent rows outside the selection payload  
- [ ] **End-of-day** — scheduled or on-demand report: fill section 4 with an executive summary from `eodSchemaFacts`; add export (PDF / email) when backend exists  
- [ ] **NLP command bar** — natural language → table filters / navigation; narrow intent + confirm before mutating state  
- [ ] **Guardrails** — mock-data disclaimers in UI, rate limits, logging of prompts/responses, post-check model output against structured facts  

## Where things live

| Area | Path |
|------|------|
| App shell (header, form, cards) | `src/App.tsx`, `src/App.css` |
| Mock stream hook | `src/features/blotter/realtime/useBlotterMockStream.ts` |
| Stream + event types | `src/features/blotter/types.ts`, `src/features/blotter/realtime/mockOrderStream.ts` |
| Store | `src/features/blotter/store/useBlotterStore.ts` |
| Order table | `src/features/table/BlotterTable.tsx` |
| Audit table (static rows) | `src/features/table/AuditTrailTable.tsx` |
| Deterministic insights + modals (AI hooks later) | `src/features/insights/deterministicInsights.ts`, `src/features/insights/InsightModals.tsx` |
