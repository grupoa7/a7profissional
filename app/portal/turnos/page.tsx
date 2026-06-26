// LISTA DE TURNOS A AVALIAR (S6 · empresa logada). GATED POR SESSÃO.
// Mostra os turnos do estabelecimento cujo dia já passou (data <= hoje) e que ainda não
// têm avaliação viva. Cada um leva pra /portal/avaliar/[turno]. No-show entra aqui também.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../portal.css";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerTurnosParaAvaliar } from "@/lib/avaliacao";
import { BrandMark } from "@/app/components/BrandMark";

export const metadata: Metadata = {
  title: "A7Pro · Turnos a avaliar",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const EMPRESA = "Blue";

function dataFmt(d: string | null): string {
  if (!d) return "—";
  const [a, mo, da] = d.split("-").map(Number);
  return `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${a}`;
}

export default async function TurnosPage() {
  const session = getSession();
  if (!session) redirect("/entrar");
  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) redirect("/entrar?status=sem-acesso");

  let turnos: Awaited<ReturnType<typeof lerTurnosParaAvaliar>> = [];
  let erro = false;
  try {
    turnos = await lerTurnosParaAvaliar(EMPRESA);
  } catch {
    erro = true;
  }

  return (
    <>
      <header>
        <div className="hd">
          <div className="logo"><BrandMark size={24} sub="Turnos a avaliar" /></div>
          <div className="who">{session.email} · <b>Plano Fundador</b><br />
            <a href="/portal" style={{ color: "#9b9c9e", fontSize: 11.5 }}>← Voltar à busca</a> · <a href="/portal/pedidos" style={{ color: "#9b9c9e", fontSize: 11.5 }}>Meus pedidos</a> · <a href="/api/auth/sair" style={{ color: "#9b9c9e", fontSize: 11.5 }}>Sair</a>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="intro" style={{ paddingBottom: 4 }}>
          <div className="eyebrow"><span className="bar" /><span>Fechando o ciclo</span></div>
          <h1>Avalie os turnos que <span className="g">já aconteceram</span>.</h1>
          <p className="lead">Sua avaliação alimenta a reputação do profissional na plataforma. Leva 20 segundos e ajuda a próxima empresa a escolher melhor.</p>
        </section>

        {erro && (
          <div className="placeholder" style={{ marginTop: 8 }}>
            <div className="big">Não foi possível carregar os turnos agora.</div>
            Tente recarregar em instantes.
          </div>
        )}

        {!erro && turnos.length === 0 && (
          <div className="placeholder" style={{ marginTop: 8 }}>
            <div className="big">Nenhum turno pendente de avaliação.</div>
            Quando um turno reservado por você acontecer, ele aparece aqui pra avaliar.
          </div>
        )}

        {turnos.length > 0 && (
          <section className="panel" style={{ marginTop: 14 }}>
            <div className="ttl">{turnos.length} turno(s) a avaliar</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {turnos.map((t) => (
                <a
                  key={t.turnoId}
                  href={`/portal/avaliar/${t.turnoId}`}
                  style={{ textDecoration: "none", color: "inherit", border: "1px solid #ece7da", borderRadius: 12, padding: "13px 15px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b>{t.nome}</b>
                      {t.selo && t.selo !== "—" && <span className={`selo ${t.selo}`} style={{ flexShrink: 0 }}>{t.selo === "NOVATA" ? "NOVO" : t.selo}</span>}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 12.5, color: "#7a7b7e" }}>
                      {t.funcao ?? "—"} · {t.estabelecimento} · turno de <b style={{ color: "#46474b" }}>{dataFmt(t.dataDoTurno)}</b>
                    </div>
                  </div>
                  <span className="gobtn" style={{ flexShrink: 0, padding: "9px 16px", fontSize: 13 }}>Avaliar →</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
