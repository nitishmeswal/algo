import { useEffect } from 'react'
import { createMockBlotterStream } from './mockOrderStream'
import { useBlotterStore } from '../store/useBlotterStore'

export type UseBlotterMockStreamOptions = {
  intervalMs?: number
  seed?: number
  maxEvents?: number
  /** When false, no mock stream runs (use when a WebSocket feed is active). */
  enabled?: boolean
}

/**
 * Starts the mock blotter stream on mount and stops on unmount.
 * Passes events into `useBlotterStore` — same wiring you would use for a WebSocket `onmessage`.
 */
export function useBlotterMockStream(options: UseBlotterMockStreamOptions = {}): void {
  const { enabled = true, intervalMs, seed, maxEvents } = options
  const ingestEvent = useBlotterStore((s) => s.ingestEvent)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const handle = createMockBlotterStream({
      onEvent: ingestEvent,
      intervalMs,
      seed,
      maxEvents,
    })
    handle.start()
    return () => handle.stop()
  }, [enabled, ingestEvent, intervalMs, seed, maxEvents])
}
