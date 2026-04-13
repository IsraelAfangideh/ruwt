import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { fromScaled, toScaled } from "../services/oracle.js";
import { orderBook, withTradeLock, VAULT_MAKER } from "../services/orderbook.js";
import { refreshVaultQuotes } from "../services/vault-amm.js";
import * as chain from "../services/chain.js";

const router = Router();

const BuySchema = z.object({
  trader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().positive().max(100),
});

const SellSchema = z.object({
  positionId: z.number().int().min(0),
});

function handleError(res: any, err: unknown): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.issues });
    return;
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: message });
}

/**
 * POST /api/positions/buy — market buy at best ask.
 * Acquires trade lock → matches order → executes on-chain → refreshes quotes.
 * On chain failure, vault order is restored via quote refresh.
 */
router.post("/buy", async (req, res) => {
  try {
    const { trader, amount } = BuySchema.parse(req.body);

    await withTradeLock(async () => {
      const bbo = orderBook.getBBO();
      if (bbo.bestAsk === null) {
        res.status(503).json({ error: "No sell liquidity available" });
        return;
      }

      // Match against best ask
      const { trade } = orderBook.placeOrder(trader, "bid", bbo.bestAsk, amount);
      if (!trade) {
        res.status(500).json({ error: "Order did not match" });
        return;
      }

      try {
        const marginScaled = toScaled(amount);
        const priceScaled = toScaled(trade.price);
        const { positionId, txHash } = await chain.openLong(trader, marginScaled, priceScaled);

        // Refresh quotes after successful trade (async, don't block response)
        refreshVaultQuotes();

        res.json({
          positionId: positionId.toString(),
          tradePrice: trade.price,
          margin: amount,
          txHash,
        });
      } catch (chainErr) {
        // Chain tx failed — restore vault quotes so the consumed order is re-posted
        await refreshVaultQuotes();
        throw chainErr;
      }
    });
  } catch (err) {
    if (!res.headersSent) handleError(res, err);
  }
});

/**
 * POST /api/positions/sell — market sell at best bid.
 */
router.post("/sell", async (req, res) => {
  try {
    const { positionId } = SellSchema.parse(req.body);

    // Pre-flight: check position is active (read-only, no lock needed)
    const pos = await chain.getPosition(BigInt(positionId));
    if (!pos.active) {
      res.status(400).json({ error: "Position not active" });
      return;
    }

    await withTradeLock(async () => {
      const bbo = orderBook.getBBO();
      if (bbo.bestBid === null) {
        res.status(503).json({ error: "No buy liquidity available" });
        return;
      }

      const margin = fromScaled(pos.margin);
      const { trade } = orderBook.placeOrder(pos.trader, "ask", bbo.bestBid, margin, positionId);
      if (!trade) {
        res.status(500).json({ error: "Order did not match" });
        return;
      }

      try {
        const priceScaled = toScaled(trade.price);
        const { txHash } = await chain.closeLong(BigInt(positionId), priceScaled);

        refreshVaultQuotes();

        res.json({ positionId, tradePrice: trade.price, txHash });
      } catch (chainErr) {
        await refreshVaultQuotes();
        throw chainErr;
      }
    });
  } catch (err) {
    if (!res.headersSent) handleError(res, err);
  }
});

/** GET /api/positions/:id — position details + unrealized PnL at current bid */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
      res.status(400).json({ error: "Invalid position ID" });
      return;
    }

    const pos = await chain.getPosition(BigInt(id));

    if (pos.trader === ethers.ZeroAddress) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    const margin = fromScaled(pos.margin);
    const entryPrice = fromScaled(pos.entryPrice);
    const bbo = orderBook.getBBO();
    const markPrice = bbo.bestBid ?? entryPrice;

    const pnlPercent = ((markPrice - entryPrice) / entryPrice) * 100;
    const pnlUsd = margin * (markPrice - entryPrice) / entryPrice;

    res.json({
      positionId: id,
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
