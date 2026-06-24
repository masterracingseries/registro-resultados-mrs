import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
