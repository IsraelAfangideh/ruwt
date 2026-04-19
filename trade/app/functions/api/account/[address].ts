import { ethers } from "ethers";
import type { Env } from "../../_shared/env";
import { getTraderBalance, getVaultStats, fromScaled } from "../../_shared/chain";

/** GET /api/account/:address */
export async function onRequestGet(context: { request: Request; env: Env; params: { address: string } }) {
  try {
    const { address } = context.params;
    if (!ethers.isAddress(address)) {
      return Response.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    const [balance, stats] = await Promise.all([
      getTraderBalance(context.env, address),
      getVaultStats(context.env),
    ]);

    return Response.json({
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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
