import { useCallback, useState } from 'react'

import { ingestOrderFromBookedAgent } from '../blotter/api/submitOrder'
import type { StepLog, TradeBookingResponse } from '../../../../shared/nlp/tradeBookingAgent'
import { fetchTradeBookingAgentStream } from './fetchTradeBookingAgent'

export function useTradeBookingAgentRun() {
  const [tradeDescription, setTradeDescription] = useState('')
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentResult, setAgentResult] = useState<TradeBookingResponse | null>(null)
  const [liveSteps, setLiveSteps] = useState<StepLog[] | null>(null)

  const clearAgentResult = useCallback(() => {
    setAgentResult(null)
    setLiveSteps(null)
  }, [])

  const resetAll = useCallback(() => {
    setTradeDescription('')
    setAgentError(null)
    setAgentResult(null)
    setLiveSteps(null)
    setAgentLoading(false)
  }, [])

  const runAgent = useCallback(async () => {
    const text = tradeDescription.trim()
    if (!text) return
    setAgentLoading(true)
    setAgentError(null)
    setAgentResult(null)
    setLiveSteps(null)
    try {
      const r = await fetchTradeBookingAgentStream({ text }, (steps) => setLiveSteps(steps))
      setAgentResult(r)
      setLiveSteps(null)
      if (r.outcome === 'booked') {
        ingestOrderFromBookedAgent(r.order)
      }
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : String(e))
      setLiveSteps(null)
    } finally {
      setAgentLoading(false)
    }
  }, [tradeDescription])

  const agentStepSnapshot = liveSteps ?? agentResult?.steps ?? null

  return {
    tradeDescription,
    setTradeDescription,
    agentLoading,
    agentError,
    agentResult,
    agentStepSnapshot,
    runAgent,
    clearAgentResult,
    resetAll,
  }
}
