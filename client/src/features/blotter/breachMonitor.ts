import type { Order } from './types'

export type BreachMonitorState = {
  aggregatePnl: number
  breached: boolean
  justCrossedDown: boolean
}

export function aggregatePnlFromOrders(orders: readonly Order[]): number {
  return orders.reduce((sum, o) => sum + o.pnl, 0)
}

export function evaluateBreachTransition(
  aggregatePnl: number,
  threshold: number,
  wasBreached: boolean,
): BreachMonitorState {
  const breached = aggregatePnl <= threshold
  return {
    aggregatePnl,
    breached,
    justCrossedDown: breached && !wasBreached,
  }
}
