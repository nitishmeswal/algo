import { z, toJSONSchema } from 'zod'

/** Matches client/server `OrderStatus` literals — keep in sync with blotter types. */
export const ORDER_STATUS_VALUES = [
  'pending_new',
  'new',
  'partially_filled',
  'filled',
  'cancelled',
  'rejected',
  'replaced',
] as const

/** Matches `TimeInForce` literals — keep in sync with blotter types. */
export const TIME_IN_FORCE_VALUES = ['day', 'gtc', 'gtd', 'ioc', 'fok', 'at_open', 'at_close'] as const

const sideSchema = z.enum(['buy', 'sell'])

const orderStatusSchema = z.enum(ORDER_STATUS_VALUES)

const timeInForceSchema = z.enum(TIME_IN_FORCE_VALUES)

const isoDateTimeString = z
  .string()
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Expected parseable ISO 8601 date string' })

const nonEmptyTrimmed = z.string().trim().min(1)

/**
 * Structured filter produced by an LLM (or tests). All fields optional — empty object means “no constraints”.
 * Unknown keys are rejected (`.strict()`). Downstream maps this to predicates or Ant table behavior.
 */
export const parsedOrderFilterSchema = z
  .object({
    symbol: nonEmptyTrimmed.max(32).optional(),
    side: sideSchema.optional(),
    status: z.array(orderStatusSchema).max(16).optional(),
    timeInForce: z.array(timeInForceSchema).max(16).optional(),
    venue: nonEmptyTrimmed.max(64).optional(),
    account: nonEmptyTrimmed.max(64).optional(),
    counterparty: nonEmptyTrimmed.max(64).optional(),
    clientOrderId: nonEmptyTrimmed.max(128).optional(),
    idContains: nonEmptyTrimmed.max(64).optional(),
    rejectionReasonContains: nonEmptyTrimmed.max(200).optional(),
    quantityMin: z.number().finite().optional(),
    quantityMax: z.number().finite().optional(),
    filledQuantityMin: z.number().finite().optional(),
    filledQuantityMax: z.number().finite().optional(),
    limitPriceMin: z.number().finite().optional(),
    limitPriceMax: z.number().finite().optional(),
    pnlMin: z.number().finite().optional(),
    pnlMax: z.number().finite().optional(),
    createdAtOrAfter: isoDateTimeString.optional(),
    createdAtOrBefore: isoDateTimeString.optional(),
    updatedAtOrAfter: isoDateTimeString.optional(),
    updatedAtOrBefore: isoDateTimeString.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.quantityMin != null && val.quantityMax != null && val.quantityMin > val.quantityMax) {
      ctx.addIssue({ code: 'custom', message: 'quantityMin must be <= quantityMax', path: ['quantityMin'] })
    }
    if (val.filledQuantityMin != null && val.filledQuantityMax != null && val.filledQuantityMin > val.filledQuantityMax) {
      ctx.addIssue({ code: 'custom', message: 'filledQuantityMin must be <= filledQuantityMax', path: ['filledQuantityMin'] })
    }
    if (val.limitPriceMin != null && val.limitPriceMax != null && val.limitPriceMin > val.limitPriceMax) {
      ctx.addIssue({ code: 'custom', message: 'limitPriceMin must be <= limitPriceMax', path: ['limitPriceMin'] })
    }
    if (val.pnlMin != null && val.pnlMax != null && val.pnlMin > val.pnlMax) {
      ctx.addIssue({ code: 'custom', message: 'pnlMin must be <= pnlMax', path: ['pnlMin'] })
    }
    if (val.createdAtOrAfter != null && val.createdAtOrBefore != null && Date.parse(val.createdAtOrAfter) > Date.parse(val.createdAtOrBefore)) {
      ctx.addIssue({ code: 'custom', message: 'createdAtOrAfter must be <= createdAtOrBefore', path: ['createdAtOrAfter'] })
    }
    if (val.updatedAtOrAfter != null && val.updatedAtOrBefore != null && Date.parse(val.updatedAtOrAfter) > Date.parse(val.updatedAtOrBefore)) {
      ctx.addIssue({ code: 'custom', message: 'updatedAtOrAfter must be <= updatedAtOrBefore', path: ['updatedAtOrAfter'] })
    }
  })

export type ParsedOrderFilter = z.infer<typeof parsedOrderFilterSchema>

export const PARSED_ORDER_FILTER_JSON_SCHEMA = toJSONSchema(parsedOrderFilterSchema)

export function safeParseParsedOrderFilter(raw: unknown) {
  return parsedOrderFilterSchema.safeParse(raw)
}

export function parseParsedOrderFilter(raw: unknown): ParsedOrderFilter {
  return parsedOrderFilterSchema.parse(raw)
}

export function isParsedOrderFilterEmpty(f: ParsedOrderFilter): boolean {
  for (const [key, v] of Object.entries(f)) {
    if (key === 'confidence') continue
    if (v === undefined || v === null) continue
    if (Array.isArray(v) && v.length === 0) continue
    return false
  }
  return true
}
