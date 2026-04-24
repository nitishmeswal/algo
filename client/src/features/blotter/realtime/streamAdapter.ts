import type { BlotterStreamEvent } from '../types'

export type BlotterStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type BlotterStreamAdapterConfig = {
  onEvent: (event: BlotterStreamEvent) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: BlotterStreamStatus) => void
}

export interface BlotterStreamAdapter {
  connect: () => void | Promise<void>
  disconnect: () => void | Promise<void>
  isConnected: () => boolean
}

export type BlotterStreamAdapterFactory = (
  config: BlotterStreamAdapterConfig,
) => BlotterStreamAdapter
