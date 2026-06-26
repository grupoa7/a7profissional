"use client";
// POOL AO VIVO + SELEÇÃO (S5 · empresa). Mostra o pedido com auto-refresh (polling 8s),
// o contador ao vivo, a lista de interessados ranqueada e o botão "Selecionar". Ao
// selecionar, a plataforma revela empresa+endereço SÓ ao escolhido (página do trabalhador)
// e libera nome+telefone dele aqui. Plano B é MANUAL: o recusado aparece marcado "recusou"
// e a empresa escolhe o próximo. "Fechar agora" encerra a janela.
import { useCallback, useEffect, useState } from "react";

type Interessado = {
  conviteId: number;
  card: string;
  nome: string;
  primeiroNome: string;
  telefone: string | null;
  funcao: string | null;
  selo: string;
  exato: boolean;
  status: string;
  selecionadoEm: string | null;
  prazoConfirmarAte: string | null;
  prazoEstourado: boolean;
};
type Painel = {
  pedidoId: number;
  status: string;
  vagas: number;
  limiteSelecao: number;
  enviado: number;
  interesse: number;
  selecionado: number;
  confirmado: number;
  recusado: number;
  podeSelecionar: boolean;
  interessados: Interessado[];
};

const POLL_MS = 8000;

function fmtPrazo(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "prazo de 4h vencido";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `confirma em ~${h}h${String(m).padStart(2, "0")}` : `confirma em ~${m}min`;
}

export default function PainelPedido({ initial }: { initial: Painel }) {
  const [painel, setPainel] = useState<Painel>(initial);
  const [busy, setBusy] = useState<number | "fechar" | "">("");
  const [erro, setErro] = useState("");
  const [vivo, setVivo] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/painel?id=${initial.pedidoId}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok && d.ok) {
        setPainel(d.painel);
        setVivo(true);
      }
    } catch {
      setVivo(false);
    }
  }, [initial.pedidoId]);

  // auto-refresh leve (polling) — pausa quando a aba está oculta.
  useEffect(() => {
    if (painel.status !== "aberto") return; // pedido fechado não precisa polling
    const t = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [painel.status, recarregar]);

  async function selecionar(conviteId: number) {
    setErro("");
    setBusy(conviteId);
    try {
      const r = await fetch("/api/portal/painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: initial.pedidoId, acao: "selecionar", conviteId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) setErro(d.erro || "Não consegui selecionar agora.");
      await recarregar();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setBusy("");
    }
  }

  async function fechar() {
    if (!confirm("Encerrar a janela deste pedido agora? Quem ainda não confirmou não entra mais.")) return;
    setErro("");
    setBusy("fechar");
    try {
      await fetch("/api/portal/painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: initial.pedidoId, acao: "fechar" }),
      });
      await recarregar();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setBusy("");
    }
  }

  const fechado = painel.status !== "aberto";
  const faltam = Math.max(0, painel.vagas - painel.confirmado);

  return (
    <section className="panel" style={{ borderColor: "#e3d2a6", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="ttl" style={{ margin: 0 }}>Pool ao vivo · pedido #{painel.pedidoId}</div>
        <span style={{ fontSize: 11.5, color: vivo ? "#2f7d52" : "#9b9c9e" }}>
          {fechado ? "● encerrado" : vivo ? "● ao vivo" : "○ reconectando…"}
        </span>
      </div>

      {/* CONTADOR AO VIVO */}
      <div
        className="reserva"
        style={{
          marginTop: 10,
          background: painel.confirmado >= painel.vagas ? "#f0f7ee" : "#fdf3e7",
          borderColor: painel.confirmado >= painel.vagas ? "#cfe6c6" : "#f0d9b5",
        }}
      >
        <span className="ic">{painel.confirmado >= painel.vagas ? "✓" : "★"}</span>
        <div>
          <b>{painel.confirmado} de {painel.vagas}</b> confirmado(s)
          {!fechado && faltam > 0 && (
            <> · <b>{painel.interesse}</b> aguardando escolha · <b>+{painel.enviado}</b> ainda podem topar</>
          )}
          {painel.selecionado > 0 && <> · <b>{painel.selecionado}</b> escolhido(s) aguardando confirmar</>}
          {painel.recusado > 0 && <> · {painel.recusado} recusou</>}
          <br />
          <small style={{ color: "#7a7b7e" }}>
            Você pode escolher até <b>{painel.limiteSelecao}</b> pra {painel.vagas} vaga(s) (margem de 20%).
            {fechado && " · Pedido encerrado."}
          </small>
        </div>
      </div>

      {/* LISTA DE INTERESSADOS */}
      {painel.interessados.length === 0 ? (
        <div className="placeholder" style={{ marginTop: 12 }}>
          Ninguém topou ainda. Assim que um pré-convite virar "tenho interesse", aparece aqui sozinho.
        </div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {painel.interessados.map((i) => (
            <div
              key={i.conviteId}
              style={{
                border: "1px solid",
                borderColor: i.status === "confirmado" ? "#cfe6c6" : i.status === "selecionado" ? "#ecdcb4" : i.status === "recusado" ? "#eccfcf" : "#ece7da",
                borderRadius: 12,
                padding: "12px 14px",
                background: i.status === "recusado" ? "#fcf6f6" : i.status === "confirmado" ? "#f7fbf5" : "#fff",
                opacity: i.status === "recusado" ? 0.7 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <b>{i.nome}</b>{" "}
                  <span style={{ color: "#7a7b7e", fontSize: 12.5 }}>· {i.funcao ?? "—"}</span>
                </div>
                <span className={`selo ${i.selo}`} style={{ flexShrink: 0 }}>{i.selo === "NOVATA" ? "NOVO" : i.selo}</span>
              </div>

              <div style={{ marginTop: 6, fontSize: 12.5, color: "#46474b" }}>
                {i.exato ? "✓ função exata" : "↔ função relacionada"}
                {i.status === "selecionado" && (
                  <> · <b style={{ color: i.prazoEstourado ? "#b4452f" : "#ae863f" }}>
                    {i.prazoEstourado ? "prazo de 4h vencido — escolha outro se quiser" : fmtPrazo(i.prazoConfirmarAte)}
                  </b></>
                )}
                {i.status === "confirmado" && <> · <b style={{ color: "#2f7d52" }}>✓ confirmou presença</b></>}
                {i.status === "recusado" && <> · <b style={{ color: "#b4452f" }}>recusou — escolha o próximo</b></>}
              </div>

              {/* contato liberado só após seleção */}
              {(i.status === "selecionado" || i.status === "confirmado") && i.telefone && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  📱 <a href={`https://wa.me/${i.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "#2f7d52", fontWeight: 600 }}>{i.telefone}</a>
                </div>
              )}

              {/* botão selecionar (interesse + ainda há espaço de hold) */}
              {i.status === "interesse" && !fechado && (
                <button
                  className="sel-btn"
                  disabled={busy === i.conviteId || !painel.podeSelecionar}
                  onClick={() => selecionar(i.conviteId)}
                  title={!painel.podeSelecionar ? "Limite de escolhas atingido" : ""}
                >
                  {busy === i.conviteId ? "Selecionando…" : "Selecionar →"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {erro && <div style={{ marginTop: 10, color: "#b4452f", fontSize: 13 }}>{erro}</div>}

      {!fechado && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <button className="fechar-btn" disabled={busy === "fechar"} onClick={fechar}>
            {busy === "fechar" ? "Encerrando…" : "Fechar agora"}
          </button>
          <button className="recarregar-btn" onClick={recarregar}>Atualizar</button>
        </div>
      )}
    </section>
  );
}
