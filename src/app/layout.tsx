import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Instrument Sans, from the owner's redesign canvas. One family for both body
// and headings — the design uses weight and tracking for hierarchy rather
// than a second face.
const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
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
  description: "Job work register for Jainam Creation",
  // iOS ignores the web manifest entirely: it needs these to open the app
  // full screen from the home screen and to label the icon.
  appleWebApp: {
    capable: true,
    title: "Jainam",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Tints the phone's status bar to match the page header. Same value as the
  // manifest's theme_color — they describe the same surface.
  themeColor: "#F3F6F5",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
