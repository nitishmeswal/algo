import {
  breachInsightOutputSchema,
  breachInsightRequestSchema,
  type BreachInsightOutput,
  type BreachInsightRequest,
} from '../../../shared/nlp/breachInsight.js'
import { getOpenAIClient, openaiModel } from './openaiClient.js'

const SYSTEM_PROMPT = `You are a senior trading desk risk assistant.
Given breach context, produce a concise 2-3 sentence actionable insight for a trader.

Output rules:
- Output ONLY JSON.
- JSON shape: { "insight": string }.
- Keep it concise (2-3 sentences), specific to provided symbols/sides/P&L context.
- Include concrete next steps (reduce, hedge, tighten, pause, review), not generic prose.
- Do not mention missing data unless essential.`

export type GenerateBreachInsightResult =
  | { ok: true; insight: string }
  | { ok: false; error: 'invalid_request' | 'openai_unconfigured' | 'openai_error' | 'invalid_json' | 'validation_failed'; message: string; zodIssues?: unknown }

export async function generateBreachInsight(context: BreachInsightRequest): Promise<GenerateBreachInsightResult> {
  const reqCheck = breachInsightRequestSchema.safeParse(context)
  if (!reqCheck.success) {
    return {
      ok: false,
      error: 'invalid_request',
      message: 'Breach insight request failed schema validation.',
      zodIssues: reqCheck.error.flatten(),
    }
  }

  const client = getOpenAIClient()
  if (!client) {
    return {
      ok: false,
      error: 'openai_unconfigured',
      message: 'Set OPENAI_API_KEY in the server environment to enable breach insight generation.',
    }
  }

  let rawContent: string | null | undefined
  try {
    const completion = await client.chat.completions.create({
      model: openaiModel(),
      temperature: 0.2,
      max_tokens: 280,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(reqCheck.data) },
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

  const zod = breachInsightOutputSchema.safeParse(parsedJson)
  if (!zod.success) {
    return {
      ok: false,
      error: 'validation_failed',
      message: 'Model JSON failed breach insight schema validation.',
      zodIssues: zod.error.flatten(),
    }
  }
  const out: BreachInsightOutput = zod.data
  return { ok: true, insight: out.insight }
}
