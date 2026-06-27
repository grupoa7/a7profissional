"use client";
// PAINEL DA BUSCA AO VIVO + SELEÇÃO (S5 · empresa; refeito em S7 · inline na /portal).
// Acompanha um pedido com auto-refresh (polling 8s) e mostra a "mensagem viva" estilo
// Uber enquanto a busca acontece: 'buscando' (montando o pool em background) → 'aberto'
// sem ninguém ainda → 'aberto' com interessados ranqueados. Ao selecionar, a plataforma
// revela empresa+endereço SÓ ao escolhido e libera nome+telefone dele aqui. Plano B é
// MANUAL. "Fechar agora" encerra a janela.
//
// S7: o componente busca o painel sozinho a partir do `pedidoId` (não depende mais de um
// `initial` server-side), e tem AUTO-RETRY — se a montagem assíncrona (/api/portal/montar)
// emperrar, ele re-dispara sozinho; persistindo o travamento, oferece "tentar de novo".
import { useCallback, useEffect, useRef, useState } from "react";
import type { PainelPedido as PainelData } from "@/lib/selecao";

type Painel = PainelData;

const POLL_MS = 8000;
const RETRY_APOS_MS = 15000; // 'buscando' parado mais que isto → re-dispara a montagem
const MAX_RETRIES = 3;

function fmtPrazo(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "prazo de 4h vencido";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h > 0 ? `confirma em ~${h}h${String(m).padStart(2, "0")}` : `confirma em ~${m}min`;
}

