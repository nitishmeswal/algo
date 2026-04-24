import { useEffect } from 'react'
import { useBlotterStore } from '../store/useBlotterStore'
import { createBlotterWebSocketAdapter } from './blotterWebSocketAdapter'

export type UseBlotterWebSocketStreamOptions = {
  /** Full `ws:` or `wss:` URL (e.g. `import.meta.env.VITE_BLOTTER_WS_URL`). */
  url: string
  /** When false, the effect is a no-op (use with env gating from the shell). */
  enabled?: boolean
}

/**
 * Opens a WebSocket to the blotter stream server on mount, forwards valid events to
 * {@link useBlotterStore}'s `ingestEvent`, and closes on unmount.
 */
export function useBlotterWebSocketStream(options: UseBlotterWebSocketStreamOptions): void {
  const { url, enabled = true } = options
  const ingestEvent = useBlotterStore((s) => s.ingestEvent)

  useEffect(() => {
    if (!enabled || !url.trim()) {
      return
    }

    const adapter = createBlotterWebSocketAdapter({
      url: url.trim(),
      onEvent: ingestEvent,
      onError: (err) => {
        console.warn('[blotter-ws]', err)
      },
    })

    adapter.connect()
    return () => {
      adapter.disconnect()
    }
  }, [enabled, ingestEvent, url])
}
