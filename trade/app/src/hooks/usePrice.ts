import { useState, useEffect, useRef, useCallback } from "react";
import { api, type PriceData, type Commodity } from "@/lib/api";

// Cache prices per commodity so switching tabs is instant
const priceCache: Partial<Record<Commodity, PriceData>> = {};
const directionCache: Partial<Record<Commodity, "up" | "down" | null>> = {};

export function usePrice(commodity: Commodity = "PALM_OIL", intervalMs = 5000) {
  const [price, setPrice] = useState<PriceData | null>(priceCache[commodity] ?? null);
  const [direction, setDirection] = useState<"up" | "down" | null>(directionCache[commodity] ?? null);
  const [error, setError] = useState<string | null>(null);
  const prevPrice = useRef<number | null>(priceCache[commodity]?.marketPrice ?? null);

  // When commodity changes, immediately show cached data (no flash to null)
  useEffect(() => {
    setPrice(priceCache[commodity] ?? null);
    setDirection(directionCache[commodity] ?? null);
    prevPrice.current = priceCache[commodity]?.marketPrice ?? null;
  }, [commodity]);

  const poll = useCallback(async () => {
    try {
      const data = await api.getPrice(commodity);
      const current = data.marketPrice;
      let dir: "up" | "down" | null = null;
      if (prevPrice.current !== null) {
        dir = current > prevPrice.current ? "up" : current < prevPrice.current ? "down" : null;
      }
      prevPrice.current = current;

      // Update cache and state together
      priceCache[commodity] = data;
      directionCache[commodity] = dir;
      setPrice(data);
      setDirection(dir);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch price");
    }
  }, [commodity]);

  useEffect(() => {
    let active = true;
    const doPoll = () => { if (active) poll(); };
    doPoll();
    const id = setInterval(doPoll, intervalMs);
    return () => { active = false; clearInterval(id); };
  }, [poll, intervalMs]);

  return { price, error, direction };
}
