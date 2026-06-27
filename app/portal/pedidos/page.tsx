import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../portal.css";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerPedidos } from "@/lib/pedidos";
import { PortalNav } from "@/app/components/PortalNav";

// S7: a busca ao vivo passou a viver inline na /portal (estilo Uber). Esta página é só o
// HISTÓRICO de pedidos — uma lista enxuta do que já foi pedido, sem painel ao vivo nem
// jargão técnico de pool.
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

// status do pedido → rótulo humano (sem jargão).
function statusLabel(s: string): { txt: string; cor: string; bg: string } {
  switch (s) {
    case "buscando": return { txt: "buscando", cor: "#8a6d1f", bg: "#fbf4e3" };
    case "aberto": return { txt: "em andamento", cor: "#2f7d52", bg: "#eef7ee" };
    case "fechado": return { txt: "concluído", cor: "#46474b", bg: "#f1f1ee" };
    case "cancelado": return { txt: "cancelado", cor: "#9b5050", bg: "#f8efef" };
    default: return { txt: s, cor: "#7a7b7e", bg: "#f1f1ee" };
  }
}

export default async function PedidosPage() {
  const session = getSession();
  if (!session) redirect("/entrar");
  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) redirect("/entrar?status=sem-acesso");

  const pedidos = await lerPedidos("Blue");

  return (
    <>
      <PortalNav email={session.email} atual="/portal/pedidos" sub="Meus pedidos" />

      <main className="wrap">
        <section className="panel">
          <div className="ttl">Histórico de buscas</div>
          {pedidos.length === 0 ? (
            <div className="placeholder">
              <div className="big">Você ainda não fez nenhuma busca</div>
              Vá para a <a href="/portal" style={{ color: "var(--gold)", fontWeight: 700 }}>busca</a> e clique em Buscar profissionais.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {pedidos.map((p) => {
                const st = statusLabel(p.status);
                return (
                  <div key={p.id} style={{ border: "1px solid #ece7da", borderRadius: 12, padding: "10px 14px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <b>{p.funcao ?? "—"}</b> · {dataFmt(p.data)}{p.hora ? ` · ${p.hora} às ${fimDe(p.hora)}` : ""} · até R$ {p.valor ?? "—"} · {p.vagas} vaga(s)
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: st.cor, background: st.bg, borderRadius: 20, padding: "3px 11px", whiteSpace: "nowrap" }}>
                      {st.txt}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
