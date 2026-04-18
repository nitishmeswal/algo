import { useEffect } from 'react'
import { createMockBlotterStream } from './mockOrderStream'
import { useBlotterStore } from '../store/useBlotterStore'

export type UseBlotterMockStreamOptions = {
  intervalMs?: number
  seed?: number
  maxEvents?: number
}

/**
 * Starts the mock blotter stream on mount and stops on unmount.
 * Passes events into `useBlotterStore` — same wiring you would use for a WebSocket `onmessage`.
 */
export function useBlotterMockStream(options: UseBlotterMockStreamOptions = {}): void {
  const ingestEvent = useBlotterStore((s) => s.ingestEvent)

  useEffect(() => {
    const handle = createMockBlotterStream({
      onEvent: ingestEvent,
      intervalMs: options.intervalMs,
      seed: options.seed,
      maxEvents: options.maxEvents,
    })
    handle.start()
    return () => handle.stop()
  }, [ingestEvent, options.intervalMs, options.seed, options.maxEvents])
}
