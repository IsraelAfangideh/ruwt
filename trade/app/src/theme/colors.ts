/**
 * Ruwt Trade color system — shared warm cream/dark palette with gold accent,
 * extended with trading-specific green/red for P&L.
 */
export const colors = {
  light: {
    bg: "#f5f3f0",
    bgWarm: "#ebe8e4",
    bgElevated: "#ffffff",
    text: "#1a1816",
    textMuted: "#54504a",
    textSubtle: "#5e5953",
    accent: "#846a30",
    accentMuted: "#7d6430",
    accentBg: "rgba(154, 123, 60, 0.1)",
    border: "rgba(26, 24, 22, 0.08)",
    borderStrong: "rgba(26, 24, 22, 0.15)",
    card: "#ffffff",
    cardForeground: "#1a1816",
    error: "#994444",
    success: "#356035",
    // Trading colors
    profit: "#16a34a",
    profitBg: "rgba(22, 163, 74, 0.08)",
    loss: "#dc2626",
    lossBg: "rgba(220, 38, 38, 0.08)",
  },
  dark: {
    bg: "#0f0e0d",
    bgWarm: "#1a1816",
    bgElevated: "#252220",
    text: "#e8e4df",
    textMuted: "#a8a198",
    textSubtle: "#96908a",
    accent: "#c9a962",
    accentMuted: "#a08745",
    accentBg: "rgba(201, 169, 98, 0.12)",
    border: "rgba(232, 228, 223, 0.08)",
    borderStrong: "rgba(232, 228, 223, 0.15)",
    card: "#252220",
    cardForeground: "#e8e4df",
    error: "#c87878",
    success: "#7ab87a",
    // Trading colors — brighter in dark mode
    profit: "#00f0aa",
    profitBg: "rgba(0, 240, 170, 0.1)",
    loss: "#ff3366",
    lossBg: "rgba(255, 51, 102, 0.1)",
  },
} as const;

export type ColorScheme = (typeof colors)["light"] | (typeof colors)["dark"];
export type ThemeMode = "light" | "dark";
