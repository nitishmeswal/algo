/**
 * Agent Personality Presets
 *
 * Each personality is a behavioral strategy modifier — NOT a fake persona.
 * It adjusts: confidence thresholds, position sizing, trade frequency,
 * risk appetite, holding patience, and prompt behavior.
 */

export interface PersonalityPreset {
  id: string
  name: string
  emoji: string
  description: string
  /** Min confidence to execute a trade (default 65) */
  confidenceThreshold: number
  /** Multiplier on position size (1.0 = normal, 0.5 = half, 1.5 = 1.5x) */
  positionSizeMultiplier: number
  /** Max % of allocated capital in a single position */
  maxPositionPct: number
  /** Max % total exposure */
  maxExposurePct: number
  /** Stop-loss % (overrides default) */
  stopLossPct: number
  /** Take-profit % (overrides default) */
  takeProfitPct: number
  /** Prompt personality injection — behavioral instructions for the LLM */
  promptModifier: string
  /** How aggressively to scale in (0 = never, 1 = normal, 2 = aggressive) */
  scaleInAggressiveness: number
  /** Confidence decay rate after wrong signals (0-1, higher = faster decay) */
  confidenceDecayRate: number
}

export const PERSONALITY_PRESETS: Record<string, PersonalityPreset> = {
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    emoji: '🛡️',
    description: 'Conservative capital preserver. Fewer trades, strong confirmations only, early exits. Prioritizes not losing money over making money.',
    confidenceThreshold: 75,
    positionSizeMultiplier: 0.5,
    maxPositionPct: 30,
    maxExposurePct: 50,
    stopLossPct: 2,
    takeProfitPct: 3,
    promptModifier: `PERSONALITY: Guardian (Conservative)
- You are extremely risk-averse. Capital preservation is your PRIMARY goal.
- Only trade with VERY high confidence and multiple confirming signals.
- Prefer smaller positions. Never go all-in.
- Exit early if profit target is close — don't wait for perfection.
- If ANY signal is uncertain, HOLD. Better to miss a trade than lose money.
- After ANY loss, become even more cautious for the next 5 cycles.
- Your motto: "Protect the capital first, grow it second."`,
    scaleInAggressiveness: 0.3,
    confidenceDecayRate: 0.15,
  },

  hunter: {
    id: 'hunter',
    name: 'Hunter',
    emoji: '🏹',
    description: 'Aggressive momentum chaser. Larger positions, breakout entries, accepts volatility. Seeks high-reward opportunities.',
    confidenceThreshold: 60,
    positionSizeMultiplier: 1.3,
    maxPositionPct: 60,
    maxExposurePct: 85,
    stopLossPct: 5,
    takeProfitPct: 8,
    promptModifier: `PERSONALITY: Hunter (Aggressive Momentum)
- You chase momentum and breakouts aggressively.
- When you see strong volume + MACD crossover + trend alignment, go BIG.
- Use larger position sizes when confidence is high.
- Accept higher volatility — wider stop losses are fine.
- Scale into winning positions quickly.
- Don't be afraid to hold through pullbacks if the trend is intact.
- Your motto: "Strike hard when the opportunity is clear."`,
    scaleInAggressiveness: 1.8,
    confidenceDecayRate: 0.05,
  },

  sniper: {
    id: 'sniper',
    name: 'Sniper',
    emoji: '🎯',
    description: 'Precision trader. Extremely selective, waits for perfect setups. Low trade frequency but high-quality entries.',
    confidenceThreshold: 80,
    positionSizeMultiplier: 1.0,
    maxPositionPct: 45,
    maxExposurePct: 60,
    stopLossPct: 2,
    takeProfitPct: 6,
    promptModifier: `PERSONALITY: Sniper (Precision)
- You ONLY trade when ALL indicators align perfectly.
- RSI + MACD + Bollinger + Volume + Trend must ALL confirm.
- One mixed signal = HOLD. No exceptions.
- When you DO trade, use decisive position sizing.
- Patience is your greatest weapon — you may HOLD for 20+ cycles waiting.
- Quality over quantity. One perfect trade beats ten mediocre ones.
- Your motto: "One shot, one kill. Wait for the perfect setup."`,
    scaleInAggressiveness: 0.5,
    confidenceDecayRate: 0.1,
  },

  monk: {
    id: 'monk',
    name: 'Monk',
    emoji: '🧘',
    description: 'Patient swing trader. Long holds, macro trend focus, ignores noise. Slow and steady accumulation.',
    confidenceThreshold: 70,
    positionSizeMultiplier: 0.8,
    maxPositionPct: 40,
    maxExposurePct: 65,
    stopLossPct: 4,
    takeProfitPct: 10,
    promptModifier: `PERSONALITY: Monk (Patient Swing)
- You think in TRENDS, not individual candles.
- Ignore small price fluctuations — focus on the bigger picture.
- Hold positions for long periods if the trend supports it.
- Use wider take-profits — aim for larger moves, not quick scalps.
- Scale in slowly over time rather than entering all at once.
- HOLD is your most common action — and that's perfectly fine.
- Sell only when the macro trend clearly reverses.
- Your motto: "Patience is the ultimate edge. Let the trend do the work."`,
    scaleInAggressiveness: 0.6,
    confidenceDecayRate: 0.08,
  },

  maverick: {
    id: 'maverick',
    name: 'Maverick',
    emoji: '🎲',
    description: 'High-risk opportunist. Volatile market lover, fast rotations, aggressive scaling. Still bounded by risk engine.',
    confidenceThreshold: 55,
    positionSizeMultiplier: 1.5,
    maxPositionPct: 65,
    maxExposurePct: 90,
    stopLossPct: 6,
    takeProfitPct: 12,
    promptModifier: `PERSONALITY: Maverick (High-Risk Opportunist)
- You THRIVE in volatile markets. Big moves = big opportunities.
- Lower confidence threshold — you're willing to take calculated risks.
- Use aggressive position sizing and scale in fast when momentum builds.
- Accept bigger drawdowns for bigger potential gains.
- Rotate positions quickly — don't hold losing positions hoping for recovery.
- If a trade goes wrong, cut it and look for the next opportunity immediately.
- ATR-based volatility is your friend, not your enemy.
- Your motto: "Fortune favors the bold. Manage risk, but don't fear it."`,
    scaleInAggressiveness: 2.0,
    confidenceDecayRate: 0.03,
  },
}

