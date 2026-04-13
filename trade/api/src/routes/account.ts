import { Router } from "express";
import { ethers } from "ethers";
import { USDT_DECIMALS } from "../services/oracle.js";
import * as chain from "../services/chain.js";

const router = Router();

const fromScaled = (value: bigint): number => Number(value) / 10 ** USDT_DECIMALS;

/** GET /api/account/:address — trader balance + vault stats */
router.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      res.status(400).json({ error: "Invalid Ethereum address" });
      return;
    }

    const [balance, stats] = await Promise.all([
      chain.getTraderBalance(address),
      chain.getVaultStats(),
    ]);

    res.json({
      trader: address,
      balanceUsdt: fromScaled(balance),
      vault: {
        balanceUsdt: fromScaled(stats.vaultBalance),
        openInterestUsdt: fromScaled(stats.totalOI),
        capacityUsdt: fromScaled(stats.capacity),
        totalPositions: Number(stats.nextPositionId),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
