import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../portal.css";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerPedidos, lerPedido } from "@/lib/pedidos";
import { montarPool, type PoolResult } from "@/lib/match";

export const metadata: Metadata = {
  title: "A7Pro · Meus pedidos",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function dataFmt(d: string | null): string {
  if (!d) return "—";
  const [, mo, da] = d.split("-").map(Number);
  return `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}`;
}
function fimDe(hhmm: string | null): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + 9 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export default async function PedidosPage({ searchParams }: { searchParams: { novo?: string } }) {
  const session = getSession();
  if (!session) redirect("/entrar");
  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) redirect("/entrar?status=sem-acesso");

  const pedidos = await lerPedidos("Blue");
  const novoId = searchParams?.novo ? Number(searchParams.novo) : 0;

  // Para o pedido recém-criado, remonta o pool pra mostrar o PORQUÊ de cada apto.
  let destaque: { pedido: NonNullable<Awaited<ReturnType<typeof lerPedido>>>; pool: PoolResult | null } | null = null;
  if (novoId) {
    const ped = await lerPedido(novoId);
    if (ped && ped.funcao && ped.data && ped.hora && ped.valor != null) {
      const pool = await montarPool({ funcao: ped.funcao, data: ped.data, inicio: ped.hora, valor: ped.valor, vagas: ped.vagas });
      destaque = { pedido: ped, pool };
    } else if (ped) {
      destaque = { pedido: ped, pool: null };
    }
  }

  return (
    <>
      <header>
        <div className="hd">
          <div className="logo"><span className="mk">a7</span>pro <span className="sub">Meus pedidos</span></div>
          <div className="who">{session.email} · <b>Plano Fundador</b><br /><a href="/portal" style={{ color: "#9b9c9e", fontSize: 11.5 }}>← Voltar à busca</a> · <a href="/api/auth/sair" style={{ color: "#9b9c9e", fontSize: 11.5 }}>Sair</a></div>
        </div>
      </header>

      <main className="wrap">
        {destaque && (
          <section className="panel" style={{ borderColor: "#e3d2a6" }}>
            <div className="ttl">Pool montado · pedido #{destaque.pedido.id}</div>
            <p className="lead" style={{ margin: "2px 0 14px" }}>
              <b>{destaque.pedido.funcao}</b> · {dataFmt(destaque.pedido.data)} · {destaque.pedido.hora} às {fimDe(destaque.pedido.hora)} · até <b>R$ {destaque.pedido.valor}</b> · {destaque.pedido.vagas} vaga(s)
            </p>

            {destaque.pool ? (
              <>
                <div className="reserva" style={{ background: destaque.pool.atingiuMinimo ? "#f0f7ee" : "#fdf3e7", borderColor: destaque.pool.atingiuMinimo ? "#cfe6c6" : "#f0d9b5" }}>
                  <span className="ic">{destaque.pool.atingiuMinimo ? "✓" : "!"}</span>
                  <div>
                    Achei <b>{destaque.pool.total} aptos</b> para {destaque.pedido.vagas} vaga(s).
                    Meta mínima da lista inicial (2× as vagas): <b>{destaque.pool.metaMinima}</b>.
                    {destaque.pool.atingiuMinimo
                      ? " Pool acima do mínimo."
                      : " Pool abaixo do mínimo — considere ampliar valor, horário ou aceitar funções relacionadas."}
                    <br /><small style={{ color: "#7a7b7e" }}>Universo exibível avaliado: {destaque.pool.universoExibivel} · convites no pedido: {destaque.pedido.pool} · pré-convites disparados: {destaque.pedido.enviado} · com interesse: {destaque.pedido.interesse}</small>
                  </div>
                </div>

                {destaque.pool.aptos.length > 0 && (
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {destaque.pool.aptos.map((a) => (
                      <div key={a.card} style={{ border: "1px solid #ece7da", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div><b>{a.nomeParcial}</b> <span style={{ color: "#7a7b7e", fontSize: 12.5 }}>· {a.funcao}</span></div>
                          <span className={`selo ${a.selo}`} style={{ flexShrink: 0 }}>{a.selo === "NOVATA" ? "NOVO" : a.selo}</span>
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12.5, color: "#46474b" }}>
                          {a.exato ? "✓ função exata" : "↔ função relacionada"} · {a.porque.slice(1).join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {destaque.pool.descartados.length > 0 && (
                  <details style={{ marginTop: 14 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "#7a7b7e" }}>
                      {destaque.pool.descartados.length} não entraram no pool (por quê)
                    </summary>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {destaque.pool.descartados.map((d) => (
                        <div key={d.card} style={{ fontSize: 12, color: "#7a7b7e" }}>
                          <b style={{ color: "#46474b" }}>{d.nomeParcial}</b> — {d.motivo}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className="placeholder">Pedido criado, mas faltam campos para remontar o pool.</div>
            )}
          </section>
        )}

        <section className="panel" style={{ marginTop: destaque ? 14 : 0 }}>
          <div className="ttl">Histórico de pedidos</div>
          {pedidos.length === 0 ? (
            <div className="placeholder">
              <div className="big">Você ainda não criou nenhum pedido</div>
              Volte à <a href="/portal" style={{ color: "var(--gold)", fontWeight: 700 }}>busca</a> e clique em Convocar.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {pedidos.map((p) => (
                <div key={p.id} style={{ border: "1px solid #ece7da", borderRadius: 12, padding: "10px 14px", background: p.id === novoId ? "#fbf6ea" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <b>#{p.id}</b> · {p.funcao ?? "—"} · {dataFmt(p.data)} {p.hora ?? ""} · até R$ {p.valor ?? "—"} · {p.vagas} vaga(s)
                  </div>
                  <div style={{ fontSize: 12.5, color: "#7a7b7e" }}>
                    pool <b style={{ color: "#46474b" }}>{p.pool}</b> · disparados <b style={{ color: "#46474b" }}>{p.enviado}</b> · interesse <b style={{ color: "var(--ok, #2f7d52)" }}>{p.interesse}</b> · {p.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer>
          <div className="in">
            <div className="row"><span className="ic">○</span><div>O pool nasce <b>pré-envio</b> (status=pool). O convite no WhatsApp, o aceite do profissional e a revelação da empresa vêm nas próximas etapas.</div></div>
          </div>
        </footer>
      </main>
    </>
  );
}
