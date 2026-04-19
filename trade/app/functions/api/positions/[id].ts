import { ethers } from "ethers";
import type { Env } from "../../_shared/env";
import { getPrice, computeQuotes } from "../../_shared/oracle";
import { getPosition, fromScaled } from "../../_shared/chain";

/** GET /api/positions/:id?commodity=PALM_OIL */
export async function onRequestGet(context: { request: Request; env: Env; params: { id: string } }) {
  try {
    const id = context.params.id;
    if (!/^\d+$/.test(id)) {
      return Response.json({ error: "Invalid position ID" }, { status: 400 });
    }

    const url = new URL(context.request.url);
    const commodity = url.searchParams.get("commodity") || "PALM_OIL";

    const pos = await getPosition(context.env, BigInt(id));

    if (pos.trader === ethers.ZeroAddress) {
      return Response.json({ error: "Position not found" }, { status: 404 });
    }

    const margin = fromScaled(pos.margin);
    const entryPrice = fromScaled(pos.entryPrice);

    const price = await getPrice(context.env, commodity);
    const { bid } = computeQuotes(price.priceUsd);
    const markPrice = bid;

    const pnlPercent = ((markPrice - entryPrice) / entryPrice) * 100;
    const pnlUsd = margin * (markPrice - entryPrice) / entryPrice;

    return Response.json({
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
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
