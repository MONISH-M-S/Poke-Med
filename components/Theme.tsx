"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Light is the default. Dark is opt-in and remembered per browser.
 * The first paint is handled by the inline script in <head> (see
 * ThemeBoot), so there is no flash of the wrong theme.
 */
type Theme = "light" | "dark";

const STORAGE_KEY = "pokemed-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") setThemeState(stored);
    } catch {
      /* storage blocked — stay on the light default */
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/** Runs before hydration so the correct theme is painted on first render. */
export function ThemeBoot() {
  // Light is the unconditional default. Dark is only ever reached by an
  // explicit choice that we then remember — never by OS preference.
  const code = `try{document.documentElement.dataset.theme=localStorage.getItem("pokemed-theme")==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

const SunIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <path
      d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

/** A labelled control, never a bare icon: the current theme is spelled out. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-2 rounded-lg border border-line bg-surface font-semibold text-ink transition hover:bg-brand-50 ${
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
      }`}
    >
      {theme === "dark" ? SunIcon : MoonIcon}
      {/* The word stays visible so the state never depends on the icon alone. */}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
