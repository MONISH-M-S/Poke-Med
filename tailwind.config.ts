import type { Config } from "tailwindcss";

/** Every colour is an RGB triplet CSS variable so light/dark themes swap in CSS. */
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("--c-ink"),
        muted: v("--c-muted"),
        paper: v("--c-paper"),
        surface: v("--c-surface"),
        line: v("--c-line"),
        brand: {
          50: v("--c-brand-50"),
          100: v("--c-brand-100"),
          500: v("--c-brand-500"),
          600: v("--c-brand-600"),
          700: v("--c-brand-700"),
          900: v("--c-brand-900"),
          hover: v("--c-brand-hover"),
        },
        alert: v("--c-alert"),
        "alert-solid": v("--c-alert-solid"),
        "alert-hover": v("--c-alert-hover"),
        warn: v("--c-warn"),
        "on-amber": v("--c-on-amber"),
        red: {
          50: v("--c-red-50"),
          100: v("--c-red-100"),
          200: v("--c-red-200"),
          900: v("--c-red-900"),
        },
        amber: {
          50: v("--c-amber-50"),
          100: v("--c-amber-100"),
          200: v("--c-amber-200"),
          300: v("--c-amber-300"),
          400: v("--c-amber-400"),
          500: v("--c-amber-500"),
          900: v("--c-amber-900"),
        },
        emerald: { 400: v("--c-emerald-400") },
        logo: {
          navy: v("--c-logo-navy"),
          teal: v("--c-logo-teal"),
          orange: v("--c-logo-orange"),
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans",
          "Noto Sans Tamil",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--c-shadow) / .06), 0 8px 24px rgb(var(--c-shadow) / .06)",
      },
    },
  },
  plugins: [],
};

export default config;
