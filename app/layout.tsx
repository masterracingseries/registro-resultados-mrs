import type { Metadata } from "next";
import { Titillium_Web } from "next/font/google";
import "./globals.css";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-titillium",
});

export const metadata: Metadata = {
  title: "MRS Result System",
  description: "Master Racing Series — Registro de Resultados F1 25",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full antialiased ${titillium.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
