import { usePrice } from "@/hooks/usePrice";
import { type ColorScheme } from "@/theme/colors";
import { fontFamily } from "@/theme/tokens";

export function PriceDisplay({ colors }: { colors: ColorScheme }) {
  const { price, direction } = usePrice();

  if (!price) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: colors.textMuted }}>
        Loading price...
      </div>
    );
  }

  const dirColor =
    direction === "up"
      ? colors.profit
      : direction === "down"
        ? colors.loss
        : colors.text;

  return (
    <div style={{ padding: "24px 0" }}>
      <div
        style={{
          fontSize: 14,
          color: colors.textMuted,
          fontFamily: fontFamily.body,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Palm Oil (FCPO) — USD / MT
      </div>
      <div
        style={{
          fontSize: 48,
          fontFamily: fontFamily.display,
          fontWeight: 700,
          color: dirColor,
          transition: "color 0.3s ease",
          lineHeight: 1,
        }}
      >
        ${price.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div
        style={{
          fontSize: 12,
          color: colors.textSubtle,
          fontFamily: fontFamily.mono,
          marginTop: 8,
        }}
      >
        {price.source === "mock" ? "Simulated" : "Databento FCPO"} ·{" "}
        {new Date(price.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
