import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashReto · Aprende jugando",
  description: "Crea flashcards, organiza tus temas, estudia y prueba partidas de preguntas.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
