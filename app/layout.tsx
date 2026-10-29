import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import DemoPanel from "@/components/DemoPanel";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider, ThemeBoot } from "@/components/Theme";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "PokéMed — a medication companion for families",
  description:
    "Scan a prescription, build a schedule, and let the family see that the medicines were taken. Decision support, not medical advice.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Light is the app default, so the browser chrome matches it. The theme
  // toggle is an in-app choice and does not change the OS preference.
  themeColor: "#f6f7f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeBoot />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>
            <Nav />
            <main className="pb-24">{children}</main>
            <footer className="border-t border-line bg-surface">
              <div className="container-app flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2">
                  <LogoMark size={20} className="shrink-0" />
                  <span>
                    <strong className="text-ink">PokéMed</strong> · a medication companion for elderly people and their
                    families.
                  </span>
                </p>
                <p className="max-w-xl sm:text-right">
                  Decision support, not medical advice. PokéMed does not diagnose, prescribe, or replace a doctor or
                  pharmacist.
                </p>
              </div>
            </footer>
            <DemoPanel />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
