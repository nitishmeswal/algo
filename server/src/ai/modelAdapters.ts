import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { AiModel } from '../../../shared/crypto/types.js'

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type LlmResponse = { text: string; model: string; tokensUsed: number }

const adapters: Record<AiModel, (messages: LlmMessage[], settings: AdapterSettings) => Promise<LlmResponse>> = {
  claude: callClaude,
  gpt: callGpt,
  deepseek: callDeepSeek,
  grok: callGrok,
  ollama: callOllama,
}

export type AdapterSettings = {
  anthropicApiKey?: string
  openaiApiKey?: string
  deepseekApiKey?: string
  grokApiKey?: string
  ollamaBaseUrl?: string
  ollamaModel?: string
}

export function availableModels(settings: AdapterSettings): AiModel[] {
  const out: AiModel[] = []
  if (settings.anthropicApiKey) out.push('claude')
  if (settings.openaiApiKey) out.push('gpt')
  if (settings.deepseekApiKey) out.push('deepseek')
  if (settings.grokApiKey) out.push('grok')
  // Ollama is always "available" — it checks connectivity at call time
  out.push('ollama')
  return out
}

export async function callModel(
  model: AiModel,
  messages: LlmMessage[],
  settings: AdapterSettings,
): Promise<LlmResponse> {
  const fn = adapters[model]
  if (!fn) throw new Error(`Unknown model: ${model}`)
  try {
    const resp = await fn(messages, settings)
    if (!resp.text || resp.text.trim().length === 0) {
      throw new Error(`${model} returned empty response`)
    }
    return resp
  } catch (err) {
    if (err instanceof Error) {
      // Provide actionable error messages
      if (err.message.includes('401') || err.message.includes('authentication')) {
        throw new Error(`${model} API key is invalid or expired. Update it in Settings.`)
      }
      if (err.message.includes('429') || err.message.includes('rate limit')) {
        throw new Error(`${model} rate limit exceeded. Wait a moment and try again.`)
      }
      if (err.message.includes('insufficient_quota') || err.message.includes('billing')) {
        throw new Error(`${model} billing issue — check your API account credits.`)
      }
    }
    throw err
  }
}

async function callClaude(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const apiKey = settings.anthropicApiKey
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured — add it in Settings')

  const client = new Anthropic({ apiKey })
  const systemMsg = messages.find((m) => m.role === 'system')?.content ?? ''
  const userMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemMsg,
    messages: userMsgs,
  })

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return {
    text,
    model: 'claude-sonnet-4-20250514',
    tokensUsed: (resp.usage?.input_tokens ?? 0) + (resp.usage?.output_tokens ?? 0),
  }
}

async function callGpt(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const apiKey = settings.openaiApiKey
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured — add it in Settings')

  const client = new OpenAI({ apiKey })
  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 1024,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  return {
    text: resp.choices[0]?.message?.content ?? '',
    model: 'gpt-4o-mini',
    tokensUsed: resp.usage?.total_tokens ?? 0,
  }
}

async function callDeepSeek(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const apiKey = settings.deepseekApiKey
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured — add it in Settings')

  const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com/v1' })
  const resp = await client.chat.completions.create({
    model: 'deepseek-chat',
    temperature: 0.3,
    max_tokens: 1024,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  return {
    text: resp.choices[0]?.message?.content ?? '',
    model: 'deepseek-chat',
    tokensUsed: resp.usage?.total_tokens ?? 0,
  }
}

async function callGrok(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const apiKey = settings.grokApiKey
  if (!apiKey) throw new Error('GROK_API_KEY not configured — add it in Settings')

  const client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' })
  const resp = await client.chat.completions.create({
    model: 'grok-3-mini-fast',
    temperature: 0.3,
    max_tokens: 1024,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  return {
    text: resp.choices[0]?.message?.content ?? '',
    model: 'grok-3-mini-fast',
    tokensUsed: resp.usage?.total_tokens ?? 0,
  }
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'

const OLLAMA_MAX_RETRIES = 2

async function callOllamaOnce(
  baseUrl: string,
  modelName: string,
  messages: LlmMessage[],
): Promise<LlmResponse> {
  // For qwen3 models, prepend /no_think to user message to disable thinking tokens
  const processedMessages = messages.map((m) => {
    if (m.role === 'user') {
      return { role: m.role, content: '/no_think\n' + m.content }
    }
    return { role: m.role, content: m.content }
  })

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: processedMessages,
        stream: false,
        format: 'json',
        options: { temperature: 0.2, num_predict: 512 },
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('connection refused')) {
      throw new Error(
        `Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is running: ollama serve`,
      )
    }
    throw err
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    if (resp.status === 404 || errText.includes('not found')) {
      throw new Error(
        `Ollama model "${modelName}" not found. Run: ollama pull ${modelName}`,
      )
    }
    throw new Error(`Ollama error (${resp.status}): ${errText.slice(0, 200)}`)
  }

  const data = await resp.json()
  let text = data.message?.content ?? ''

  // Strip <think>...</think> blocks that qwen3 models may emit
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  return {
    text,
    model: modelName,
    tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
  }
}

async function callOllama(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const baseUrl = (settings.ollamaBaseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '')
  const modelName = settings.ollamaModel || DEFAULT_OLLAMA_MODEL

  for (let attempt = 0; attempt <= OLLAMA_MAX_RETRIES; attempt++) {
    const result = await callOllamaOnce(baseUrl, modelName, messages)
    if (result.text && result.text.trim().length > 2) {
      return result
    }
    if (attempt < OLLAMA_MAX_RETRIES) {
      console.warn(`[ollama] Empty response, retrying (${attempt + 1}/${OLLAMA_MAX_RETRIES})...`)
    }
  }
  throw new Error('ollama returned empty response after retries')
}
