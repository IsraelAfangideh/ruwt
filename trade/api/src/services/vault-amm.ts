import { orderBook, VAULT_MAKER } from "./orderbook.js";
import { getLatestPrice, fromScaled } from "./oracle.js";
import * as chain from "./chain.js";
const SPREAD_BPS = 100; // 1% total spread = 0.5% each side
const MAX_VAULT_ORDER_USDT = 100; // max single order size

/**
 * Vault Automated Market Maker.
 * Posts bid and ask orders around the oracle price with a 2% spread.
 * Called every time the oracle price updates.
 *
 * Vault ask = oracle * 1.005 (users buy at this price)
 * Vault bid = oracle * 0.995 (users sell at this price)
 */
export function updateVaultQuotes(availableCapacity: number): void {
  let oraclePrice: number;
  try {
    oraclePrice = getLatestPrice().priceUsd;
  } catch {
    return; // No price yet
  }

  // Cancel all existing vault orders
  orderBook.cancelMakerOrders(VAULT_MAKER);

  const halfSpreadMult = SPREAD_BPS / 2 / 10_000; // 0.01
  const askPrice = round(oraclePrice * (1 + halfSpreadMult));
  const bidPrice = round(oraclePrice * (1 - halfSpreadMult));

  // Post ask — limited by available vault capacity (how much more OI vault can absorb)
  if (availableCapacity > 0) {
    const askSize = Math.min(availableCapacity, MAX_VAULT_ORDER_USDT);
    orderBook.placeOrder(VAULT_MAKER, "ask", askPrice, askSize);
  }

  // Post bid — vault can always buy back positions (receives margin, no new capital needed)
  orderBook.placeOrder(VAULT_MAKER, "bid", bidPrice, MAX_VAULT_ORDER_USDT);
}

/** Get the current vault bid/ask prices without modifying the book. */
export function getVaultQuotes(): {
  bid: number | null;
  ask: number | null;
  oraclePrice: number | null;
  lastTradePrice: number | null;
  spreadPercent: number | null;
} {
  let oraclePrice: number | null = null;
  try {
    oraclePrice = getLatestPrice().priceUsd;
  } catch {
    // No price yet
  }

  const bbo = orderBook.getBBO();

  return {
    bid: bbo.bestBid,
    ask: bbo.bestAsk,
    oraclePrice,
    lastTradePrice: orderBook.lastTradePrice,
    spreadPercent: orderBook.getSpreadPercent(),
  };
}

/** Fetch vault capacity from chain and refresh quotes. */
export async function refreshVaultQuotes(): Promise<void> {
  try {
    const stats = await chain.getVaultStats();
    updateVaultQuotes(fromScaled(stats.capacity));
  } catch (err) {
    console.warn("[amm] quote refresh failed:", err);
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
