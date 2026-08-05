import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finanzas — Controla tus gastos e ingresos",
  description:
    "Aplicación personal de finanzas para registrar gastos e ingresos, organizarlos por categorías y ver estadísticas.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e13",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)]">{children}</body>
    </html>
  );
}
