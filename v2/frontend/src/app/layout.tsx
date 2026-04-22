import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift Optimizer v2",
  description: "Generador de turnos mensuales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
