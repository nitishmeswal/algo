/**
 * Insight layer — v1 is **fully deterministic** from blotter `Order[]`.
 *
 * **Where AI can plug in later (same facts, different prose):**
 * - **Card bullets** — optional LLM to soften/rephrase the two bullet lists; keep numbers from these functions.
 * - **Summarize N rows** — optional NL paragraph or Q&A on top of `selectionSummaryFacts`; never invent rows not in `selectedIds`.
 * - **End-of-day** — optional executive summary per section; `eodSchemaFacts` is the structured contract for prompts/PDF.
 *
 * **Pivot pattern:** return `{ facts, displayLines }` where `displayLines` is template text today; replace generation of
 * `displayLines` with an API call that must cite `facts` (or reject) before ship to prod.
 */
import type { Order } from '../blotter/types'

export type InsightCardModel = {
  title: string
  bullets: string[]
}

function topSymbols(orders: Order[], n: number): string[] {
  const by = new Map<string, number>()
  for (const o of orders) {
    by.set(o.symbol, (by.get(o.symbol) ?? 0) + 1)
  }
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([s]) => s)
}

/** Card 1 — exposure / symbol concentration (deterministic). */
export function cardInsightExposure(orders: Order[]): InsightCardModel {
  if (orders.length === 0) {
    return {
      title: 'Exposure snapshot',
      bullets: ['No orders in store yet.', 'Submit or wait for stream events to populate the blotter.'],
    }
  }
  const symbols = topSymbols(orders, 4)
  const buys = orders.filter((o) => o.side === 'buy').length
  const sells = orders.length - buys
  return {
    title: 'Exposure snapshot',
    bullets: [
      `Largest symbols by row count: ${symbols.join(', ') || '—'}.`,
      `Side mix: ${buys} buy / ${sells} sell rows (mock blotter, notional not weighted).`,
    ],
  }
}

/** Card 2 — lifecycle / workflow (deterministic). */
export function cardInsightLifecycle(orders: Order[]): InsightCardModel {
  if (orders.length === 0) {
    return {
      title: 'Workflow pulse',
      bullets: ['No lifecycle data until orders exist.', 'Heartbeats still reflect stream health when connected.'],
    }
  }
  const open = orders.filter((o) => !['filled', 'cancelled', 'rejected'].includes(o.status)).length
  const terminal = orders.length - open
  const pnlAgg = orders.reduce((s, o) => s + o.pnl, 0)
  return {
    title: 'Workflow pulse',
    bullets: [
      `${open} working / ${terminal} terminal rows (filled, cancelled, or rejected).`,
      `Aggregate P&L across visible rows: ${pnlAgg.toFixed(2)} USD (mock).`,
    ],
  }
}

export type SelectionSummaryModel = {
  count: number
  bullets: string[]
}

/** Facts for “Summarize N rows” — selection modal uses this; LLM can consume the same structure later. */
export function selectionSummaryFacts(orders: Order[], selectedIds: readonly string[]): SelectionSummaryModel {
  const set = new Set(selectedIds)
  const rows = orders.filter((o) => set.has(o.id))
  const n = rows.length
  if (n === 0) {
    return { count: 0, bullets: ['Select one or more rows in the blotter, then open this summary again.'] }
  }
  const symbols = [...new Set(rows.map((r) => r.symbol))].sort()
  const avgQty = rows.reduce((s, r) => s + r.quantity, 0) / n
  const pnl = rows.reduce((s, r) => s + r.pnl, 0)
  return {
    count: n,
    bullets: [
      `Symbols touched: ${symbols.join(', ') || '—'}.`,
      `Average quantity (simple mean): ${avgQty.toFixed(0)}.`,
      `Combined P&L (sum): ${pnl.toFixed(2)} USD.`,
    ],
  }
}

export type EodSectionModel = {
  heading: string
  lines: string[]
}

/** Structured EOD-style report (deterministic); LLM can add a prose “Executive summary” section using this as context. */
export function eodSchemaFacts(orders: Order[]): EodSectionModel[] {
  const n = orders.length
  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})
  const statusLines = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
  return [
    {
      heading: '1. Headline counts',
      lines: [
        `Total orders in snapshot: ${n}.`,
        n > 0 ? `Status distribution: ${statusLines.join('; ')}.` : 'No rows — run stream or submit orders.',
      ],
    },
    {
      heading: '2. Venue & route',
      lines:
        orders.length === 0
          ? ['No venue data in snapshot.']
          : Array.from(new Set(orders.map((o) => o.venue ?? '—'))).map((v) => `Venue seen: ${v}`),
    },
    {
      heading: '3. P&L snapshot (mock)',
      lines: [
        `Sum of row P&L: ${orders.reduce((s, o) => s + o.pnl, 0).toFixed(2)} USD.`,
        'Replace with realized/unrealized splits when backed by a ledger.',
      ],
    },
    {
      heading: '4. Placeholder for AI executive summary',
      lines: [
        'Wire an LLM here later: input = JSON of sections 1–3; output = short narrative + disclaimers.',
        'Until then, this block stays deterministic.',
      ],
    },
  ]
}
