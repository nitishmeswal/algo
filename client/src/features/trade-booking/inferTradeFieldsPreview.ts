/** Preview-only: coarse pattern match while typing before the agent runs. */
export function inferTradeFieldsPreview(raw: string): {
  side: boolean
  symbol: boolean
  quantity: boolean
  price: boolean
} {
  const t = raw.trim()
  if (!t) {
    return { side: false, symbol: false, quantity: false, price: false }
  }

  const hasSide = /\b(buy|sell|long|short)\b/i.test(t)

  const noise = new Set(
    ['buy', 'sell', 'long', 'short', 'shares', 'share', 'limit', 'market', 'gtd', 'day', 'ioc', 'the', 'for', 'and', 'with'],
  )
  const caps = t.match(/\b[A-Z]{2,5}\b/g)
  const hasSymbolCaps = caps?.some((w) => !noise.has(w.toLowerCase())) ?? false
  const hasSymbolKnown =
    /\b(aapl|msft|googl?|meta|amzn|gsco|nvda|tsla|ibm|spy|qqq|jpm|gs|c|bac)\b/i.test(t)
  const hasSymbol = hasSymbolCaps || hasSymbolKnown

  const hasQuantity =
    /\b(buy|sell)\s+([1-9]\d{0,6})\b/i.test(t) ||
    /\b([1-9]\d{0,6})\s+(shares|units)\b/i.test(t) ||
    /\b([1-9]\d{0,6})\s+of\s+/i.test(t) ||
    /\b(?:[A-Za-z]{2,5})\s+([1-9]\d{0,6})\b/.test(t)

  const hasPrice =
    /\blimit\s+([1-9]\d{0,5}(?:\.\d+)?)\b/i.test(t) ||
    /\b(at|@)\s*\$?\s*([1-9]\d{0,5}(?:\.\d+)?)\b/i.test(t) ||
    /\$\s*([1-9]\d{0,5}(?:\.\d+)?)\b/.test(t) ||
    /\b([1-9]\d{0,2}\.\d{2,4})\b/.test(t) ||
    /\b(?:px|price)\s*[:\s]?\s*([1-9]\d{0,5}(?:\.\d+)?)\b/i.test(t) ||
    /\b(at\s+)?market\b/i.test(t)

  return {
    side: hasSide,
    symbol: hasSymbol,
    quantity: hasQuantity,
    price: hasPrice,
  }
}

/** True when the same four preview checks as the UI are all satisfied. */
export function isTradeDescriptionPreviewComplete(raw: string): boolean {
  const p = inferTradeFieldsPreview(raw)
  return p.side && p.symbol && p.quantity && p.price
}
