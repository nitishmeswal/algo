import { z, toJSONSchema } from 'zod'

export const breachPositionSchema = z.object({
  symbol: z.string().trim().min(1).max(16),
  side: z.enum(['buy', 'sell']),
  quantity: z.number().int().nonnegative(),
  pnl: z.number().finite(),
})

export const breachAuditEventSchema = z.object({
  emittedAt: z.string().trim().min(1).max(64),
  summary: z.string().trim().min(1).max(280),
})

export const breachInsightRequestSchema = z.object({
  currentPnl: z.number().finite(),
  threshold: z.number().finite(),
  topPositions: z.array(breachPositionSchema).max(5),
  lastAuditEvents: z.array(breachAuditEventSchema).max(5),
})

export const breachInsightOutputSchema = z
  .object({
    insight: z.string().trim().min(1).max(700),
  })
  .strict()

export type BreachInsightRequest = z.infer<typeof breachInsightRequestSchema>
export type BreachInsightOutput = z.infer<typeof breachInsightOutputSchema>

export const BREACH_INSIGHT_OUTPUT_JSON_SCHEMA = toJSONSchema(breachInsightOutputSchema)
