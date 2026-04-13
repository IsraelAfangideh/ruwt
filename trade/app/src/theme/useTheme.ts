import { useState, useEffect, useCallback } from "react";
import { colors, type ThemeMode, type ColorScheme } from "./colors";

const STORAGE_KEY = "ruwt-trade-theme";

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getSavedTheme(): ThemeMode | null {
  try {
    return localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  } catch {
    return null;
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(
    () => getSavedTheme() || getSystemTheme()
  );

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  // Apply to document
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    document.body.style.backgroundColor =
      mode === "dark" ? colors.dark.bg : colors.light.bg;
    document.body.style.color =
      mode === "dark" ? colors.dark.text : colors.light.text;
  }, [mode]);

  const c: ColorScheme = colors[mode];
  const isDark = mode === "dark";

  return { colors: c, isDark, mode, setMode, toggle };
}
