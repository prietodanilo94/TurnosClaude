import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TeamPlanner",
  description: "Gestión de turnos",
  icons: {
    icon: [
      { url: "/tp-icon.svg", type: "image/svg+xml" },
      { url: "/tp-icon.png", type: "image/png" },
    ],
    apple: "/tp-icon.png",
    shortcut: "/tp-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
