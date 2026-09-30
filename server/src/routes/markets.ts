import { Router, Request, Response } from 'express'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from '../lib/logger'

export const marketsRouter = Router()

marketsRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=600')
  next()
})

interface Section<T> { value: T | null; fetchedAt: number; stale: boolean }
interface CachedSection { value: unknown; fetchedAt: number }
const CACHE_FILE = process.env.MARKET_CACHE_FILE || '/app/.cache/markets.json'
const lastGood = new Map<string, CachedSection>()
const inflight = new Map<string, Promise<unknown>>()

const cacheReady = readFile(CACHE_FILE, 'utf8')
  .then((raw) => {
    const parsed = JSON.parse(raw) as Record<string, CachedSection>
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && Number.isFinite(entry.fetchedAt)) lastGood.set(key, entry)
    }
  })
  .catch(() => undefined)

async function persistCache() {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true })
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(lastGood)), 'utf8')
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[markets] persistent cache write failed')
  }
}

async function section<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<Section<T>> {
  await cacheReady
  const cached = lastGood.get(key)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < ttlMs) {
    return { value: cached.value as T, fetchedAt: cached.fetchedAt, stale: false }
  }
  try {
    let pending = inflight.get(key) as Promise<T> | undefined
    if (!pending) {
      pending = loader()
      inflight.set(key, pending)
      pending.finally(() => inflight.delete(key)).catch(() => undefined)
    }
    const value = await pending
    lastGood.set(key, { value, fetchedAt: now })
    void persistCache()
    return { value, fetchedAt: now, stale: false }
  } catch (err) {
    logger.error({ err: (err as Error).message }, `[markets:${key}]`)
    if (cached) return { value: cached.value as T, fetchedAt: cached.fetchedAt, stale: true }
    return { value: null, fetchedAt: now, stale: true }
  }
}

const FETCH_TIMEOUT_MS = 8_000
const fetchWithTimeout = (url: string, init: RequestInit = {}) => fetch(url, {
  ...init,
  headers: { ...init.headers },
  signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
})
export const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const finitePositive = (value: unknown, label: string): number => {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} is invalid`)
  return number
}

interface FxRates {
  base: 'USD'; idr: number; twd: number; eur: number
  updatedAt: string | null; provider: string
}
async function loadFx(): Promise<FxRates> {
  const res = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`)
  const json: any = await res.json()
  if (json?.result !== 'success' || !json.rates) throw new Error('er-api bad payload')
  return {
    base: 'USD',
    idr: finitePositive(json.rates.IDR, 'USD/IDR'),
    twd: finitePositive(json.rates.TWD, 'USD/TWD'),
    eur: finitePositive(json.rates.EUR, 'USD/EUR'),
    updatedAt: json.time_last_update_utc ?? null,
    provider: 'ExchangeRate-API',
  }
}

interface IndexQuote {
  symbol: string; name: string; close: number; changePct: number | null
  spark: number[]; asOf: string | null; provider: string; exchangeTimezone: string | null
}
const INDICES = [
  { symbol: 'SPX', stooq: '^spx', yahoo: '^GSPC', name: 'S&P 500' },
  { symbol: 'IXIC', stooq: '^ndq', yahoo: '^IXIC', name: 'Nasdaq Composite' },
  { symbol: 'DJI', stooq: '^dji', yahoo: '^DJI', name: 'Dow Jones' },
]

