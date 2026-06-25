// Página pública do PERFIL-CALENDÁRIO (S2 · sem login). O link mágico É a chave.
// O servidor valida o token (purpose:"calendar"), carrega a disponibilidade viva
// (pré-marcada da semente do banco na 1ª vez) e entrega ao componente caloroso.
// Nada de outro titular trafega — o card vem SÓ do token assinado.
import type { Metadata } from "next";
import { verifyCalendarToken } from "@/lib/auth";
import { lerDisponibilidade } from "@/lib/calendario";
import Calendario from "./Calendario";
import "./calendario.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minha disponibilidade · a7pro",
  robots: { index: false, follow: false }, // link pessoal — fora dos buscadores
};

export default async function Page({ params }: { params: { token: string } }) {
  const payload = verifyCalendarToken(params.token);

  if (!payload) {
    return (
      <main className="cal-wrap">
        <div className="cal-card cal-invalid">
          <div className="cal-logo">
            <span className="cal-logo-badge">a7</span>pro
          </div>
          <h1>Esse link não está mais valendo 😕</h1>
          <p>
            Pode ser que ele tenha expirado. Chama a gente que a gente te manda um
            novinho — leva um minuto.
          </p>
        </div>
      </main>
    );
  }

  const view = await lerDisponibilidade(payload.card);

  return (
    <main className="cal-wrap">
      <Calendario token={params.token} initial={view} />
    </main>
  );
}
