import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { fromScaled, toScaled } from "../services/oracle.js";
import { getOrderBook, withTradeLock } from "../services/orderbook.js";
import { refreshVaultQuotes } from "../services/vault-amm.js";
import * as chain from "../services/chain.js";

const router = Router();

const VALID_COMMODITIES = ["PALM_OIL", "COCOA"] as const;

const BuySchema = z.object({
  trader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().positive().max(100),
  commodity: z.enum(VALID_COMMODITIES).default("PALM_OIL"),
});

const SellSchema = z.object({
  positionId: z.number().int().min(0),
  commodity: z.enum(VALID_COMMODITIES).default("PALM_OIL"),
});

function handleError(res: any, err: unknown): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: message });
}

/** POST /api/positions/buy — market buy at best ask */
router.post("/buy", async (req, res) => {
  try {
    const { trader, amount, commodity } = BuySchema.parse(req.body);
    const book = getOrderBook(commodity);

    await withTradeLock(async () => {
      const bbo = book.getBBO();
      if (bbo.bestAsk === null) {
        res.status(503).json({ error: "No sell liquidity available" });
        return;
      }

      const { trade } = book.placeOrder(trader, "bid", bbo.bestAsk, amount);
      if (!trade) {
        res.status(500).json({ error: "Order did not match" });
        return;
      }

      try {
        const marginScaled = toScaled(amount);
        const priceScaled = toScaled(trade.price);
        const { positionId, txHash } = await chain.openLong(trader, marginScaled, priceScaled);

        refreshVaultQuotes();

        res.json({
          positionId: positionId.toString(),
          commodity,
          tradePrice: trade.price,
          margin: amount,
          txHash,
        });
      } catch (chainErr) {
        await refreshVaultQuotes();
        throw chainErr;
      }
    });
  } catch (err) {
    if (!res.headersSent) handleError(res, err);
  }
});

/** POST /api/positions/sell — market sell at best bid */
router.post("/sell", async (req, res) => {
  try {
    const { positionId, commodity } = SellSchema.parse(req.body);
    const book = getOrderBook(commodity);

    const pos = await chain.getPosition(BigInt(positionId));
    if (!pos.active) {
      res.status(400).json({ error: "Position not active" });
      return;
    }

    await withTradeLock(async () => {
      const bbo = book.getBBO();
      if (bbo.bestBid === null) {
        res.status(503).json({ error: "No buy liquidity available" });
        return;
      }

      const margin = fromScaled(pos.margin);
      const { trade } = book.placeOrder(pos.trader, "ask", bbo.bestBid, margin, positionId);
      if (!trade) {
        res.status(500).json({ error: "Order did not match" });
        return;
      }

      try {
        const priceScaled = toScaled(trade.price);
        const { txHash } = await chain.closeLong(BigInt(positionId), priceScaled);

        refreshVaultQuotes();

        res.json({ positionId, commodity, tradePrice: trade.price, txHash });
      } catch (chainErr) {
        await refreshVaultQuotes();
        throw chainErr;
      }
    });
  } catch (err) {
    if (!res.headersSent) handleError(res, err);
  }
});

/** GET /api/positions/:id?commodity=PALM_OIL — position details + unrealized PnL at bid */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
      res.status(400).json({ error: "Invalid position ID" });
      return;
    }

    const commodity = (req.query.commodity as string) || "PALM_OIL";
    const pos = await chain.getPosition(BigInt(id));

    if (pos.trader === ethers.ZeroAddress) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    const margin = fromScaled(pos.margin);
    const entryPrice = fromScaled(pos.entryPrice);
    const book = getOrderBook(commodity);
    const bbo = book.getBBO();
    const markPrice = bbo.bestBid ?? entryPrice;

    const pnlPercent = ((markPrice - entryPrice) / entryPrice) * 100;
    const pnlUsd = margin * (markPrice - entryPrice) / entryPrice;

    res.json({
      positionId: id,
      commodity,
      trader: pos.trader,
      margin,
      entryPrice,
      markPrice,
      pnlUsd: Math.round(pnlUsd * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      active: pos.active,
      openedAt: Number(pos.openedAt),
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
