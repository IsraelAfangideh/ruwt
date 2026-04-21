import type { Env } from "../../_shared/env";
import { getPrice, computeQuotes, getMarketStatus } from "../../_shared/oracle";

/** GET /api/prices?commodity=PALM_OIL */
export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const url = new URL(context.request.url);
    const commodity = url.searchParams.get("commodity") || "PALM_OIL";

    const price = await getPrice(context.env, commodity);
    const quotes = computeQuotes(price.priceUsd);
    const market = getMarketStatus(commodity);

    return Response.json({
      commodity,
      marketPrice: price.priceUsd,
      oraclePrice: price.priceUsd,
      bid: quotes.bid,
      ask: quotes.ask,
      spreadPercent: quotes.spreadPercent,
      marketOpen: market.isOpen,
      marketStatus: market.label,
      source: price.source,
      timestamp: price.timestamp,
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 503 }
    );
  }
}
