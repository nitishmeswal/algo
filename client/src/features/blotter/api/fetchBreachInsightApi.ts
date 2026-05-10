import type { BreachInsightRequest } from '../../../../../shared/nlp/breachInsight'

type BreachInsightErrorBody = {
  error: string
  message: string
  zodIssues?: unknown
}

export async function fetchBreachInsight(context: BreachInsightRequest): Promise<string> {
  const res = await fetch('/nlp/breach-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(context),
  })

  const body: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'message' in body && typeof (body as BreachInsightErrorBody).message === 'string'
        ? (body as BreachInsightErrorBody).message
        : res.statusText
    throw new Error(msg || `Breach insight failed (${res.status})`)
  }

  if (typeof body !== 'object' || body === null || !('insight' in body) || typeof (body as { insight: unknown }).insight !== 'string') {
    throw new Error('Invalid response shape from /nlp/breach-insight')
  }
  return (body as { insight: string }).insight.trim()
}
