# Blotter: fetch first, then WebSocket

Short reference for how the live workspace loads a snapshot, then opens the stream for deltas.

## When this runs

Only when **`VITE_BLOTTER_WS_URL`** is set. If it is unset, the bootstrap hook stays **`idle`** and does not `GET /orders` for this path.

## Steps (client)

1. **`PrimeBlotterApp.tsx`** — If the WS URL env is present, treat that as “live” mode and call **`useBlotterLiveBootstrap(...)`**.

2. **`useBlotterLiveBootstrap.ts`** (live only) — **`GET /orders`** (same-origin **`/orders`** in dev via Vite proxy, or **`VITE_BLOTTER_HTTP_URL`** if you set it). Parse the JSON, then **`hydrateOrdersFromApi`** on the Zustand store. Set status to **`ready`** on success, **`error`** on failure.

3. **`PrimeBlotterApp.tsx`** again — Build **`enabled = live && bootstrapStatus === 'ready'`**. The socket must not open until **`ready`**.

4. **`useBlotterWebSocketStream.ts`** — When **`enabled`** is true and the URL is non-empty, the effect runs **`adapter.connect()`** → browser **`WebSocket`** (HTTP upgrade to `ws`/`wss`). Incoming frames are parsed and passed to **`ingestEvent`** (deltas).

5. **`useBlotterStore.ts`** — **`hydrateOrdersFromApi`** replaces **`ordersById`** / **`orderIds`** from the HTTP snapshot. **`ingestEvent`** applies stream events on top of that.

## Wire vs roles

- **Client `open`** — handshake finished; adapter can mark connected.  
- **Server `connection`** — Node **`ws`** accepted the upgrade; your stream handler runs there.

## Dev

API port should match Vite’s **`server.proxy`** target (see root **`README.md`** and **`.env.example`**).
