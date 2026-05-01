# Roadmap

Longer-term and cross-cutting work for FlowDesk. The root [**README**](../README.md) stays focused on stack, run instructions, and where code lives.

---

## Production hardening

- [ ] **Real services** — authenticated HTTPS APIs for submit and streaming; server-side validation and persistence  
- [ ] **Automated tests** — unit tests for event → store reducer; smoke / e2e for submit and table interactions  
- [ ] **Observability** — client error tracking (e.g. Sentry), RUM / Web Vitals, correlation ids across client and API  
- [ ] **Delivery & config** — CI pipeline, staged envs, secrets outside the repo, versioned releases  
- [ ] **Hardening pass** — accessibility audit, CSP / security headers, rate limits & idempotency on submit, load testing for large blotters  

---

## AI (assistant layer)

**Approach:** keep **deterministic facts** from the blotter (`client/src/features/insights/deterministicInsights.ts`) as the source of truth; add **LLM / NLP only as a prose layer** on top (or reject outputs that don’t align with those facts).

- [ ] **Insight cards** — optional AI rephrase of the two card bullet lists; inputs = same aggregates used today (exposure + lifecycle)  
- [ ] **Summarize N rows** — call an API with `selectionSummaryFacts`-shaped JSON; return NL summary + optional Q&A; never invent rows outside the selection payload  
- [ ] **End-of-day** — scheduled or on-demand report: fill section 4 with an executive summary from `eodSchemaFacts`; add export (PDF / email) when backend exists  
- [ ] **NLP command bar** — natural language → table filters / navigation; narrow intent + confirm before mutating state  
- [ ] **Guardrails** — mock-data disclaimers in UI, rate limits, logging of prompts/responses, post-check model output against structured facts  
