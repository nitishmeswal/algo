import { safeParseParsedOrderFilter, type ParsedOrderFilter } from '../../../shared/nlp/parsedOrderFilter.js'
import { getOpenAIClient, openaiModel } from './openaiClient.js'

const SYSTEM_PROMPT = `You convert natural-language **order blotter filter** requests into one JSON object the UI will use to narrow rows.

Output rules:
- Output ONLY valid JSON (no markdown fences, no commentary).
- Use only these top-level keys when relevant: symbol, side, status, timeInForce, venue, account, counterparty, clientOrderId, idContains, rejectionReasonContains, quantityMin, quantityMax, filledQuantityMin, filledQuantityMax, limitPriceMin, limitPriceMax, pnlMin, pnlMax, createdAtOrAfter, createdAtOrBefore, updatedAtOrAfter, updatedAtOrBefore, confidence.
- **Do not return {}** if the user asked to narrow by anything above (e.g. status, side, venue, symbol). Return {} only for greetings, thanks, or text with **no** filter intent at all.

Field rules:
- side: lowercase string "buy" or "sell" only.
- status: array of one or more of: pending_new, new, partially_filled, filled, cancelled, rejected, replaced.
- timeInForce: array of one or more of: day, gtc, ioc, fok, at_open, at_close.
- Map common phrases to status arrays:
  - "open" / "working" / "live" / "still open" → ["pending_new","new","partially_filled"]
  - "rejected" / "rejections" → ["rejected"]
  - "filled" / "done" (when meaning fully executed) → ["filled"]
  - "cancelled" / "canceled" → ["cancelled"]
- venue: uppercase strings like MOCK or MOCK_ALT when the user names them.
- symbol: uppercase ticker when the user names one (e.g. AAPL). Do not invent a symbol if none is named.
- For numeric hints ("at least 500", "qty over 1000") use quantityMin / quantityMax as numbers.

Examples (input → minimal good JSON):
- "show only rejected orders" → {"status":["rejected"]}
- "sell orders on MOCK" → {"side":"sell","venue":"MOCK"}
- "working orders" → {"status":["pending_new","new","partially_filled"]}
- "AAPL buy orders still open" → {"symbol":"AAPL","side":"buy","status":["pending_new","new","partially_filled"]}
`

export type ParseOrderFilterNlpResult =
  | { ok: true; filter: ParsedOrderFilter }
  | { ok: false; error: 'empty_text' | 'openai_unconfigured' | 'openai_error' | 'invalid_json' | 'validation_failed'; message: string; zodIssues?: unknown }

export async function parseOrderFilterFromNlp(text: string): Promise<ParseOrderFilterNlpResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: 'empty_text', message: 'Request body must include non-empty "text".' }
  }

  const client = getOpenAIClient()
  if (!client) {
    return {
      ok: false,
      error: 'openai_unconfigured',
      message: 'Set OPENAI_API_KEY in the server environment to enable NLP filter parsing.',
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
        { role: 'user', content: trimmed },
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

  const zod = safeParseParsedOrderFilter(parsedJson)
  if (!zod.success) {
    return {
      ok: false,
      error: 'validation_failed',
      message: 'Model JSON failed schema validation.',
      zodIssues: zod.error.flatten(),
    }
  }

  return { ok: true, filter: zod.data }
}
