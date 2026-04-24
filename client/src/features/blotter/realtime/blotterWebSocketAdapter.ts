import { isBlotterStreamEvent } from '../types'
import type { BlotterStreamAdapter, BlotterStreamAdapterConfig, BlotterStreamStatus } from './streamAdapter'

export type BlotterWebSocketAdapterOptions = BlotterStreamAdapterConfig & {
  url: string
}

/**
 * WebSocket client for JSON text frames, one {@link BlotterStreamEvent} per message.
 * Implements {@link BlotterStreamAdapter} for the same ingest path as the mock stream.
 */
export function createBlotterWebSocketAdapter(options: BlotterWebSocketAdapterOptions): BlotterStreamAdapter {
  let socket: WebSocket | null = null

  const setStatus = (status: BlotterStreamStatus) => {
    options.onStatusChange?.(status)
  }

  return {
    connect() {
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        return
      }

      setStatus('connecting')

      let ws: WebSocket
      try {
        ws = new WebSocket(options.url)
      } catch (e) {
        setStatus('error')
        options.onError?.(e)
        return
      }

      socket = ws

      ws.onopen = () => {
        setStatus('connected')
      }

      ws.onmessage = (ev) => {
        try {
          const raw: unknown = JSON.parse(String(ev.data))
          if (isBlotterStreamEvent(raw)) {
            options.onEvent(raw)
          } else {
            options.onError?.(new Error('Invalid blotter stream message shape'))
          }
        } catch (e) {
          options.onError?.(e)
        }
      }

      ws.onerror = () => {
        setStatus('error')
        options.onError?.(new Error('WebSocket transport error'))
      }

      ws.onclose = () => {
        if (socket === ws) {
          socket = null
        }
        setStatus('disconnected')
      }
    },

    disconnect() {
      if (!socket) {
        setStatus('disconnected')
        return
      }
      const ws = socket
      socket = null
      ws.close()
      setStatus('disconnected')
    },

    isConnected() {
      return socket !== null && socket.readyState === WebSocket.OPEN
    },
  }
}