export function getPersonalityPreset(id: string): PersonalityPreset {
  return PERSONALITY_PRESETS[id] ?? PERSONALITY_PRESETS.guardian
}

export function getAllPresets(): PersonalityPreset[] {
  return Object.values(PERSONALITY_PRESETS)
}

export function buildPersonalitySystemPrompt(preset: PersonalityPreset): string {
  return `You are a professional cryptocurrency trader. Respond with ONLY a JSON object.

${preset.promptModifier}

OUTPUT FORMAT (no markdown, no text outside JSON):
{"action":"buy"|"sell"|"hold","confidence":0-100,"reasoning":"brief reason"}

TRADING RULES:
- BUY when 3+ signals align: RSI<40 + MACD histogram positive + price near lower Bollinger + volume above average
- SELL when 3+ signals align: RSI>65 + MACD histogram negative + price near upper Bollinger, OR position profitable and momentum fading
- HOLD when signals conflict or fewer than 3 align
- Only trade when confidence > ${preset.confidenceThreshold}

VOLUME: Above 120% avg = strong. Below 80% avg = weak, reduce confidence by 15. Never buy on low volume.
TREND: Price above SMA20 + EMA12>EMA26 = uptrend. Below = downtrend. Near SMA20 + flat MACD = sideways.
POSITION: Profitable >1% = hold/add if trend continues. Losing >-2% = cut unless strong reversal signals.

Keep reasoning under 150 chars. Be decisive.`
}
