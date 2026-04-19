import type { Env } from "../../_shared/env";
import { getPrice, computeQuotes } from "../../_shared/oracle";
import { closeLong, getPosition, toScaled } from "../../_shared/chain";

/** POST /api/positions/sell — market sell at best bid */
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const { positionId, commodity = "PALM_OIL" } = body;

    if (typeof positionId !== "number" || positionId < 0) {
      return Response.json({ error: "Invalid position ID" }, { status: 400 });
    }

    // Pre-flight check
    const pos = await getPosition(context.env, BigInt(positionId));
    if (!pos.active) {
      return Response.json({ error: "Position not active" }, { status: 400 });
    }

    const price = await getPrice(context.env, commodity);
    const { bid } = computeQuotes(price.priceUsd);

    const priceScaled = toScaled(bid);
    const { txHash } = await closeLong(context.env, BigInt(positionId), priceScaled);

    return Response.json({
      positionId,
      commodity,
      tradePrice: bid,
      txHash,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
