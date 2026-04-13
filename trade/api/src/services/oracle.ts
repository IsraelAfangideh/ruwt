import { config } from "../config.js";

export const USDT_DECIMALS = 6;

export const fromScaled = (v: bigint): number => Number(v) / 10 ** USDT_DECIMALS;
export const toScaled = (n: number): bigint => BigInt(Math.round(n * 10 ** USDT_DECIMALS));

export interface PriceData {
  commodity: string;
  ticker: string;
  priceUsd: number;
  priceScaled: bigint;
  source: "yahoo" | "mock";
  timestamp: number;
}

const COMMODITIES: Record<string, { ticker: string; name: string }> = {
  PALM_OIL: { ticker: "CPO=F", name: "Palm Oil (CME)" },
  COCOA: { ticker: "CC=F", name: "Cocoa (ICE)" },
};

let prices: Record<string, PriceData> = {};
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Fetch a commodity price from Yahoo Finance (free, no API key). */
async function fetchYahoo(commodity: string): Promise<PriceData> {
  const spec = COMMODITIES[commodity];
  if (!spec) throw new Error(`Unknown commodity: ${commodity}`);

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(spec.ticker)}?range=5d&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 RuwtTrade/1.0" },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance error: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${spec.ticker}`);

  // Use the most recent close price (more reliable than regularMarketPrice
  // which can be stale or show the next contract's price)
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((c: number | null) => c !== null);
  const priceUsd = validCloses.length > 0
    ? validCloses[validCloses.length - 1]
    : result.meta.regularMarketPrice;

  if (!priceUsd || priceUsd <= 0) {
    throw new Error(`Invalid price for ${spec.ticker}: ${priceUsd}`);
  }

  return {
    commodity,
    ticker: spec.ticker,
    priceUsd,
    priceScaled: toScaled(priceUsd),
    source: "yahoo",
    timestamp: Date.now(),
  };
}

function mockPrice(commodity: string): PriceData {
  const bases: Record<string, number> = {
    PALM_OIL: 1160,
    COCOA: 3250,
  };
  const base = bases[commodity] ?? 1000;
  const noise = (Math.random() - 0.5) * (base * 0.02); // ±1%
  const priceUsd = base + noise;

  return {
    commodity,
    ticker: COMMODITIES[commodity]?.ticker ?? "MOCK",
    priceUsd,
    priceScaled: toScaled(priceUsd),
    source: "mock",
    timestamp: Date.now(),
  };
}

async function fetchAll(): Promise<void> {
  for (const commodity of Object.keys(COMMODITIES)) {
    try {
      prices[commodity] = await fetchYahoo(commodity);
      console.log(
        `[oracle] ${commodity}: $${prices[commodity].priceUsd.toFixed(2)} (${prices[commodity].source})`
      );
    } catch (err) {
      console.warn(`[oracle] ${commodity} Yahoo fetch failed, using mock:`, (err as Error).message);
      // Fall back to mock, but preserve last real price if we had one
      if (!prices[commodity]) {
        prices[commodity] = mockPrice(commodity);
      }
    }
  }
}

/** Start polling for price updates. Resolves after the initial fetch. */
export async function startPriceFeed(): Promise<void> {
  if (intervalId) clearInterval(intervalId);

  await fetchAll();

  // Yahoo data is delayed ~15min and updates during market hours only.
  // Poll every 5 minutes — frequent enough to catch updates, light enough to not get rate-limited.
  const intervalMs = 5 * 60_000;

  intervalId = setInterval(() => fetchAll(), intervalMs);
}

export function stopPriceFeed(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Get the most recent price for a commodity. Defaults to PALM_OIL. */
export function getLatestPrice(commodity = "PALM_OIL"): PriceData {
  const p = prices[commodity];
  if (!p) throw new Error(`Price not available for ${commodity}`);
  return p;
}

/** Get all available commodity prices. */
export function getAllPrices(): Record<string, PriceData> {
  return { ...prices };
}
