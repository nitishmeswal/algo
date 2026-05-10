import assert from 'node:assert/strict'
import test from 'node:test'

import type { ParsedTradeIntent } from '../../../../../shared/nlp/tradeBookingAgent.js'
import { maxOrderQuantity, priceBandHalfWidth } from './constants.js'
import { validatePriceForTrade } from './validatePrice.js'
import { validateRiskForTrade } from './validateRisk.js'
import { validateSymbolForTrade } from './validateSymbol.js'

test('validateSymbol allows listed tickers (case-insensitive)', () => {
  assert.equal(validateSymbolForTrade('aapl').success, true)
  assert.equal(validateSymbolForTrade('GSCO').success, true)
})

test('validateSymbol rejects unknown ticker', () => {
  const r = validateSymbolForTrade('NVDA')
  assert.equal(r.success, false)
  assert.match(String(r.message), /NVDA/)
})

test('validateRisk rejects quantity above cap', () => {
  const cap = maxOrderQuantity()
  const intent: ParsedTradeIntent = {
    symbol: 'AAPL',
    side: 'buy',
    quantity: cap + 1,
    orderType: 'limit',
    limitPrice: 100,
  }
  const r = validateRiskForTrade(intent)
  assert.equal(r.success, false)
})

test('validatePrice rejects limit far from stub reference', () => {
  const intent: ParsedTradeIntent = {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    orderType: 'limit',
    limitPrice: 1,
  }
  const r = validatePriceForTrade(intent)
  assert.equal(r.success, false)
})

test('validatePrice accepts limit inside band', () => {
  const ref = 200
  const w = priceBandHalfWidth()
  const lo = ref * (1 - w)
  const intent: ParsedTradeIntent = {
    symbol: 'AAPL',
    side: 'buy',
    quantity: 10,
    orderType: 'limit',
    limitPrice: lo + 1,
  }
  const r = validatePriceForTrade(intent)
  assert.equal(r.success, true)
})
