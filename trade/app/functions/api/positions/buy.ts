import type { Env } from "../../_shared/env";
import { getPrice, computeQuotes } from "../../_shared/oracle";
import { openLong, toScaled } from "../../_shared/chain";

/** POST /api/positions/buy — market buy at best ask */
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const { trader, amount, commodity = "PALM_OIL" } = body;

    if (!trader || !/^0x[a-fA-F0-9]{40}$/.test(trader)) {
      return Response.json({ error: "Invalid trader address" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0 || amount > 100) {
      return Response.json({ error: "Amount must be between 0 and 100" }, { status: 400 });
    }

    const price = await getPrice(context.env, commodity);
    const { ask } = computeQuotes(price.priceUsd);

    const marginScaled = toScaled(amount);
    const priceScaled = toScaled(ask);

    const { positionId, txHash } = await openLong(
      context.env,
      trader,
      marginScaled,
      priceScaled
    );

    return Response.json({
      positionId: positionId.toString(),
      commodity,
      tradePrice: ask,
      margin: amount,
      txHash,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
