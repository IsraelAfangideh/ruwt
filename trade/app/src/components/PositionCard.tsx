import { type ColorScheme } from "@/theme/colors";
import { fontFamily, radii, spacing } from "@/theme/tokens";
import { type PositionData } from "@/lib/api";
import { fmtPrice } from "@/lib/format";

interface PositionCardProps {
  colors: ColorScheme;
  position: PositionData;
  bidPrice: number | null;
  onSell: (positionId: number) => Promise<void>;
  selling: boolean;
}

export function PositionCard({
  colors,
  position,
  bidPrice,
  onSell,
  selling,
}: PositionCardProps) {
  // P&L calculated against the actual sell price (bid), not midpoint
  const sellPrice = bidPrice ?? position.markPrice;
  const pnlUsd = position.margin * (sellPrice - position.entryPrice) / position.entryPrice;
  const pnlPercent = ((sellPrice - position.entryPrice) / position.entryPrice) * 100;
  const isProfit = pnlUsd >= 0;
  const pnlColor = isProfit ? colors.profit : colors.loss;
  const pnlBg = isProfit ? colors.profitBg : colors.lossBg;

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.xl,
        padding: spacing.lg,
        borderLeft: `3px solid ${pnlColor}`,
      }}
    >
      {/* Header: position label + P&L badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.sm,
        }}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: fontFamily.body, color: colors.text }}>
            LONG
          </span>
          <span style={{ fontSize: 12, fontFamily: fontFamily.mono, color: colors.textMuted, marginLeft: spacing.sm }}>
            #{position.positionId}
          </span>
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: radii.full,
            background: pnlBg,
            color: pnlColor,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: fontFamily.mono,
          }}
        >
          {isProfit ? "+" : ""}{pnlPercent.toFixed(2)}%
        </div>
      </div>

      {/* Primary: what you'll get if you sell now */}
      <div style={{ marginBottom: spacing.md }}>
        <div style={{ fontSize: 11, color: colors.textSubtle, fontFamily: fontFamily.body, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
          If you sell now
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: fontFamily.mono,
              color: pnlColor,
            }}
          >
            {isProfit ? "+$" : "-$"}{Math.abs(pnlUsd).toFixed(2)}
          </span>
          <span style={{ fontSize: 14, color: colors.textMuted, fontFamily: fontFamily.mono }}>
            on ${position.margin.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Secondary: entry vs sell price */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing.sm,
          marginBottom: spacing.md,
          padding: `${spacing.sm}px 0`,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: colors.textSubtle, fontFamily: fontFamily.body, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Bought at
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: fontFamily.mono, color: colors.text }}>
            ${fmtPrice(position.entryPrice)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: colors.textSubtle, fontFamily: fontFamily.body, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            Sell price
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: fontFamily.mono, color: pnlColor }}>
            ${fmtPrice(sellPrice)}
          </div>
        </div>
      </div>

      {/* Sell button */}
      <button
        onClick={() => onSell(parseInt(position.positionId))}
        disabled={selling || bidPrice === null}
        style={{
          width: "100%",
          padding: "14px 0",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: fontFamily.body,
          background: selling ? colors.bgWarm : colors.loss,
          color: selling ? colors.textSubtle : "#fff",
          border: "none",
          borderRadius: radii.md,
          cursor: selling ? "not-allowed" : "pointer",
          opacity: selling ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {selling
          ? "Selling..."
          : bidPrice
            ? `Sell at $${fmtPrice(bidPrice)}`
            : "No bid available"}
      </button>
    </div>
  );
}
