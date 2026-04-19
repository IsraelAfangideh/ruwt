import type { Env } from "./env";

interface CachedPrice {
  commodity: string;
  ticker: string;
  priceUsd: number;
  source: "yahoo" | "mock";
  timestamp: number;
}

interface CommoditySpec {
  ticker: string;
  marketOpen: { hour: number; minute: number };
  marketClose: { hour: number; minute: number };
  timezone: string;
}

const COMMODITIES: Record<string, CommoditySpec> = {
  PALM_OIL: {
    ticker: "CPO=F",
    marketOpen: { hour: 1, minute: 0 },
    marketClose: { hour: 9, minute: 0 },
    timezone: "MYT",
  },
  COCOA: {
    ticker: "CC=F",
    marketOpen: { hour: 13, minute: 0 },
    marketClose: { hour: 17, minute: 30 },
    timezone: "ET",
  },
};

const SPREAD_BPS = 100; // 1% total = 0.5% each side

/** Get cached price from KV, fetch from Yahoo if stale (>5 min). */
export async function getPrice(env: Env, commodity: string): Promise<CachedPrice> {
  const key = `prices:${commodity}`;
  const cached = await env.PRICES.get(key, "json") as CachedPrice | null;

  // Use cache if fresh (< 5 minutes old)
  if (cached && Date.now() - cached.timestamp < 5 * 60_000) {
    return cached;
  }

  // Fetch fresh price from Yahoo
  try {
    const fresh = await fetchYahoo(commodity);
    await env.PRICES.put(key, JSON.stringify(fresh), { expirationTtl: 600 });
    return fresh;
  } catch (err) {
    // If Yahoo fails, return stale cache or throw
    if (cached) return cached;
    throw new Error(`No price available for ${commodity}: ${(err as Error).message}`);
  }
}

async function fetchYahoo(commodity: string): Promise<CachedPrice> {
  const spec = COMMODITIES[commodity];
  if (!spec) throw new Error(`Unknown commodity: ${commodity}`);

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(spec.ticker)}?range=5d&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 RuwtTrade/1.0" },
  });

  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);

  const data: any = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${spec.ticker}`);

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((c: number | null) => c !== null);
  const priceUsd = validCloses.length > 0
    ? validCloses[validCloses.length - 1]
    : result.meta.regularMarketPrice;

  if (!priceUsd || priceUsd <= 0) throw new Error(`Invalid price: ${priceUsd}`);

  return {
    commodity,
    ticker: spec.ticker,
    priceUsd,
    source: "yahoo",
    timestamp: Date.now(),
  };
}

/** Compute bid/ask from oracle price. */
export function computeQuotes(oraclePrice: number) {
  const halfSpread = SPREAD_BPS / 2 / 10_000;
  const ask = Math.round(oraclePrice * (1 + halfSpread) * 100) / 100;
  const bid = Math.round(oraclePrice * (1 - halfSpread) * 100) / 100;
  const mid = (bid + ask) / 2;
  const spreadPercent = ((ask - bid) / mid) * 100;
  return { bid, ask, spreadPercent };
}

/** Get market status for display. */
export function getMarketStatus(commodity: string): { isOpen: boolean; label: string } {
  const spec = COMMODITIES[commodity];
  if (!spec) return { isOpen: false, label: "Unknown" };

  const now = new Date();
  const day = now.getUTCDay();
  const minutesUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
  const openMinutes = spec.marketOpen.hour * 60 + spec.marketOpen.minute;
  const closeMinutes = spec.marketClose.hour * 60 + spec.marketClose.minute;

  const isWeekday = day >= 1 && day <= 5;
  const inHours = minutesUTC >= openMinutes && minutesUTC < closeMinutes;
  const isOpen = isWeekday && inHours;

  if (isOpen) {
    const minsLeft = closeMinutes - minutesUTC;
    const hoursLeft = Math.round(minsLeft / 60);
    return { isOpen: true, label: hoursLeft > 1 ? `Next update in ${hoursLeft}h` : "Next update in <1h" };
  }

  let daysUntilOpen = 0;
  if (day === 5 && minutesUTC >= closeMinutes) daysUntilOpen = 2;
  else if (day === 6) daysUntilOpen = 2;
  else if (day === 0) daysUntilOpen = 1;
  else if (minutesUTC >= closeMinutes) daysUntilOpen = 1;

  const nextOpen = new Date(now);
  nextOpen.setUTCDate(nextOpen.getUTCDate() + daysUntilOpen);
  nextOpen.setUTCHours(spec.marketOpen.hour, spec.marketOpen.minute, 0, 0);

  const hoursUntil = Math.round((nextOpen.getTime() - now.getTime()) / 3600_000);
  if (hoursUntil <= 12) {
    return { isOpen: false, label: `Next update in ${hoursUntil}h` };
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const openDay = dayNames[nextOpen.getUTCDay()];
  const openHour = spec.marketOpen.hour;
  const ampm = openHour >= 12 ? "PM" : "AM";
  const hour12 = openHour === 0 ? 12 : openHour > 12 ? openHour - 12 : openHour;
  const minStr = spec.marketOpen.minute > 0 ? `:${spec.marketOpen.minute.toString().padStart(2, "0")}` : "";
  return { isOpen: false, label: `Next update ${openDay} ${hour12}${minStr} ${ampm} ${spec.timezone}` };
}
