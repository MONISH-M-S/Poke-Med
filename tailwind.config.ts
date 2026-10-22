import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13201e",
        muted: "#5b6b68",
        paper: "#f6f7f4",
        line: "#dde3df",
        brand: {
          50: "#eef7f4",
          100: "#d6ece5",
          500: "#0f766e",
          600: "#0d6b5f",
          700: "#0b5a50",
          900: "#083b35",
        },
        alert: "#b3261e",
        warn: "#a15c07",
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
        card: "0 1px 2px rgba(19,32,30,.06), 0 8px 24px rgba(19,32,30,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
