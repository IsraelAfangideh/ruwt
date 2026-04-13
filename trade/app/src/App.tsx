import { useState, useCallback, useEffect } from "react";
import { useTheme } from "@/theme/useTheme";
import { fontFamily, spacing, radii } from "@/theme/tokens";
import { Header } from "@/components/Header";
import { PriceDisplay } from "@/components/PriceDisplay";
import { TradePanel } from "@/components/TradePanel";
import { PositionCard } from "@/components/PositionCard";
import { api, type PositionData } from "@/lib/api";

// Demo trader address (replace with Privy wallet in prod)
const DEMO_TRADER = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

export default function App() {
  const { colors, isDark, toggle } = useTheme();
  const [balance, setBalance] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch account + positions
  const refresh = useCallback(async () => {
    try {
      const account = await api.getAccount(DEMO_TRADER);
      setBalance(account.balanceUsdt);
      setCapacity(account.vault.capacityUsdt);

      // Fetch active positions
      const posPromises: Promise<PositionData | null>[] = [];
      for (let i = 0; i < account.vault.totalPositions; i++) {
        posPromises.push(
          api.getPosition(String(i)).catch(() => null)
        );
      }
      const all = await Promise.all(posPromises);
      setPositions(
        all.filter(
          (p): p is PositionData =>
            p !== null && p.active && p.trader.toLowerCase() === DEMO_TRADER.toLowerCase()
        )
      );
    } catch {
      // API not connected yet — show empty state
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleBuy = async (amount: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.openLong(DEMO_TRADER, amount);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open position");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async (positionId: number) => {
    setClosing(String(positionId));
    setError(null);
    try {
      await api.closeLong(positionId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close position");
    } finally {
      setClosing(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        fontFamily: fontFamily.body,
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <Header colors={colors} isDark={isDark} onToggleTheme={toggle} />

      <main
        style={{
          maxWidth: 480,
          margin: "0 auto",
          padding: `${spacing.lg}px ${spacing.md}px`,
        }}
      >
        {/* Price */}
        <PriceDisplay colors={colors} />

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: spacing.md,
              marginBottom: spacing.md,
              background: colors.lossBg,
              border: `1px solid ${colors.loss}`,
              borderRadius: radii.md,
              color: colors.loss,
              fontSize: 14,
              fontFamily: fontFamily.body,
            }}
          >
            {error}
          </div>
        )}

        {/* Trade panel */}
        <TradePanel
          colors={colors}
          balance={balance}
          capacity={capacity}
          onBuy={handleBuy}
          loading={loading}
        />

        {/* Open positions */}
        {positions.length > 0 && (
          <div style={{ marginTop: spacing.xl }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontFamily: fontFamily.body,
                color: colors.text,
                marginBottom: spacing.md,
              }}
            >
              Open Positions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              {positions.map((pos) => (
                <PositionCard
                  key={pos.positionId}
                  colors={colors}
                  position={pos}
                  onClose={handleClose}
                  closing={closing === pos.positionId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {positions.length === 0 && balance > 0 && (
          <div
            style={{
              textAlign: "center",
              padding: `${spacing["2xl"]}px 0`,
              color: colors.textMuted,
              fontSize: 14,
            }}
          >
            No open positions. Buy palm oil above to get started.
          </div>
        )}

        {/* Vault info */}
        <div
          style={{
            marginTop: spacing.xl,
            padding: spacing.md,
            borderTop: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: colors.textSubtle,
            fontFamily: fontFamily.mono,
          }}
        >
          <span>Vault capacity: ${capacity.toFixed(2)}</span>
          <span>Your balance: ${balance.toFixed(2)}</span>
        </div>
      </main>
    </div>
  );
}
