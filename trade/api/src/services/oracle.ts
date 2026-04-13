import { config } from "../config.js";

export const USDT_DECIMALS = 6;

export const fromScaled = (v: bigint): number => Number(v) / 10 ** USDT_DECIMALS;
export const toScaled = (n: number): bigint => BigInt(Math.round(n * 10 ** USDT_DECIMALS));

export interface PriceData {
  commodity: string;
  priceUsd: number;       // e.g. 4200.50
  priceScaled: bigint;    // e.g. 4200500000n (6 decimals)
  source: "databento-fcpo" | "mock";
  timestamp: number;      // unix ms
}

let latestPrice: PriceData | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch FCPO (Crude Palm Oil) settlement price from Databento.
 * Falls back to a mock price for development.
 */
async function fetchPrice(): Promise<PriceData> {
  if (config.databentoKey) {
    return fetchDatabento();
  }
  return mockPrice();
}

async function fetchDatabento(): Promise<PriceData> {
  const res = await fetch(
    "https://hist.databento.com/v0/timeseries.get_range?" +
      new URLSearchParams({
        dataset: "XKLS.PILLAR",
        symbols: "FCPO.FUT",
        schema: "ohlcv-1d",
        stype_in: "raw_symbol",
        limit: "1",
      }),
    {
      headers: { Authorization: `Bearer ${config.databentoKey}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Databento error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const myrPerMt = data[0]?.close ?? 0;
  const myrToUsd = parseFloat(process.env.MYR_USD_RATE || "0.22");
  const priceUsd = myrPerMt * myrToUsd;

  return toPriceData(priceUsd, "databento-fcpo");
}

function mockPrice(): PriceData {
  const base = 4200;
  const noise = (Math.random() - 0.5) * 100;
  return toPriceData(base + noise, "mock");
}

function toPriceData(priceUsd: number, source: PriceData["source"]): PriceData {
  const scaled = BigInt(Math.round(priceUsd * 10 ** USDT_DECIMALS));
  return {
    commodity: "PALM_OIL",
    priceUsd,
    priceScaled: scaled,
    source,
    timestamp: Date.now(),
  };
}

/** Start polling for price updates. Resolves after the initial fetch. */
export async function startPriceFeed(): Promise<void> {
  if (intervalId) clearInterval(intervalId);

  try {
    latestPrice = await fetchPrice();
  } catch (err) {
    console.error("[oracle] initial price fetch failed:", err);
  }

  // Daily data: poll every 15 min for real feed, 10s for mock/dev
  const intervalMs = config.databentoKey ? 15 * 60_000 : config.priceIntervalMs;

  intervalId = setInterval(async () => {
    try {
      latestPrice = await fetchPrice();
    } catch (err) {
      console.error("[oracle] price fetch failed:", err);
    }
  }, intervalMs);
}

export function stopPriceFeed(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

/** Get the most recent price. Throws if no price available yet. */
export function getLatestPrice(): PriceData {
  if (!latestPrice) {
    throw new Error("Price not available yet");
  }
  return latestPrice;
}
