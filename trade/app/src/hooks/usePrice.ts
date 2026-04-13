import { useState, useEffect, useRef } from "react";
import { api, type PriceData } from "@/lib/api";

export function usePrice(intervalMs = 5000) {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPrice = useRef<number | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const data = await api.getPrice();
        if (!active) return;
        if (prevPrice.current !== null) {
          setDirection(
            data.priceUsd > prevPrice.current
              ? "up"
              : data.priceUsd < prevPrice.current
                ? "down"
                : null
          );
        }
        prevPrice.current = data.priceUsd;
        setPrice(data);
        setError(null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to fetch price");
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { price, error, direction };
}
