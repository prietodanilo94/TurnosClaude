import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift Optimizer v3",
  description: "Optimizer-first lab for v3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