export default function PainelPedido({
  pedidoId,
  initial,
  onNovaBusca,
}: {
  pedidoId: number;
  initial?: Painel | null;
  onNovaBusca?: () => void;
}) {
  const [painel, setPainel] = useState<Painel | null>(initial ?? null);
  const [busy, setBusy] = useState<number | "fechar" | "">("");
  const [erro, setErro] = useState("");
  const [vivo, setVivo] = useState(true);
  const [travou, setTravou] = useState(false);
  const buscandoDesde = useRef<number>(Date.now());
  const retries = useRef(0);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/portal/painel?id=${pedidoId}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok && d.ok) {
        setPainel(d.painel);
        setVivo(true);
      }
    } catch {
      setVivo(false);
    }
  }, [pedidoId]);

  // (re)dispara a montagem assíncrona (idempotente) — usado no auto-retry e no resgate.
  const dispararMontagem = useCallback(async () => {
    try {
      await fetch(`/api/portal/montar?pedido=${pedidoId}`, { method: "POST" });
    } catch {
      /* rede caiu — o próximo ciclo tenta de novo */
    }
    recarregar();
  }, [pedidoId, recarregar]);

  // primeiro carregamento quando não veio painel do servidor (pedido recém-criado).
  useEffect(() => {
    if (!initial) recarregar();
  }, [initial, recarregar]);

  // polling enquanto o pedido está VIVO ('buscando' ou 'aberto'); pausa com a aba oculta.
  useEffect(() => {
    const st = painel?.status;
    if (st !== "aberto" && st !== "buscando") return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [painel?.status, recarregar]);

  // AUTO-RETRY da montagem: se segue 'buscando' por tempo demais, a montagem provavelmente
  // emperrou (aba que disparou fechou, rede caiu). Re-dispara — seguro, é idempotente.
  useEffect(() => {
    if (painel?.status !== "buscando") {
      buscandoDesde.current = Date.now();
      return;
    }
    const t = setInterval(() => {
      if (Date.now() - buscandoDesde.current < RETRY_APOS_MS) return;
      if (retries.current >= MAX_RETRIES) {
        setTravou(true);
        return;
      }
      retries.current += 1;
      buscandoDesde.current = Date.now();
      dispararMontagem();
    }, 4000);
    return () => clearInterval(t);
  }, [painel?.status, dispararMontagem]);

  async function selecionar(conviteId: number) {
    setErro("");
    setBusy(conviteId);
    try {
      const r = await fetch("/api/portal/painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, acao: "selecionar", conviteId }),
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
    if (!confirm("Encerrar a janela desta busca agora? Quem ainda não confirmou não entra mais.")) return;
    setErro("");
    setBusy("fechar");
    try {
      await fetch("/api/portal/painel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, acao: "fechar" }),
      });
      await recarregar();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setBusy("");
    }
  }

  async function resgatar() {
    setTravou(false);
    retries.current = 0;
    buscandoDesde.current = Date.now();
    await dispararMontagem();
  }

  // ---- estados ----
  if (!painel) {
    return (
      <section className="panel" style={{ borderColor: "#e3d2a6" }}>
        <div className="busca-vivo">
          <span className="busca-dot" />
          <div>Iniciando sua busca…</div>
        </div>
      </section>
    );
  }

  const buscando = painel.status === "buscando";
  const aberto = painel.status === "aberto";
  const fechado = !buscando && !aberto;
  const semInteresse = aberto && painel.interessados.length === 0;
  const faltam = Math.max(0, painel.vagas - painel.confirmado);

  return (
    <section className="panel" style={{ borderColor: "#e3d2a6", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="ttl" style={{ margin: 0 }}>Sua busca · #{painel.pedidoId}</div>
        <span style={{ fontSize: 11.5, color: fechado ? "#9b9c9e" : vivo ? "#2f7d52" : "#9b9c9e" }}>
          {fechado ? "● encerrada" : buscando ? "● buscando" : vivo ? "● ao vivo" : "○ reconectando…"}
        </span>
      </div>

      {/* MENSAGEM VIVA (estilo Uber) — a espera nunca parece tela morta. */}
      {buscando && !travou && (
        <div className="busca-vivo" style={{ marginTop: 10 }}>
          <span className="busca-dot" />
          <div>
            <b>Buscando profissionais na sua região…</b>
            <br />
            <small>A gente avisa aqui assim que alguém topar. Pode deixar essa tela aberta.</small>
          </div>
        </div>
      )}

      {buscando && travou && (
        <div className="reserva" style={{ marginTop: 10, background: "#fdf3e7", borderColor: "#f0d9b5" }}>
          <span className="ic">!</span>
          <div>
            A busca demorou mais que o esperado pra começar.
            <br />
            <button className="recarregar-btn" style={{ marginTop: 8 }} onClick={resgatar}>Tentar de novo</button>
          </div>
        </div>
      )}

      {semInteresse && (
        <div className="busca-vivo" style={{ marginTop: 10 }}>
          <span className="busca-dot" />
          <div>
            <b>Convites enviados.</b>
            <br />
            <small>Agora é aguardar. Os profissionais vão respondendo e aparecem aqui sozinhos.</small>
          </div>
        </div>
      )}

      {/* CONTADOR AO VIVO — só quando já há gente na fila. */}
      {(aberto && painel.interessados.length > 0) || fechado ? (
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
            {!fechado && painel.interesse > 0 && <> · <b>{painel.interesse}</b> aguardando sua escolha</>}
            {painel.selecionado > 0 && <> · <b>{painel.selecionado}</b> escolhido(s) aguardando confirmar</>}
            {painel.recusado > 0 && <> · {painel.recusado} recusou</>}
            {!fechado && faltam > 0 && painel.interesse === 0 && painel.selecionado === 0 && (
              <> · outros profissionais ainda podem responder</>
            )}
            <br />
            <small style={{ color: "#7a7b7e" }}>
              Você pode escolher até <b>{painel.limiteSelecao}</b> pra {painel.vagas} vaga(s) (margem de 20%).
              {fechado && " · Busca encerrada."}
            </small>
          </div>
        </div>
      ) : null}

      {/* LISTA DE INTERESSADOS (quem topou) */}
      {painel.interessados.length > 0 && (
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {i.reputacaoExibivel && i.reputacaoTurnos != null && (
                    <span title={`Reputação de ${i.nTurnos} turno(s) avaliado(s)`} style={{ fontSize: 11.5, fontWeight: 700, color: "#ae863f", background: "#fbf6e9", border: "1px solid #ecd9a3", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>
                      ★ {i.reputacaoTurnos} · {i.nTurnos} turnos
                    </span>
                  )}
                  <span className={`selo ${i.selo}`}>{i.selo === "NOVATA" ? "NOVO" : i.selo}</span>
                </div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12.5, color: "#46474b" }}>
                {i.exato ? "✓ função exata" : "↔ função relacionada"}
                {i.status === "selecionado" && (
                  <> · <b style={{ color: i.prazoEstourado ? "#b4452f" : "#ae863f" }}>
                    {i.prazoEstourado ? "prazo de 4h vencido · escolha outro se quiser" : fmtPrazo(i.prazoConfirmarAte)}
                  </b></>
                )}
                {i.status === "confirmado" && <> · <b style={{ color: "#2f7d52" }}>✓ confirmou presença</b></>}
                {i.status === "recusado" && <> · <b style={{ color: "#b4452f" }}>recusou · escolha o próximo</b></>}
              </div>

              {(i.status === "selecionado" || i.status === "confirmado") && i.telefone && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  📱 <a href={`https://wa.me/${i.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ color: "#2f7d52", fontWeight: 600 }}>{i.telefone}</a>
                </div>
              )}

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

      <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {!fechado && (
          <button className="fechar-btn" disabled={busy === "fechar"} onClick={fechar}>
            {busy === "fechar" ? "Encerrando…" : "Fechar agora"}
          </button>
        )}
        {!buscando && <button className="recarregar-btn" onClick={recarregar}>Atualizar</button>}
        {onNovaBusca && <button className="recarregar-btn" onClick={onNovaBusca}>Nova busca</button>}
      </div>
    </section>
  );
}
