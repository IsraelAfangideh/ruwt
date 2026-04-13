import { type ColorScheme } from "@/theme/colors";
import { fontFamily, radii, spacing } from "@/theme/tokens";
import { type PositionData } from "@/lib/api";

interface PositionCardProps {
  colors: ColorScheme;
  position: PositionData;
  onClose: (positionId: number) => Promise<void>;
  closing: boolean;
}

export function PositionCard({
  colors,
  position,
  onClose,
  closing,
}: PositionCardProps) {
  const isProfit = position.pnlUsd >= 0;
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
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: spacing.md,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: fontFamily.body,
              color: colors.text,
            }}
          >
            LONG
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: fontFamily.mono,
              color: colors.textMuted,
              marginLeft: spacing.sm,
            }}
          >
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
          {isProfit ? "+" : ""}
          {position.pnlPercent.toFixed(2)}%
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        <Stat label="Entry" value={`$${position.entryPrice.toLocaleString()}`} colors={colors} />
        <Stat label="Current" value={`$${position.currentPrice.toLocaleString()}`} colors={colors} />
        <Stat label="Margin" value={`$${position.margin.toFixed(2)}`} colors={colors} />
        <Stat
          label="P&L"
          value={`${isProfit ? "+" : ""}$${position.pnlUsd.toFixed(2)}`}
          colors={colors}
          valueColor={pnlColor}
        />
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(parseInt(position.positionId))}
        disabled={closing}
        style={{
          width: "100%",
          padding: "12px 0",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: fontFamily.body,
          background: closing ? colors.bgWarm : colors.loss,
          color: closing ? colors.textSubtle : "#fff",
          border: "none",
          borderRadius: radii.md,
          cursor: closing ? "not-allowed" : "pointer",
          opacity: closing ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {closing ? "Closing..." : "Close Position"}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  colors,
  valueColor,
}: {
  label: string;
  value: string;
  colors: ColorScheme;
  valueColor?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: colors.textSubtle,
          fontFamily: fontFamily.body,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: fontFamily.mono,
          color: valueColor || colors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}