async function loadTwelveDataIndices(apiKey: string): Promise<IndexQuote[]> {
  const results = await Promise.all(INDICES.map(async ({ symbol, name }) => {
    const params = new URLSearchParams({
      symbol, interval: '1day', outputsize: '14', order: 'asc', apikey: apiKey,
    })
    const res = await fetchWithTimeout(`https://api.twelvedata.com/time_series?${params}`)
    if (!res.ok) throw new Error(`Twelve Data ${symbol} HTTP ${res.status}`)
    const json: any = await res.json()
    if (json?.status === 'error' || !Array.isArray(json?.values)) {
      throw new Error(`Twelve Data ${symbol}: ${json?.message || 'bad payload'}`)
    }
    const values = json.values
      .map((row: any) => ({ close: Number(row.close), datetime: String(row.datetime || '') }))
      .filter((row: any) => Number.isFinite(row.close) && row.close > 0)
    if (values.length < 2) throw new Error(`Twelve Data ${symbol}: insufficient history`)
    const current = values[values.length - 1]
    const previous = values[values.length - 2]
    const changePct = ((current.close - previous.close) / previous.close) * 100
    if (!Number.isFinite(changePct) || Math.abs(changePct) > 30) {
      throw new Error(`Twelve Data ${symbol}: implausible daily change`)
    }
    return {
      symbol, name, close: current.close, changePct,
      spark: values.map((row: any) => row.close),
      asOf: current.datetime || null,
      provider: 'Twelve Data',
      exchangeTimezone: json?.meta?.exchange_timezone ?? null,
    }
  }))
  return results
}

function stooqDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}
async function loadStooqIndices(): Promise<IndexQuote[]> {
  const end = new Date()
  const start = new Date(end.getTime() - 21 * 86_400_000)
  const results = await Promise.all(INDICES.map(async ({ symbol, stooq, name }): Promise<IndexQuote | null> => {
    try {
      const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooq)}&d1=${stooqDate(start)}&d2=${stooqDate(end)}&i=d`
      const res = await fetchWithTimeout(url)
      if (!res.ok) return null
      const text = await res.text()
      if (!/^Date,Open,High,Low,Close(?:,Volume)?\s*$/m.test(text)) return null
      const rows = text.trim().split(/\r?\n/).slice(1)
        .map((line) => {
          const columns = line.split(',')
          return { date: columns[0], close: Number(columns[4]) }
        })
        .filter((row) => Number.isFinite(row.close) && row.close > 0)
      if (rows.length < 2) return null
      const current = rows[rows.length - 1]
      const previous = rows[rows.length - 2]
      return {
        symbol, name, close: current.close,
        changePct: ((current.close - previous.close) / previous.close) * 100,
        spark: rows.slice(-14).map((row) => row.close), asOf: current.date || null,
        provider: 'Stooq', exchangeTimezone: 'America/New_York',
      }
    } catch { return null }
  }))
  const quotes = results.filter((quote): quote is IndexQuote => quote !== null)
  if (quotes.length === 0) throw new Error('Stooq returned no parsable data')
  return quotes
}

interface YahooChartResult {
  meta?: {
    currency?: string
    exchangeTimezoneName?: string
    regularMarketTime?: number
  }
  timestamp?: number[]
  indicators?: { quote?: Array<{ close?: Array<number | null> }> }
}

/** Parse only completed, finite closes from Yahoo's chart response. Exported
 * for a fixture-based unit test because this keyless endpoint is an external
 * fallback whose payload must never be trusted blindly. */
export function parseYahooIndexChart(
  result: YahooChartResult,
  identity: { symbol: string; name: string }
): IndexQuote {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : []
  const closes = result.indicators?.quote?.[0]?.close
  if (!Array.isArray(closes)) throw new Error(`Yahoo ${identity.symbol}: missing closes`)
  const points = closes
    .map((close, index) => ({ close: Number(close), timestamp: Number(timestamps[index]) }))
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(point.timestamp))
  if (points.length < 2) throw new Error(`Yahoo ${identity.symbol}: insufficient history`)
  const current = points[points.length - 1]
  const previous = points[points.length - 2]
  const changePct = ((current.close - previous.close) / previous.close) * 100
  if (!Number.isFinite(changePct) || Math.abs(changePct) > 30) {
    throw new Error(`Yahoo ${identity.symbol}: implausible daily change`)
  }
  return {
    ...identity,
    close: current.close,
    changePct,
    spark: points.slice(-14).map((point) => point.close),
    asOf: new Date(current.timestamp * 1000).toISOString(),
    provider: 'Yahoo Finance',
    exchangeTimezone: result.meta?.exchangeTimezoneName ?? null,
  }
}

async function loadYahooIndices(): Promise<IndexQuote[]> {
  return Promise.all(INDICES.map(async ({ symbol, yahoo, name }) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=1mo&interval=1d&events=history`
    const res = await fetchWithTimeout(url)
    if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
    const json: any = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result || json?.chart?.error) {
      throw new Error(`Yahoo ${symbol}: ${json?.chart?.error?.description || 'bad payload'}`)
    }
    return parseYahooIndexChart(result, { symbol, name })
  }))
}

