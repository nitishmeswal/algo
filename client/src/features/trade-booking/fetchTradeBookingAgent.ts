import {
  tradeBookingRequestSchema,
  tradeBookingResponseSchema,
  tradeBookingStreamProgressSchema,
  type StepLog,
  type TradeBookingRequest,
  type TradeBookingResponse,
} from '../../../../shared/nlp/tradeBookingAgent'

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Pull complete `data: …` JSON payloads from an SSE buffer; leaves trailing partial data in `rest`. */
function drainSseBuffer(buffer: string): { rest: string; payloads: unknown[] } {
  const payloads: unknown[] = []
  const chunks = buffer.split('\n\n')
  const rest = chunks.pop() ?? ''
  for (const block of chunks) {
    const line = block
      .split('\n')
      .map((l) => l.trimEnd())
      .find((l) => l.startsWith('data:'))
    if (!line) continue
    const jsonStr = line.replace(/^data:\s*/, '').trim()
    if (!jsonStr) continue
    try {
      payloads.push(JSON.parse(jsonStr) as unknown)
    } catch {
      /* ignore malformed chunk */
    }
  }
  return { rest, payloads }
}

/**
 * Same agent as `POST /nlp/trade-booking`, but the server emits SSE `progress` events after each tool
 * so the UI can update steps incrementally. Uses `fetch` + `ReadableStream` (not `EventSource`).
 */
export async function fetchTradeBookingAgentStream(
  body: TradeBookingRequest,
  onProgress: (steps: StepLog[]) => void,
): Promise<TradeBookingResponse> {
  const parsedBody = tradeBookingRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    throw new Error(parsedBody.error.issues[0]?.message ?? 'Invalid request')
  }

  const res = await fetch('/nlp/trade-booking/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(parsedBody.data),
  })

  let errJson: unknown = null
  if (!res.ok) {
    try {
      errJson = await res.json()
    } catch {
      errJson = null
    }
    const msg =
      isRecord(errJson) && typeof errJson.message === 'string' && errJson.message.trim() !== ''
        ? errJson.message
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    throw new Error('No response body for trade-booking stream')
  }

  const decoder = new TextDecoder()
  let carry = ''
  let final: TradeBookingResponse | null = null

  const handlePayloads = (payloads: unknown[]) => {
    for (const raw of payloads) {
      const prog = tradeBookingStreamProgressSchema.safeParse(raw)
      if (prog.success) {
        onProgress(prog.data.steps)
        continue
      }
      if (isRecord(raw) && raw.type === 'done') {
        const { type, ...rest } = raw as { type: unknown } & Record<string, unknown>
        void type
        const parsed = tradeBookingResponseSchema.safeParse(rest)
        if (parsed.success) {
          final = parsed.data
        }
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      carry += decoder.decode(value, { stream: true })
    }
    const drained = drainSseBuffer(carry)
    carry = drained.rest
    handlePayloads(drained.payloads)
    if (done) {
      carry += decoder.decode()
      const tail = drainSseBuffer(carry)
      handlePayloads(tail.payloads)
      break
    }
  }

  if (!final) {
    throw new Error('Stream ended without a valid terminal payload')
  }
  return final
}

export async function fetchTradeBookingAgent(body: TradeBookingRequest): Promise<TradeBookingResponse> {
  const parsedBody = tradeBookingRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    throw new Error(parsedBody.error.issues[0]?.message ?? 'Invalid request')
  }

  const res = await fetch('/nlp/trade-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsedBody.data),
  })

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    const msg =
      isRecord(json) && typeof json.message === 'string' && json.message.trim() !== ''
        ? json.message
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  const parsed = tradeBookingResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error('Invalid response shape from /nlp/trade-booking')
  }
  return parsed.data
}
