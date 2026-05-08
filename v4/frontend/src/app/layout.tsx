import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamPlanner",
  description: "Gestión de turnos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
