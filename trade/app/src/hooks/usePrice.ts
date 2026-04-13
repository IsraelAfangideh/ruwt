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
        const current = data.marketPrice;
        if (prevPrice.current !== null) {
          setDirection(
            current > prevPrice.current
              ? "up"
              : current < prevPrice.current
                ? "down"
                : null
          );
        }
        prevPrice.current = current;
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
