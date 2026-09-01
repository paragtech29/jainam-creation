import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Body text. Carried over from the owner's other app so the two feel related.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

// Headings only — heavier, slightly tighter than DM Sans.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

// Monospace is for figures: rates, pieces, totals. Tabular digits keep the
// numbers in a job work list vertically aligned, which matters a lot when
// the screen is a substitute for a hand-ruled ledger page.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jainam Creation",
  description: "Job work tracking for Jainam Creation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
