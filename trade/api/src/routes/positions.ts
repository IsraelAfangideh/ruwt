import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { getLatestPrice, USDT_DECIMALS } from "../services/oracle.js";
import * as chain from "../services/chain.js";

const router = Router();

const fromScaled = (value: bigint): number => Number(value) / 10 ** USDT_DECIMALS;

const OpenSchema = z.object({
  trader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.number().positive().max(100),
});

const CloseSchema = z.object({
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

/** POST /api/positions/open — open a long at current oracle price */
router.post("/open", async (req, res) => {
  try {
    const { trader, amount } = OpenSchema.parse(req.body);
    const price = getLatestPrice();

    const marginScaled = BigInt(Math.round(amount * 10 ** USDT_DECIMALS));

    const { positionId, txHash } = await chain.openLong(
      trader,
      marginScaled,
      price.priceScaled
    );

    res.json({
      positionId: positionId.toString(),
      entryPrice: price.priceUsd,
      margin: amount,
      txHash,
    });
  } catch (err) {
    handleError(res, err);
  }
});

/** POST /api/positions/close — close a position at current oracle price */
router.post("/close", async (req, res) => {
  try {
    const { positionId } = CloseSchema.parse(req.body);

    // Pre-flight: check position is active before sending on-chain tx
    const pos = await chain.getPosition(BigInt(positionId));
    if (!pos.active) {
      res.status(400).json({ error: "Position not active" });
      return;
    }

    const price = getLatestPrice();
    const { txHash } = await chain.closeLong(
      BigInt(positionId),
      price.priceScaled
    );

    res.json({
      positionId,
      exitPrice: price.priceUsd,
      txHash,
    });
  } catch (err) {
    handleError(res, err);
  }
});

/** GET /api/positions/:id — get position details + unrealized PnL */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
      res.status(400).json({ error: "Invalid position ID" });
      return;
    }

    const positionId = BigInt(id);
    const pos = await chain.getPosition(positionId);

    // Nonexistent positions return zero-address trader
    if (pos.trader === ethers.ZeroAddress) {
      res.status(404).json({ error: "Position not found" });
      return;
    }

    const margin = fromScaled(pos.margin);
    const entryPrice = fromScaled(pos.entryPrice);
    const currentPrice = getLatestPrice().priceUsd;

    const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    const pnlUsd = margin * (currentPrice - entryPrice) / entryPrice;

    res.json({
      positionId: id,
      trader: pos.trader,
      margin,
      entryPrice,
      currentPrice,
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
