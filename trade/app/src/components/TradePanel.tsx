import { useState } from "react";
import { type ColorScheme } from "@/theme/colors";
import { fontFamily, radii, spacing } from "@/theme/tokens";

interface TradePanelProps {
  colors: ColorScheme;
  balance: number;
  capacity: number;
  onBuy: (amount: number) => Promise<void>;
  loading: boolean;
}

const PRESET_AMOUNTS = [10, 25, 50, 100];

export function TradePanel({
  colors,
  balance,
  capacity,
  onBuy,
  loading,
}: TradePanelProps) {
  const [amount, setAmount] = useState("");
  const numAmount = parseFloat(amount) || 0;
  const maxAmount = Math.min(balance, capacity, 100);
  const valid = numAmount > 0 && numAmount <= maxAmount;

  return (
    <div
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.xl,
        padding: spacing.lg,
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          fontFamily: fontFamily.body,
          color: colors.text,
          marginBottom: spacing.md,
        }}
      >
        Buy Palm Oil
      </div>

      {/* Amount input */}
      <div style={{ marginBottom: spacing.md }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: colors.textMuted,
            marginBottom: spacing.xs,
            fontFamily: fontFamily.body,
          }}
        >
          Amount (USDT)
        </label>
        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: colors.textSubtle,
              fontFamily: fontFamily.mono,
              fontSize: 16,
            }}
          >
            $
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min={1}
            max={100}
            step={1}
            style={{
              width: "100%",
              padding: "12px 12px 12px 28px",
              fontSize: 20,
              fontFamily: fontFamily.mono,
              fontWeight: 600,
              background: colors.bgWarm,
              border: `1px solid ${colors.borderStrong}`,
              borderRadius: radii.md,
              color: colors.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Preset buttons */}
      <div
        style={{
          display: "flex",
          gap: spacing.sm,
          marginBottom: spacing.md,
        }}
      >
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(String(Math.min(preset, maxAmount)))}
            disabled={preset > maxAmount}
            style={{
              flex: 1,
              padding: "8px 0",
              fontSize: 13,
              fontFamily: fontFamily.mono,
              fontWeight: 500,
              background:
                numAmount === preset ? colors.accent : colors.bgWarm,
              color:
                numAmount === preset
                  ? "#fff"
                  : preset > maxAmount
                    ? colors.textSubtle
                    : colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
              cursor: preset > maxAmount ? "not-allowed" : "pointer",
              opacity: preset > maxAmount ? 0.5 : 1,
            }}
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Info row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontFamily: fontFamily.body,
          color: colors.textMuted,
          marginBottom: spacing.md,
          padding: `${spacing.sm}px 0`,
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <span>Your balance</span>
        <span style={{ fontFamily: fontFamily.mono, color: colors.text }}>
          ${balance.toFixed(2)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          fontFamily: fontFamily.body,
          color: colors.textMuted,
          marginBottom: spacing.md,
        }}
      >
        <span>Close fee</span>
        <span style={{ fontFamily: fontFamily.mono }}>3%</span>
      </div>

      {/* Buy button */}
      <button
        onClick={() => valid && onBuy(numAmount)}
        disabled={!valid || loading}
        style={{
          width: "100%",
          padding: "14px 0",
          fontSize: 16,
          fontWeight: 600,
          fontFamily: fontFamily.body,
          background: valid && !loading ? colors.profit : colors.bgWarm,
          color: valid && !loading ? "#fff" : colors.textSubtle,
          border: "none",
          borderRadius: radii.md,
          cursor: valid && !loading ? "pointer" : "not-allowed",
          opacity: loading ? 0.7 : 1,
          transition: "all 0.2s ease",
        }}
      >
        {loading ? "Opening position..." : "Buy Long"}
      </button>
    </div>
  );
}
