"use client";
// Componente caloroso do perfil-calendário (lado trabalhador). Faz UMA coisa:
// disponibilidade (dias + turnos) + valor autodeclarado, com renovação de 1 toque.
// Não navega vagas, não tem feed, não tem reputação (DESIGN-BRIEF §3c).
import { useMemo, useState } from "react";

const DIAS: Array<{ v: string; curto: string }> = [
  { v: "Segunda", curto: "Seg" },
  { v: "Terça", curto: "Ter" },
  { v: "Quarta", curto: "Qua" },
  { v: "Quinta", curto: "Qui" },
  { v: "Sexta", curto: "Sex" },
  { v: "Sábado", curto: "Sáb" },
  { v: "Domingo", curto: "Dom" },
  { v: "Feriados", curto: "Feriados" },
];
const TURNOS: Array<{ v: string; sub: string }> = [
  { v: "Manhã", sub: "início do dia" },
  { v: "Tarde", sub: "depois do almoço" },
  { v: "Noite", sub: "fim do dia" },
  { v: "Madrugada", sub: "virada" },
];

type View = {
  card: string;
  nome: string | null;
  dias: string[];
  turnos: string[];
  valorSegSex: number | null;
  valorFds: number | null;
  atualizadoEm: string | null;
  esmaecido: boolean;
  fonte: "neon" | "semente";
};

function moneyToInput(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function inputToMoney(s: string): number | null {
  const cleaned = s.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function quando(iso: string | null): string {
  if (!iso) return "ainda não salvo";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "ainda não salvo";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Calendario({ token, initial }: { token: string; initial: View }) {
  const [dias, setDias] = useState<Set<string>>(new Set(initial.dias));
  const [turnos, setTurnos] = useState<Set<string>>(new Set(initial.turnos));
  const [segSex, setSegSex] = useState<string>(moneyToInput(initial.valorSegSex));
  const [fds, setFds] = useState<string>(moneyToInput(initial.valorFds));

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(null); // ISO do último save nesta sessão
  const [erro, setErro] = useState<string | null>(null);

  const saudacao = initial.nome ? `Oi, ${initial.nome}! 👋` : "Oi! 👋";

  // mostra o aviso de esmaecido só enquanto ele não salvou nesta sessão
  const mostrarEsmaecido = initial.esmaecido && !salvo;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
    setSalvo(null);
    setErro(null);
  };

  const vazio = useMemo(() => dias.size === 0 || turnos.size === 0, [dias, turnos]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/t/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: token,
          dias: Array.from(dias),
          turnos: Array.from(turnos),
          valorSegSex: inputToMoney(segSex),
          valorFds: inputToMoney(fds),
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data?.erro || "Não consegui salvar agora.");
      setSalvo(data.atualizadoEm || new Date().toISOString());
    } catch (e: any) {
      setErro(e?.message || "Não consegui salvar agora. Tenta de novo em instantes.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cal-card">
      <div className="cal-logo">
        <span className="cal-logo-badge">a7</span>pro
      </div>

      <h1 className="cal-hi">{saudacao}</h1>
      <p className="cal-lead">
        Aqui você mantém sua disponibilidade em dia. É assim que as oportunidades
        certas chegam até você — sem precisar instalar nada.
      </p>

      {mostrarEsmaecido && (
        <div className="cal-banner">
          🌱 Sua disponibilidade está um pouquinho antiga. Dá uma conferida e toca em
          <strong> salvar</strong> pra voltar a aparecer.
        </div>
      )}

      <section className="cal-sec">
        <h2>Em quais dias você topa trabalhar?</h2>
        <div className="cal-chips">
          {DIAS.map((d) => (
            <button
              key={d.v}
              type="button"
              className={"cal-chip" + (dias.has(d.v) ? " on" : "")}
              aria-pressed={dias.has(d.v)}
              onClick={() => toggle(dias, setDias, d.v)}
            >
              {d.curto}
            </button>
          ))}
        </div>
      </section>

      <section className="cal-sec">
        <h2>E em quais turnos?</h2>
        <div className="cal-turnos">
          {TURNOS.map((t) => (
            <button
              key={t.v}
              type="button"
              className={"cal-turno" + (turnos.has(t.v) ? " on" : "")}
              aria-pressed={turnos.has(t.v)}
              onClick={() => toggle(turnos, setTurnos, t.v)}
            >
              <span className="cal-turno-v">{t.v}</span>
              <span className="cal-turno-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cal-sec">
        <h2>Quanto você cobra por diária?</h2>
        <p className="cal-hint">Você que define. A A7Pro nunca sugere valor.</p>
        <div className="cal-vals">
          <label className="cal-val">
            <span>Segunda a sexta</span>
            <div className="cal-money">
              <i>R$</i>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={segSex}
                onChange={(e) => {
                  setSegSex(e.target.value);
                  setSalvo(null);
                }}
              />
            </div>
          </label>
          <label className="cal-val">
            <span>Sábado, domingo e feriado</span>
            <div className="cal-money">
              <i>R$</i>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={fds}
                onChange={(e) => {
                  setFds(e.target.value);
                  setSalvo(null);
                }}
              />
            </div>
          </label>
        </div>
      </section>

      {vazio && !salvo && (
        <p className="cal-soft">
          Dica: marque pelo menos um dia e um turno pra continuar recebendo convites. 🙂
        </p>
      )}

      {erro && <div className="cal-erro">{erro}</div>}

      {salvo ? (
        <div className="cal-ok">
          <div className="cal-ok-big">Pronto! Tá tudo fresquinho. 🎉</div>
          <div className="cal-ok-sub">Atualizado {quando(salvo)}.</div>
          <button type="button" className="cal-btn ghost" onClick={() => setSalvo(null)}>
            Ajustar de novo
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="cal-btn" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar minha disponibilidade"}
          </button>
          <p className="cal-renew">
            Sem mudanças? Salvar mesmo assim renova seu calendário e te mantém no radar.
          </p>
        </>
      )}

      <footer className="cal-foot">
        <p>
          A A7Pro organiza oportunidades — quem decide se topa é sempre você. Seus
          dados são seus, e você pode ajustar isto quando quiser.
        </p>
        <p className="cal-foot-when">
          {initial.atualizadoEm
            ? `Última atualização: ${quando(initial.atualizadoEm)}`
            : "Primeira vez por aqui — é só conferir e salvar."}
        </p>
      </footer>
    </div>
  );
}
