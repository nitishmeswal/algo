/**
 * Confidence Calibrator
 *
 * Solves the "always 70% confidence" problem by:
 * 1. Tracking AI-stated confidence vs actual outcome accuracy
 * 2. Applying decay after wrong signals
 * 3. Normalizing confidence based on historical calibration
 * 4. Computing a reliability score the LLM can see
 */

interface SignalRecord {
  action: 'buy' | 'sell'
  statedConfidence: number
  wasCorrect: boolean | null // null = not yet validated
  ts: number
}

const MAX_HISTORY = 50

let signalHistory: SignalRecord[] = []
let calibrationOffset = 0 // applied decay/boost to confidence

export function recordSignal(action: 'buy' | 'sell', statedConfidence: number): void {
  signalHistory.push({
    action,
    statedConfidence,
    wasCorrect: null,
    ts: Date.now(),
  })
  if (signalHistory.length > MAX_HISTORY) {
    signalHistory = signalHistory.slice(-MAX_HISTORY)
  }
}

export function recordOutcome(wasCorrect: boolean): void {
  // Find most recent unresolved signal
  for (let i = signalHistory.length - 1; i >= 0; i--) {
    if (signalHistory[i].wasCorrect === null) {
      signalHistory[i].wasCorrect = wasCorrect

      // Apply confidence decay/boost
      if (!wasCorrect) {
        calibrationOffset = Math.max(-30, calibrationOffset - 5)
      } else {
        calibrationOffset = Math.min(15, calibrationOffset + 2)
      }
      break
    }
  }
}

export function calibrateConfidence(rawConfidence: number, personalityDecayRate?: number): number {
  const decayRate = personalityDecayRate ?? 0.1

  // Count recent accuracy
  const resolved = signalHistory.filter(s => s.wasCorrect !== null)
  const recentResolved = resolved.slice(-10)

  if (recentResolved.length === 0) return rawConfidence

  const correctCount = recentResolved.filter(s => s.wasCorrect).length
  const accuracy = correctCount / recentResolved.length

  // If accuracy is poor, apply confidence penalty
  let adjusted = rawConfidence + calibrationOffset

  // Streak-based penalty: consecutive wrong signals
  let wrongStreak = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (!resolved[i].wasCorrect) wrongStreak++
    else break
  }
  if (wrongStreak >= 3) {
    adjusted -= wrongStreak * 3 * decayRate * 100
  }

  // Accuracy-based scaling: if AI says 70% but only 30% correct, scale down
  if (accuracy < 0.5 && recentResolved.length >= 5) {
    const scaleFactor = 0.5 + accuracy // 0.5 to 1.0
    adjusted = adjusted * scaleFactor
  }

  return Math.max(10, Math.min(95, Math.round(adjusted)))
}

export function getCalibrationStats(): {
  totalSignals: number
  resolvedSignals: number
  accuracy: number
  recentAccuracy: number
  calibrationOffset: number
  avgStatedConfidence: number
  avgCalibratedConfidence: number
  wrongStreak: number
} {
  const resolved = signalHistory.filter(s => s.wasCorrect !== null)
  const correct = resolved.filter(s => s.wasCorrect).length
  const recent = resolved.slice(-10)
  const recentCorrect = recent.filter(s => s.wasCorrect).length

  // Wrong streak
  let wrongStreak = 0
  for (let i = resolved.length - 1; i >= 0; i--) {
    if (!resolved[i].wasCorrect) wrongStreak++
    else break
  }

  const avgStated = signalHistory.length > 0
    ? signalHistory.reduce((s, r) => s + r.statedConfidence, 0) / signalHistory.length
    : 0

  return {
    totalSignals: signalHistory.length,
    resolvedSignals: resolved.length,
    accuracy: resolved.length > 0 ? correct / resolved.length : 0,
    recentAccuracy: recent.length > 0 ? recentCorrect / recent.length : 0,
    calibrationOffset,
    avgStatedConfidence: Math.round(avgStated),
    avgCalibratedConfidence: Math.round(calibrateConfidence(avgStated)),
    wrongStreak,
  }
}

export function buildCalibrationContext(): string {
  const stats = getCalibrationStats()
  if (stats.resolvedSignals === 0) return ''

  return `
CONFIDENCE CALIBRATION:
- Your overall signal accuracy: ${(stats.accuracy * 100).toFixed(0)}% (${stats.resolvedSignals} signals)
- Recent accuracy (last 10): ${(stats.recentAccuracy * 100).toFixed(0)}%
- Your avg stated confidence: ${stats.avgStatedConfidence}%
- Calibrated confidence: ${stats.avgCalibratedConfidence}%
- Wrong streak: ${stats.wrongStreak} consecutive
${stats.wrongStreak >= 2 ? '⚠️ You have been WRONG recently. Lower your confidence and be MORE selective.' : ''}
${stats.accuracy < 0.5 && stats.resolvedSignals >= 5 ? '⚠️ Your accuracy is below 50%. Your confidence has been OVERESTIMATED. Recalibrate.' : ''}`
}

export function resetCalibration(): void {
  signalHistory = []
  calibrationOffset = 0
}
