import { usePrice } from "@/hooks/usePrice";
import { type ColorScheme } from "@/theme/colors";
import { fontFamily } from "@/theme/tokens";
import { fmtPrice } from "@/lib/format";

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
        ${fmtPrice(price.marketPrice)}
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 12,
          fontSize: 14,
          fontFamily: fontFamily.mono,
        }}
      >
        {price.bid && (
          <div>
            <span style={{ fontSize: 11, color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Sell{" "}
            </span>
            <span style={{ color: colors.loss, fontWeight: 600 }}>
              ${fmtPrice(price.bid)}
            </span>
          </div>
        )}
        {price.ask && (
          <div>
            <span style={{ fontSize: 11, color: colors.textSubtle, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Buy{" "}
            </span>
            <span style={{ color: colors.profit, fontWeight: 600 }}>
              ${fmtPrice(price.ask)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
