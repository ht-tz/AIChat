"use client";

import { useSettingsStore, type ThemeId } from "@/stores/settings";
import { useEffect } from "react";

const DARK_THEMES: ThemeId[] = ["cyber-dark", "ocean", "forest", "sunset", "midnight"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    if (DARK_THEMES.includes(theme)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
