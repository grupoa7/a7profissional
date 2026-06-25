"use client";
// Componente caloroso do perfil-calendário (lado trabalhador). Faz UMA coisa:
// disponibilidade (dias da semana + janela de horário + feriado) + valor
// autodeclarado, com renovação de 1 toque. Não navega vagas, não tem feed, nem
// reputação (DESIGN-BRIEF §3c).
import { useMemo, useState } from "react";

const DIAS: Array<{ v: string; curto: string }> = [
  { v: "Segunda", curto: "Seg" },
  { v: "Terça", curto: "Ter" },
  { v: "Quarta", curto: "Qua" },
  { v: "Quinta", curto: "Qui" },
  { v: "Sexta", curto: "Sex" },
  { v: "Sábado", curto: "Sáb" },
  { v: "Domingo", curto: "Dom" },
];

type View = {
  card: string;
  nome: string | null;
  dias: string[];
  horaInicio: string | null;
  horaFim: string | null;
  feriados: boolean;
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
function viraNoite(ini: string, fim: string): boolean {
  if (!ini || !fim) return false;
  return fim <= ini; // "HH:MM" comparável como string
}
// minutos da janela de disponibilidade (trata virada da noite).
function janelaMin(ini: string, fim: string): number | null {
  if (!ini || !fim) return null;
  const [h1, m1] = ini.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  let d = h2 * 60 + m2 - (h1 * 60 + m1);
  if (d <= 0) d += 24 * 60; // virou a noite
  return d;
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
const TURNO_MIN = 9 * 60; // diária = 8h trabalho + 1h intervalo

export default function Calendario({ token, initial }: { token: string; initial: View }) {
  const [dias, setDias] = useState<Set<string>>(new Set(initial.dias));
  const [feriados, setFeriados] = useState<boolean>(initial.feriados);
  const [ini, setIni] = useState<string>(initial.horaInicio || "");
  const [fim, setFim] = useState<string>(initial.horaFim || "");
  const [segSex, setSegSex] = useState<string>(moneyToInput(initial.valorSegSex));
  const [fds, setFds] = useState<string>(moneyToInput(initial.valorFds));

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const saudacao = initial.nome ? `Oi, ${initial.nome}! 👋` : "Oi! 👋";
  const mostrarEsmaecido = initial.esmaecido && !salvo;

  const dirty = () => {
    setSalvo(null);
    setErro(null);
  };
  const toggleDia = (v: string) => {
    const n = new Set(dias);
    n.has(v) ? n.delete(v) : n.add(v);
    setDias(n);
    dirty();
  };

  const semDia = useMemo(() => dias.size === 0 && !feriados, [dias, feriados]);
  const semHora = useMemo(() => !ini || !fim, [ini, fim]);

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
          horaInicio: ini || null,
          horaFim: fim || null,
          feriados,
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
              onClick={() => toggleDia(d.v)}
            >
              {d.curto}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={"cal-feriado" + (feriados ? " on" : "")}
          aria-pressed={feriados}
          onClick={() => {
            setFeriados(!feriados);
            dirty();
          }}
        >
          <span className="cal-feriado-check">{feriados ? "✓" : ""}</span>
          <span className="cal-feriado-txt">
            <strong>Topo ser chamado em feriados também</strong>
            <small>Feriado costuma pagar diferente — marque só se topar mesmo.</small>
          </span>
        </button>
      </section>

      <section className="cal-sec">
        <h2>Em que horário do dia você fica disponível?</h2>
        <div className="cal-callout">
          <strong>Atenção:</strong> aqui você marca só a <em>faixa do dia</em> em que pode
          pegar um turno — <u>não</u> que vai trabalhar esse tempo todo. Cada diária é de{" "}
          <strong>8h de trabalho + 1h de intervalo</strong> (9h no total), encaixada dentro
          dessa faixa.
        </div>
        <div className="cal-horas">
          <label className="cal-hora">
            <span>Disponível a partir de</span>
            <input
              type="time"
              value={ini}
              onChange={(e) => {
                setIni(e.target.value);
                dirty();
              }}
            />
          </label>
          <span className="cal-horas-sep">até</span>
          <label className="cal-hora">
            <span>Disponível até</span>
            <input
              type="time"
              value={fim}
              onChange={(e) => {
                setFim(e.target.value);
                dirty();
              }}
            />
          </label>
        </div>
        {ini && fim && (() => {
          const min = janelaMin(ini, fim);
          if (min == null) return null;
          const curta = min < TURNO_MIN;
          return (
            <p className={curta ? "cal-soft cal-soft-warn" : "cal-soft"}>
              {viraNoite(ini, fim) ? "🌙 Vira a noite (termina no dia seguinte). " : ""}
              Sua janela é de <strong>{fmtDur(min)}</strong>
              {curta
                ? " — é menos que as 9h de uma diária, pode não dar pra encaixar um turno inteiro."
                : " — dá pra encaixar uma diária de 9h dentro dela."}
            </p>
          );
        })()}
      </section>

      <section className="cal-sec">
        <h2>Quanto você cobra por diária?</h2>
        <p className="cal-hint">Você que define. A A7Pro nunca sugere valor.</p>
        <div className="cal-callout cal-callout-ok">
          🚕 O valor que você colocar <strong>já inclui o seu transporte</strong> (ida e
          volta). Considere isso na hora de definir.
        </div>
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
                  dirty();
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
                  dirty();
                }}
              />
            </div>
          </label>
        </div>
      </section>

      {(semDia || semHora) && !salvo && (
        <p className="cal-soft">
          Dica: marque pelo menos um dia (ou feriados) e um horário pra continuar
          recebendo convites. 🙂
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
