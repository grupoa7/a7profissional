import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A7Pro · Banco de Talentos",
  description:
    "Complete sua escala com quem já provou que aparece. Profissionais com histórico verificado, prontos pra cobrir folga, pico e os dias de maior venda.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
