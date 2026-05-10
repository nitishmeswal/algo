import { parsedTradeIntentSchema, type ParsedTradeIntent } from '../../../../../shared/nlp/tradeBookingAgent.js'
import { getOpenAIClient, openaiModel } from '../../openaiClient.js'

const SYSTEM_PROMPT = `You extract a **stock order intent** from the user's English into one JSON object.

Output rules:
- Output ONLY valid JSON (no markdown fences, no commentary).
- Required keys: symbol (string ticker), side ("buy" or "sell"), quantity (positive integer).
- Optional: orderType ("market"|"limit"|"stop"|"stop_limit"), limitPrice, stopPrice (positive numbers when relevant),
  timeInForce ("day"|"gtc"|"gtd"|"ioc"|"fok"|"at_open"|"at_close"), venue, account, counterparty (short strings),
  strategyTag, displayQuantity (positive int), expireAt (ISO-like string when timeInForce is gtd).

Rules:
- Infer side from buy/sell/long/short language.
- quantity is whole shares unless the user clearly states otherwise (assume integer).
- Default orderType to "limit" when the user gives an explicit limit price; "market" when they say market/at market.
- Map ticker symbols to uppercase (e.g. aapl → AAPL).
- If information is missing or ambiguous, use null only for optional fields; never omit required keys.
`

export type ParseTradeIntentNlpResult =
  | { ok: true; intent: ParsedTradeIntent }
  | { ok: false; error: 'openai_unconfigured' | 'openai_error' | 'invalid_json' | 'validation_failed'; message: string }

export async function parseTradeIntentFromNlp(text: string): Promise<ParseTradeIntentNlpResult> {
  const client = getOpenAIClient()
  if (!client) {
    return {
      ok: false,
      error: 'openai_unconfigured',
      message: 'Set OPENAI_API_KEY in the server environment to enable trade booking.',
    }
  }

  let rawContent: string | null | undefined
  try {
    const completion = await client.chat.completions.create({
      model: openaiModel(),
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    })
    rawContent = completion.choices[0]?.message?.content
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: 'openai_error', message }
  }

  if (rawContent == null || rawContent.trim() === '') {
    return { ok: false, error: 'openai_error', message: 'OpenAI returned an empty message.' }
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawContent) as unknown
  } catch {
    return { ok: false, error: 'invalid_json', message: 'Model output was not valid JSON.' }
  }

  const zod = parsedTradeIntentSchema.safeParse(parsedJson)
  if (!zod.success) {
    const first = zod.error.issues[0]
    return {
      ok: false,
      error: 'validation_failed',
      message: first?.message ?? 'Model JSON failed schema validation.',
    }
  }

  return { ok: true, intent: zod.data }
}
