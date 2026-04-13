import { Router } from "express";
import { getAllPrices, getMarketStatus } from "../services/oracle.js";
import { getQuotes } from "../services/vault-amm.js";

const router = Router();

/** GET /api/prices/current?commodity=PALM_OIL — market price + bid/ask spread */
router.get("/current", (req, res) => {
  const commodity = (req.query.commodity as string) || "PALM_OIL";
  const quotes = getQuotes(commodity);

  if (quotes.oraclePrice === null) {
    res.status(503).json({ error: `Price feed not ready for ${commodity}` });
    return;
  }

  const market = getMarketStatus(commodity);

  res.json({
    commodity,
    marketPrice: quotes.lastTradePrice ?? quotes.oraclePrice,
    oraclePrice: quotes.oraclePrice,
    bid: quotes.bid,
    ask: quotes.ask,
    spreadPercent: quotes.spreadPercent,
    marketOpen: market.isOpen,
    marketStatus: market.label,
    timestamp: Date.now(),
  });
});

/** GET /api/prices/all — all commodity prices */
router.get("/all", (_req, res) => {
  const all = getAllPrices();
  const result = Object.entries(all).map(([commodity, data]) => ({
    commodity,
    ticker: data.ticker,
    priceUsd: data.priceUsd,
    source: data.source,
    timestamp: data.timestamp,
  }));
  res.json(result);
});

export default router;
