import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import DemoPanel from "@/components/DemoPanel";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "PokéMed — a medication companion for families",
  description:
    "Scan a prescription, build a schedule, and let the family see that the medicines were taken. Decision support, not medical advice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d6b5f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ToastProvider>
          <Nav />
          <main className="pb-24">{children}</main>
          <footer className="border-t border-line bg-white">
            <div className="container-app flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong className="text-ink">PokéMed</strong> · a medication companion for elderly people and their
                families.
              </p>
              <p className="max-w-xl sm:text-right">
                Decision support, not medical advice. PokéMed does not diagnose, prescribe, or replace a doctor or
                pharmacist.
              </p>
            </div>
          </footer>
          <DemoPanel />
        </ToastProvider>
      </body>
    </html>
  );
}
