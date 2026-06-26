import type { Metadata } from "next";
import { siteUrl } from "./site";

// Metadata COMPARTILHADO das telas de convite (/t/convite/[token] e /c/[slug]).
// A capa (Open Graph) é o que o WhatsApp mostra quando o link chega — precisa transmitir
// LEGITIMIDADE pro trabalhador (senão acha que é golpe). Conteúdo GENÉRICO de propósito:
// a capa NÃO revela bairro/valor/empresa (o link pode ser encaminhado) — só convida a abrir.
const ogImage = `${siteUrl.replace(/\/$/, "")}/og/convite.png`;

export const conviteMetadata: Metadata = {
  title: "Uma oportunidade de diária pra você · A7Pro",
  description:
    "Veja os detalhes da diária e diga se você tem interesse. Rápido e sem compromisso — pelo A7Pro.",
  robots: { index: false, follow: false }, // convite pessoal — fora dos buscadores
  openGraph: {
    title: "Tem uma diária com a sua cara",
    description:
      "Abra para ver o dia, o horário, o bairro e o valor — e diga se você tem interesse. É pelo A7Pro, sem compromisso.",
    siteName: "A7Pro",
    type: "website",
    locale: "pt_BR",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "A7Pro — oportunidade de diária" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tem uma diária com a sua cara",
    description: "Abra para ver os detalhes e dizer se você tem interesse — pelo A7Pro.",
    images: [ogImage],
  },
};
