// TELA DE AVALIAÇÃO DE UM TURNO (S6 · empresa logada). GATED POR SESSÃO.
// Carrega o turno avaliável (do próprio estabelecimento, dia passado, sem avaliação viva)
// e monta o form. Sem sessão → /entrar. Turno inválido/já avaliado → volta pra lista.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../../portal.css";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerTurnoParaAvaliar } from "@/lib/avaliacao";
import AvaliarForm from "./AvaliarForm";
import { BrandMark } from "@/app/components/BrandMark";

export const metadata: Metadata = {
  title: "A7Pro · Avaliar turno",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const EMPRESA = "Blue";

function dataFmt(d: string | null): string {
  if (!d) return "—";
  const [a, mo, da] = d.split("-").map(Number);
  return `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${a}`;
}

export default async function AvaliarPage({ params }: { params: { turno: string } }) {
  const session = getSession();
  if (!session) redirect("/entrar");
  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) redirect("/entrar?status=sem-acesso");

  const turnoId = Number(params.turno);
  if (!turnoId) redirect("/portal/turnos");

  const turno = await lerTurnoParaAvaliar(EMPRESA, turnoId);
  // turno inexistente, de outra empresa, ainda não vencido OU já avaliado → não vaza nada,
  // só manda de volta pra lista.
  if (!turno) redirect("/portal/turnos");

  return (
    <>
      <header>
        <div className="hd">
          <div className="logo"><BrandMark size={24} sub="Avaliar turno" /></div>
          <div className="who">{session.email} · <b>Plano Fundador</b><br />
            <a href="/portal/turnos" style={{ color: "#9b9c9e", fontSize: 11.5 }}>← Turnos a avaliar</a> · <a href="/api/auth/sair" style={{ color: "#9b9c9e", fontSize: 11.5 }}>Sair</a>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: 22, paddingBottom: 40 }}>
        <section className="panel">
          <div className="ttl">Como foi o turno?</div>
          <p className="lead" style={{ margin: "4px 0 2px", fontSize: 14.5 }}>
            <b>{turno.nome}</b> · {turno.funcao ?? "—"} · {turno.estabelecimento} · turno de <b>{dataFmt(turno.dataDoTurno)}</b>
          </p>
          <AvaliarForm
            turnoId={turno.turnoId}
            nome={turno.nome}
            primeiroNome={turno.primeiroNome}
          />
        </section>
      </main>
    </>
  );
}
