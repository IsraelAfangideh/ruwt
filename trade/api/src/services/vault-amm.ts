import { getOrderBook, VAULT_MAKER } from "./orderbook.js";
import { getLatestPrice, getAllPrices, fromScaled } from "./oracle.js";
import * as chain from "./chain.js";

const SPREAD_BPS = 100; // 1% total spread = 0.5% each side
const MAX_VAULT_ORDER_USDT = 100;

/**
 * Update vault quotes for a single commodity.
 * Posts bid/ask around oracle price with a 1% spread.
 */
export function updateCommodityQuotes(commodity: string, availableCapacity: number): void {
  let oraclePrice: number;
  try {
    oraclePrice = getLatestPrice(commodity).priceUsd;
  } catch {
    return;
  }

  const book = getOrderBook(commodity);
  book.cancelMakerOrders(VAULT_MAKER);

  const halfSpreadMult = SPREAD_BPS / 2 / 10_000;
  const askPrice = round(oraclePrice * (1 + halfSpreadMult));
  const bidPrice = round(oraclePrice * (1 - halfSpreadMult));

  if (availableCapacity > 0) {
    const askSize = Math.min(availableCapacity, MAX_VAULT_ORDER_USDT);
    book.placeOrder(VAULT_MAKER, "ask", askPrice, askSize);
  }

  book.placeOrder(VAULT_MAKER, "bid", bidPrice, MAX_VAULT_ORDER_USDT);
}

/** Update vault quotes for all commodities. */
export function updateAllQuotes(availableCapacity: number): void {
  const all = getAllPrices();
  for (const commodity of Object.keys(all)) {
    updateCommodityQuotes(commodity, availableCapacity);
  }
}

/** Get the current bid/ask/prices for a commodity. */
export function getQuotes(commodity: string): {
  bid: number | null;
  ask: number | null;
  oraclePrice: number | null;
  lastTradePrice: number | null;
  spreadPercent: number | null;
} {
  let oraclePrice: number | null = null;
  try {
    oraclePrice = getLatestPrice(commodity).priceUsd;
  } catch {}

  const book = getOrderBook(commodity);
  const bbo = book.getBBO();

  return {
    bid: bbo.bestBid,
    ask: bbo.bestAsk,
    oraclePrice,
    lastTradePrice: book.lastTradePrice,
    spreadPercent: book.getSpreadPercent(),
  };
}

/** Fetch vault capacity from chain and refresh all quotes. */
export async function refreshVaultQuotes(): Promise<void> {
  try {
    const stats = await chain.getVaultStats();
    updateAllQuotes(fromScaled(stats.capacity));
  } catch (err) {
    console.warn("[amm] quote refresh failed:", err);
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
