import { z } from 'zod'

/** POST /orders body — shared by REST router and trade-booking agent `book_trade`. */
export const submitOrderBodySchema = z
  .object({
    clientOrderId: z.string().trim().min(1).max(64).optional(),
    symbol: z.string().trim().min(1).max(16),
    side: z.enum(['buy', 'sell']),
    quantity: z.number().int().positive(),
    orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']).optional(),
    limitPrice: z.number().finite().positive().optional(),
    stopPrice: z.number().finite().positive().optional(),
    timeInForce: z.enum(['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close']),
    expireAt: z.string().trim().min(1).optional(),
    venue: z.string().trim().min(1).max(64).optional(),
    account: z.string().trim().min(1).max(64).optional(),
    counterparty: z.string().trim().min(1).max(64).optional(),
    strategyTag: z.string().trim().max(48).optional(),
    displayQuantity: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    const ot = v.orderType ?? 'limit'
    const requiresLimit = ot === 'limit' || ot === 'stop_limit'
    if (requiresLimit && v.limitPrice == null) {
      ctx.addIssue({ code: 'custom', message: 'limitPrice is required for limit/stop_limit', path: ['limitPrice'] })
    }
    const requiresStop = ot === 'stop' || ot === 'stop_limit'
    if (requiresStop && v.stopPrice == null) {
      ctx.addIssue({ code: 'custom', message: 'stopPrice is required for stop/stop_limit', path: ['stopPrice'] })
    }
    if (v.timeInForce === 'gtd') {
      if (!v.expireAt) {
        ctx.addIssue({ code: 'custom', message: 'expireAt is required when timeInForce is gtd', path: ['expireAt'] })
      } else if (Number.isNaN(Date.parse(v.expireAt))) {
        ctx.addIssue({ code: 'custom', message: 'expireAt must be a valid datetime', path: ['expireAt'] })
      }
    }
    if (v.displayQuantity != null && v.displayQuantity > v.quantity) {
      ctx.addIssue({ code: 'custom', message: 'displayQuantity cannot exceed quantity', path: ['displayQuantity'] })
    }
  })

export type SubmitOrderBody = z.infer<typeof submitOrderBodySchema>
