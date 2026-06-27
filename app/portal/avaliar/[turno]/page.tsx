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
import { PortalNav } from "@/app/components/PortalNav";

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
      <PortalNav email={session.email} atual="/portal/turnos" sub="Avaliar turno" />

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
