import { describe, expect, it } from 'vitest'
import { coinGeckoRequest, FX_CACHE_TTL_MS, parseYahooIndexChart } from './markets'

describe('market index fallbacks', () => {
  it('parses valid Yahoo chart closes and ignores null points', () => {
    const quote = parseYahooIndexChart({
      meta: { exchangeTimezoneName: 'America/New_York' },
      timestamp: [1_700_000_000, 1_700_086_400, 1_700_172_800],
      indicators: { quote: [{ close: [4500, null, 4545] }] },
    }, { symbol: 'SPX', name: 'S&P 500' })

    expect(quote.close).toBe(4545)
    expect(quote.changePct).toBe(1)
    expect(quote.spark).toEqual([4500, 4545])
    expect(quote.provider).toBe('Yahoo Finance')
    expect(quote.exchangeTimezone).toBe('America/New_York')
  })

  it('rejects malformed or implausible market payloads', () => {
    expect(() => parseYahooIndexChart({
      timestamp: [1, 2], indicators: { quote: [{ close: [100, 200] }] },
    }, { symbol: 'SPX', name: 'S&P 500' })).toThrow('implausible daily change')
  })
})

describe('free market provider configuration', () => {
  it('uses CoinGecko Demo authentication when a key is configured', () => {
    expect(coinGeckoRequest('demo-secret')).toMatchObject({
      init: { headers: { 'x-cg-demo-api-key': 'demo-secret' } },
    })
    expect(coinGeckoRequest('')).toMatchObject({ init: {} })
  })

  it('caches once-daily FX data for 24 hours', () => {
    expect(FX_CACHE_TTL_MS).toBe(86_400_000)
  })
})