async function loadIndices(): Promise<IndexQuote[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim()
  if (apiKey) {
    try { return await loadTwelveDataIndices(apiKey) }
    catch (err) {
      logger.warn({ err: (err as Error).message }, '[markets] Twelve Data failed; using Stooq fallback')
    }
  }
  try { return await loadStooqIndices() }
  catch (err) {
    logger.warn({ err: (err as Error).message }, '[markets] Stooq failed; using Yahoo fallback')
    return loadYahooIndices()
  }
}

interface CryptoQuote {
  id: string; symbol: string; price: number; changePct24h: number | null
  spark: number[]; asOf: string | null; provider: string
}
export function coinGeckoRequest(apiKey = process.env.COINGECKO_API_KEY?.trim()) {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&sparkline=true&price_change_percentage=24h'
  return {
    url,
    init: apiKey ? { headers: { 'x-cg-demo-api-key': apiKey } } : {},
  }
}
async function loadCrypto(): Promise<CryptoQuote[]> {
  const request = coinGeckoRequest()
  const res = await fetchWithTimeout(request.url, request.init)
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
  const json: any = await res.json()
  if (!Array.isArray(json)) throw new Error('CoinGecko bad payload')
  return json.map((coin: any) => {
    const price = finitePositive(coin.current_price, `${coin.id} price`)
    const rawSpark: unknown[] = Array.isArray(coin?.sparkline_in_7d?.price) ? coin.sparkline_in_7d.price : []
    const prices = rawSpark.map(Number).filter((value) => Number.isFinite(value) && value > 0)
    const step = Math.max(1, Math.floor(prices.length / 24))
    const change = coin.price_change_percentage_24h == null ? null : Number(coin.price_change_percentage_24h)
    return {
      id: String(coin.id), symbol: String(coin.symbol ?? '').toUpperCase(), price,
      changePct24h: change != null && Number.isFinite(change) && Math.abs(change) <= 100 ? change : null,
      spark: prices.filter((_, index) => index % step === 0),
      asOf: coin.last_updated ?? null, provider: 'CoinGecko',
    }
  })
}

marketsRouter.get('/summary', async (_req: Request, res: Response) => {
  const [fx, indices, crypto] = await Promise.all([
    section('fx', FX_CACHE_TTL_MS, loadFx),
    section('indices', 30 * 60 * 1000, loadIndices),
    section('crypto', 10 * 60 * 1000, loadCrypto),
  ])
  res.json({
    success: true,
    data: {
      fx: {
        ...(fx.value ?? { base: 'USD' as const, idr: 0, twd: 0, eur: 0, updatedAt: null, provider: 'Unavailable' }),
        stale: fx.stale, unavailable: fx.value === null,
        fetchedAt: new Date(fx.fetchedAt).toISOString(),
      },
      indices: { items: indices.value ?? [], stale: indices.stale, unavailable: indices.value === null,
        fetchedAt: new Date(indices.fetchedAt).toISOString(), provider: indices.value?.[0]?.provider ?? 'Unavailable' },
      crypto: { items: crypto.value ?? [], stale: crypto.stale, unavailable: crypto.value === null,
        fetchedAt: new Date(crypto.fetchedAt).toISOString(), provider: crypto.value?.[0]?.provider ?? 'Unavailable' },
    },
  })
})
