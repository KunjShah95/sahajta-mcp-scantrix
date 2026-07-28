import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AuthGate } from "@/components/auth/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scantrix — Invoice & Expense Management",
  description:
    "AI-assisted invoice scanning, QuickBooks sync, and team management for accountants and small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning here only ignores attribute-level mismatches
          on this one tag (e.g. browser extensions like Grammarly injecting
          data-gr-ext-installed/data-new-gr-c-s-check-loaded before React
          hydrates) — it does not suppress hydration mismatches anywhere else
          in the tree. See https://react.dev/link/hydration-mismatch. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
