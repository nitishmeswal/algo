import { orderId, type OrderId } from './types'

const HEX = '0123456789abcdef'

function randomHex(rnd: () => number, length: number): string {
  let s = ''
  for (let i = 0; i < length; i++) s += HEX[Math.floor(rnd() * 16)]!
  return s
}

/**
 * Venue-style order id: FD-YYYYMMDD + 8 hex (reads like a production routing key).
 */
export function createOrderId(rnd: () => number): OrderId {
  const d = new Date()
  const ymd =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  return orderId(`FD-${ymd}-${randomHex(rnd, 8)}`)
}

/**
 * Client / ClOrdID-style id (UUID layout, lowercase hex).
 */
export function createClientOrderId(rnd: () => number): string {
  const h = (n: number) => randomHex(rnd, n)
  return `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`
}
