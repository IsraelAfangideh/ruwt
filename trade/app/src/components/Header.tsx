import { type ColorScheme } from "@/theme/colors";
import { fontFamily, spacing } from "@/theme/tokens";

interface HeaderProps {
  colors: ColorScheme;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ colors, isDark, onToggleTheme }: HeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: fontFamily.display,
            color: colors.accent,
          }}
        >
          ruwt
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            fontFamily: fontFamily.body,
            color: colors.textMuted,
          }}
        >
          trade
        </span>
      </div>
      <button
        onClick={onToggleTheme}
        style={{
          background: "none",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 14,
          color: colors.textMuted,
          cursor: "pointer",
        }}
        aria-label="Toggle theme"
      >
        {isDark ? "Light" : "Dark"}
      </button>
    </header>
  );
}
