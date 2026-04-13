import { Router } from "express";
import { getVaultQuotes } from "../services/vault-amm.js";

const router = Router();

/** GET /api/prices/current — market price + bid/ask spread */
router.get("/current", (_req, res) => {
  const quotes = getVaultQuotes();

  if (quotes.oraclePrice === null) {
    res.status(503).json({ error: "Price feed not ready" });
    return;
  }

  res.json({
    commodity: "PALM_OIL",
    marketPrice: quotes.lastTradePrice ?? quotes.oraclePrice,
    oraclePrice: quotes.oraclePrice,
    bid: quotes.bid,
    ask: quotes.ask,
    spreadPercent: quotes.spreadPercent,
    timestamp: Date.now(),
  });
});

export default router;
