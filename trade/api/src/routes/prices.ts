import { Router } from "express";
import { getLatestPrice } from "../services/oracle.js";

const router = Router();

/** GET /api/prices/current — latest palm oil price */
router.get("/current", (_req, res) => {
  try {
    const price = getLatestPrice();
    res.json({
      commodity: price.commodity,
      priceUsd: price.priceUsd,
      source: price.source,
      timestamp: price.timestamp,
    });
  } catch {
    res.status(503).json({ error: "Price feed not ready" });
  }
});

export default router;
