import { z } from 'zod'

export const tradeBookingDefaultsSchema = z.object({
  account: z.string().trim().min(1).max(64).optional(),
  counterparty: z.string().trim().min(1).max(64).optional(),
  venue: z.string().trim().min(1).max(64).optional(),
  timeInForce: z.enum(['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close']).optional(),
})

export type TradeBookingDefaults = z.infer<typeof tradeBookingDefaultsSchema>

export const tradeBookingRequestSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  defaults: tradeBookingDefaultsSchema.optional(),
})

export type TradeBookingRequest = z.infer<typeof tradeBookingRequestSchema>

/** Structured intent from NL (pre–submit-order validation). */
export const parsedTradeIntentSchema = z.object({
  symbol: z.string().trim().min(1).max(16),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().int().positive(),
  orderType: z.enum(['market', 'limit', 'stop', 'stop_limit']).optional(),
  limitPrice: z.number().finite().positive().optional(),
  stopPrice: z.number().finite().positive().optional(),
  timeInForce: z.enum(['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close']).optional(),
  venue: z.string().trim().min(1).max(64).optional(),
  account: z.string().trim().min(1).max(64).optional(),
  counterparty: z.string().trim().min(1).max(64).optional(),
  strategyTag: z.string().trim().max(48).optional(),
  displayQuantity: z.number().int().positive().optional(),
  expireAt: z.string().trim().min(1).optional(),
})

export type ParsedTradeIntent = z.infer<typeof parsedTradeIntentSchema>

export const tradeBookingToolNames = [
  'parse_trade_intent',
  'validate_symbol',
  'validate_risk',
  'validate_price',
  'book_trade',
] as const

export type TradeBookingToolName = (typeof tradeBookingToolNames)[number]

export const stepStatusSchema = z.enum(['pending', 'running', 'ok', 'fail'])

export type StepStatus = z.infer<typeof stepStatusSchema>

export const stepLogSchema = z.object({
  id: z.number().int().min(1).max(5),
  tool: z.string(),
  status: stepStatusSchema,
  detail: z.string().optional(),
  at: z.string(),
})

export type StepLog = z.infer<typeof stepLogSchema>

/** Order row as returned by POST /orders — matches `orderRowToJson` on the server. */
export const tradeBookingOrderDtoSchema = z.object({
  id: z.string(),
  clientOrderId: z.string(),
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  quantity: z.number(),
  orderType: z.string().optional(),
  limitPrice: z.number().optional(),
  stopPrice: z.number().optional(),
  expireAt: z.string().optional(),
  strategyTag: z.string().optional(),
  displayQuantity: z.number().optional(),
  filledQuantity: z.number(),
  averageFillPrice: z.number().optional(),
  pnl: z.number(),
  status: z.string(),
  timeInForce: z.string(),
  venue: z.string(),
  account: z.string(),
  counterparty: z.string(),
  rejectionReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type TradeBookingOrderDto = z.infer<typeof tradeBookingOrderDtoSchema>

export const tradeBookingResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('booked'),
    order: tradeBookingOrderDtoSchema,
    steps: z.array(stepLogSchema),
  }),
  z.object({
    outcome: z.literal('escalated'),
    reason: z.string(),
    failedStep: z.string(),
    steps: z.array(stepLogSchema),
  }),
  z.object({
    outcome: z.literal('error'),
    message: z.string(),
    steps: z.array(stepLogSchema).optional(),
  }),
])

export type TradeBookingResponse = z.infer<typeof tradeBookingResponseSchema>

/** Server → client over `POST /nlp/trade-booking/stream` (`text/event-stream`). */
export const tradeBookingStreamProgressSchema = z.object({
  type: z.literal('progress'),
  steps: z.array(stepLogSchema),
})

export type TradeBookingStreamProgress = z.infer<typeof tradeBookingStreamProgressSchema>

export const tradeBookingStreamDoneSchema = z
  .object({ type: z.literal('done') })
  .and(tradeBookingResponseSchema)

export type TradeBookingStreamDone = z.infer<typeof tradeBookingStreamDoneSchema>

export const tradeBookingStreamEventSchema = z.union([tradeBookingStreamProgressSchema, tradeBookingStreamDoneSchema])

export type TradeBookingStreamEvent = z.infer<typeof tradeBookingStreamEventSchema>
