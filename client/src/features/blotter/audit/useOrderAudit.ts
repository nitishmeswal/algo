import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchOrderAudit, type OrderAuditApiResponse } from '../api/orderAuditApi'

export type OrderAuditStatus = 'idle' | 'loading' | 'ready' | 'error'

export type UseOrderAuditResult = {
  status: OrderAuditStatus
  data: OrderAuditApiResponse | null
  error: string | null
  /** Drop cached response for one id, or clear entire cache when omitted. */
  invalidate: (orderId?: string) => void
}

/**
 * Fetches persisted audit rows for one order (`GET /orders/:id/audit`).
 * When `orderId` is null, state is idle. Reuses an in-memory cache when revisiting the same id in a session.
 */
export function useOrderAudit(orderId: string | null): UseOrderAuditResult {
  const cacheRef = useRef(new Map<string, OrderAuditApiResponse>())
  const [status, setStatus] = useState<OrderAuditStatus>('idle')
  const [data, setData] = useState<OrderAuditApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const invalidate = useCallback((id?: string) => {
    if (id) cacheRef.current.delete(id)
    else cacheRef.current.clear()
  }, [])

  useEffect(() => {
    if (!orderId) {
      setStatus('idle')
      setData(null)
      setError(null)
      return
    }

    const cached = cacheRef.current.get(orderId)
    if (cached) {
      setData(cached)
      setStatus('ready')
      setError(null)
      return
    }

    let cancelled = false
    setStatus('loading')
    setData(null)
    setError(null)

    void fetchOrderAudit(orderId)
      .then((res) => {
        if (cancelled) return
        cacheRef.current.set(orderId, res)
        setData(res)
        setStatus('ready')
        setError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setData(null)
        setStatus('error')
        setError(e instanceof Error ? e.message : String(e))
      })

    return () => {
      cancelled = true
    }
  }, [orderId])

  return { status, data, error, invalidate }
}
