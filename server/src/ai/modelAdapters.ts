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
}

export type AdapterSettings = {
  anthropicApiKey?: string
  openaiApiKey?: string
  deepseekApiKey?: string
  grokApiKey?: string
}

export function availableModels(settings: AdapterSettings): AiModel[] {
  const out: AiModel[] = []
  if (settings.anthropicApiKey) out.push('claude')
  if (settings.openaiApiKey) out.push('gpt')
  if (settings.deepseekApiKey) out.push('deepseek')
  if (settings.grokApiKey) out.push('grok')
  return out
}

export async function callModel(
  model: AiModel,
  messages: LlmMessage[],
  settings: AdapterSettings,
): Promise<LlmResponse> {
  const fn = adapters[model]
  if (!fn) throw new Error(`Unknown model: ${model}`)
  return fn(messages, settings)
}

async function callClaude(messages: LlmMessage[], settings: AdapterSettings): Promise<LlmResponse> {
  const apiKey = settings.anthropicApiKey
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

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
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

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
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured')

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
  if (!apiKey) throw new Error('GROK_API_KEY not configured')

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
