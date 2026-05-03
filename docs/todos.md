# Major TODOs

Cross-cutting work that does not belong in the short README checklist.

## Audit trail stays in sync with live blotter

**Problem:** The audit panel uses `useOrderAudit`, which **caches** `GET /orders/:id/audit` per `orderId`. New rows written by the stream / projector after the fetch are **not visible** until the user changes selection or something calls **`invalidate(orderId)`**.

**Direction (pick one or combine):**

- On **`ingestEvent`** in the blotter store (or in a small subscriber used by `PrimeBlotterApp` / `AuditTrailTable`), when the event’s **`orderId`** matches the **currently focused** order for the audit panel, call **`invalidate(thatId)`** so the next render refetches audit (simplest correct behavior; watch request churn).
- Alternatively: **append** new audit-shaped payloads from the stream client-side when the backend also emits enough detail (only if stream and DB stay aligned—harder).
- Optionally debounce refetches (e.g. 300–500 ms) if many updates arrive in one burst.

**Related polish (optional):** dedicated **drawer/modal** for a larger audit view; **omit heartbeats** in the API query; **nested rows** for `patch` / field-level diffs.

---

Smaller items stay in the root [README.md](../README.md) “Main todos” section unless they grow into cross-cutting themes like this one.
