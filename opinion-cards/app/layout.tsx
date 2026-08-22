import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Serif } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const grotesk = Archivo({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Opinion Cards",
  description: "Vote sur des opinions. Decouvre si tu penses comme les autres.",
  openGraph: {
    title: "Opinion Cards",
    description: "Vote sur des opinions. Decouvre si tu penses comme les autres.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${serif.variable} ${grotesk.variable}`}>
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
