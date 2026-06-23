"use client";
import { useMemo, useState } from "react";
import type { TalentCard } from "@/lib/talent";

const RANK: Record<string, number> = { AAA: 3, AA: 2, A: 1 };
const SELOTXT: Record<string, string> = { AAA: "EXCELÊNCIA", AA: "CONSOLIDADO", A: "CONFIÁVEL" };
const SELOEX: Record<string, string> = {
  AAA: "Classificação máxima do A7Pro, baseada em histórico profissional verificado.",
  AA: "Classificação alta do A7Pro, baseada em histórico profissional verificado.",
  A: "Classificação positiva do A7Pro, baseada em histórico profissional verificado.",
};
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const FDS = new Set(["Sáb", "Dom"]);
const VIZ: Record<string, string[]> = { "Manhã": ["Tarde"], "Tarde": ["Manhã", "Noite"], "Noite": ["Tarde"] };
const FUNC_FALLBACK = ["Garçom", "Auxiliar de cozinha", "Bartender", "Cozinheiro", "Recepcionista", "Auxiliar de limpeza"];

function turnoDe(hhmm: string) {
  const h = +hhmm.split(":")[0];
  return h >= 5 && h < 12 ? "Manhã" : h >= 12 && h < 18 ? "Tarde" : "Noite";
}
function fimDe(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + 9 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function diaSemana(d: string) {
  const [y, mo, da] = d.split("-").map(Number);
  return DOW[new Date(y, mo - 1, da).getDay()];
}
function dataFmt(d: string) {
  const [, mo, da] = d.split("-").map(Number);
  return `${diaSemana(d)}, ${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}`;
}
function diasDesde(iso: string | null) {
  if (!iso) return 99;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 99;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}
function updTxt(n: number) {
  return n === 0 ? "hoje" : n === 1 ? "há 1 dia" : `há ${n} dias`;
}
function iniciais(nome: string) {
  return nome.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

type Estado = Record<string, "confirming" | "done">;

export function Vitrine({ cards, funcoes }: { cards: TalentCard[]; funcoes: string[] }) {
  const funcOpts = funcoes.length ? funcoes : FUNC_FALLBACK;
  const [func, setFunc] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [val, setVal] = useState("");
  const [searched, setSearched] = useState(false);
  const [estado, setEstado] = useState<Estado>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const ready = !!(func && data && hora && val);
  const fim = hora ? fimDe(hora) : "";

  const { list, widened, vizLabel, dia, turno, wknd, budget } = useMemo(() => {
    if (!searched || !ready) {
      return { list: [] as TalentCard[], widened: false, vizLabel: "", dia: "", turno: "", wknd: false, budget: 0 };
    }
    const b = +val;
    const d = diaSemana(data);
    const tn = turnoDe(hora);
    const wk = FDS.has(d);
    const rate = (p: TalentCard) => (wk ? p.valorFds : p.valorSegSex);
    const matchBase = (p: TalentCard) => p.funcao === func && p.dias.includes(d) && rate(p) != null && (rate(p) as number) <= b;
    let l = cards.filter((p) => matchBase(p) && p.turnos.includes(tn));
    let wdn = false;
    let viz: string[] = [];
    if (l.length < 3) {
      const extra = cards.filter((p) => matchBase(p) && !l.includes(p) && (VIZ[tn] || []).some((t) => p.turnos.includes(t)));
      if (extra.length) {
        wdn = true;
        viz = VIZ[tn] || [];
        l = l.concat(extra);
      }
    }
    l = [...l].sort((a, c) => RANK[c.selo] - RANK[a.selo] || ((wk ? a.valorFds : a.valorSegSex) ?? 9e9) - ((wk ? c.valorFds : c.valorSegSex) ?? 9e9) || diasDesde(a.atualizadoEm) - diasDesde(c.atualizadoEm));
    return { list: l, widened: wdn, vizLabel: viz.join(" e "), dia: d, turno: tn, wknd: wk, budget: b };
  }, [searched, ready, cards, func, data, hora, val]);

  function marcar(id: string) {
    setEstado((s) => ({ ...s, [id]: "confirming" }));
    setTimeout(() => setEstado((s) => ({ ...s, [id]: "done" })), 1100);
  }

  const aberto = openId ? cards.find((c) => c.id === openId) ?? null : null;

  return (
    <>
      <section className="panel">
        <div className="ttl">O que você precisa?</div>
        <div className="frow">
          <div className="fb">
            <span className="k">Função</span>
            <select className="ctrl" value={func} onChange={(e) => setFunc(e.target.value)}>
              <option value="">Selecione…</option>
              {funcOpts.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="fb">
            <span className="k">Data da diária</span>
            <input type="date" className="ctrl" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="fb">
            <span className="k">Horário</span>
            <div className="pair">
              <input type="time" className="ctrl" step={900} value={hora} onChange={(e) => setHora(e.target.value)} />
              <span className="sep">às</span>
              <input type="time" className="ctrl ro" value={fim} readOnly tabIndex={-1} />
            </div>
            <span className="hint">Início e término (8h de trabalho e 1h de descanso).</span>
          </div>
          <div className="fb">
            <span className="k">Valor da diária</span>
            <select className="ctrl" value={val} onChange={(e) => setVal(e.target.value)}>
              <option value="">Selecione…</option>
              <option value="100">até R$ 100</option>
              <option value="120">até R$ 120</option>
              <option value="140">até R$ 140</option>
              <option value="160">até R$ 160</option>
              <option value="200">até R$ 200</option>
            </select>
            <span className="hint">Valor único, transporte de ida e volta já incluso.</span>
          </div>
        </div>
        <div className="go">
          <button className="gobtn" disabled={!ready} onClick={() => setSearched(true)}>Ver profissionais disponíveis</button>
        </div>
        <div className="lockval">
          <span className="ic">🔒</span>
          <div><b>O valor é fechado no aceite.</b> O convite vai com exatamente o valor e o horário que você definir aqui, e o profissional só aceita já sabendo quanto vai receber e em que turno. Por isso não há renegociação depois. Tentar mexer no valor na hora é a maior causa de desistência, e a plataforma protege os dois lados disso.</div>
        </div>
      </section>

      <section className="res">
        {searched && ready && list.length > 0 && (
          <div className="resHd">
            <span className="n">{list.length}</span>
            <span className="t">para <b>{func}</b> · {dataFmt(data)} · {hora} às {fim} · até <b>R$ {budget}</b> com transporte</span>
          </div>
        )}
        {widened && (
          <div className="widen on"><span>↔</span><div><b>Poucos no horário exato.</b> Incluí o turno da {vizLabel} pra você não ficar sem opção, sempre dentro do seu orçamento.</div></div>
        )}

        {!(searched && ready) && (
          <div className="placeholder">
            <div className="big">Defina os campos acima pra ver quem está disponível</div>
            Mostramos só profissionais com classificação positiva, disponíveis na sua data e horário, que já aceitam o valor que você paga.
          </div>
        )}
        {searched && ready && list.length === 0 && (
          <div className="placeholder">
            <div className="big">Ninguém disponível dentro do seu orçamento pra essa data e horário.</div>
            Tente outro horário ou ajuste o valor. Não mostramos quem cobra acima do que você paga, isso evita pechincha e protege o comparecimento.
          </div>
        )}

        {searched && ready && list.length > 0 && (
          <div className="grid">
            {list.map((p) => {
              const st = estado[p.id];
              const dias = [dia, ...p.dias.filter((d) => d !== dia)].slice(0, 4);
              return (
                <div className="pcard" key={p.id} onClick={() => setOpenId(p.id)}>
                  <div className="ptop">
                    <div className="av">{iniciais(p.nomeParcial)}</div>
                    <div style={{ flex: 1 }}>
                      <div className="pname">{p.nomeParcial}</div>
                      <div className="pfunc">{p.funcao ?? func}</div>
                    </div>
                    <div className={`selo ${p.selo}`}>{p.selo}<small>{SELOTXT[p.selo]}</small></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div className="chips">
                      {dias.map((d) => <span className={`chip${d === dia ? " hit" : ""}`} key={d}>{d}</span>)}
                      <span className="chip t">{turno}</span>
                    </div>
                    <span className="live"><span className="d" />{updTxt(diasDesde(p.atualizadoEm))}</span>
                  </div>
                  <div className="valbox">
                    <div className={`c ${!wknd ? "hot" : ""}`}><div className="k">Diária Seg–Sex</div><div className="v">R$ {p.valorSegSex ?? "—"}<small> /dia</small></div></div>
                    <div className={`c ${wknd ? "hot" : ""}`}><div className="k">Sáb/Dom/Feriado</div><div className="v">R$ {p.valorFds ?? "—"}<small> /dia</small></div></div>
                  </div>
                  <div className="first">{p.trabalhosConcluidos > 0 ? `${p.trabalhosConcluidos} trabalhos concluídos` : "Primeira oportunidade via A7Pro"}</div>
                  {st === "confirming" ? (
                    <div className="confirming"><span className="spin" />Avisando o profissional e confirmando a disponibilidade…</div>
                  ) : st === "done" ? (
                    <div className="done"><div className="t">✓ Interesse registrado</div>Estamos confirmando a disponibilidade dele e conectamos vocês em até <b>24h úteis</b>. Confirmação no seu e-mail.</div>
                  ) : (
                    <div className="foot"><span className="lock">🔒 contato após o aceite</span><button className="btn" onClick={(e) => { e.stopPropagation(); marcar(p.id); }}>Tenho interesse</button></div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="selodisc">
          <span className="ic">i</span>
          <div>O selo (A, AA ou AAA) e o histórico são <b>informação de apoio baseada em histórico verificado</b>. Não são garantia de desempenho, recomendação nem vínculo. A relação de cada trabalho é direta entre empresa e profissional.</div>
        </div>
      </section>

      {aberto && (
        <div className="ov on" onClick={(e) => { if ((e.target as HTMLElement).classList.contains("ov")) setOpenId(null); }}>
          <div className="sheet">
            <button className="x" onClick={() => setOpenId(null)}>×</button>
            <h2>{aberto.nomeParcial}</h2>
            <div className="sid">{aberto.funcao ?? func} · {aberto.id}</div>
            <div className="selorow">
              <div className={`selo ${aberto.selo}`}>{aberto.selo}<small>{SELOTXT[aberto.selo]}</small></div>
              <div className="ex"><b>Selo {aberto.selo}.</b> {SELOEX[aberto.selo]}</div>
            </div>
            <div className="trust">
              <div className="t"><span className="ck">✓</span>Identidade e experiência verificadas pelo A7Pro</div>
              <div className="t"><span className="ck">✓</span>Disponibilidade reconfirmada {updTxt(diasDesde(aberto.atualizadoEm))}</div>
            </div>
            <div style={{ marginTop: 14 }}><div className="lab">Dias disponíveis</div><div className="chips">{aberto.dias.map((d) => <span className="chip" key={d}>{d}</span>)}</div></div>
            <div style={{ marginTop: 12 }}><div className="lab">Turnos disponíveis</div><div className="chips">{aberto.turnos.map((t) => <span className="chip t" key={t}>{t}</span>)}</div></div>
            <div className="row2">
              <div className="box" style={!wknd ? { borderColor: "#e3d2a6" } : undefined}><div className="k">Diária Seg–Sex</div><div className="v">R$ {aberto.valorSegSex ?? "—"}</div></div>
              <div className="box" style={wknd ? { borderColor: "#e3d2a6" } : undefined}><div className="k">Sáb / Dom / Feriado</div><div className="v">R$ {aberto.valorFds ?? "—"}</div></div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink)", background: "#fbf6ea", border: "1px solid #ecdcb3", borderRadius: 10, padding: "10px 12px" }}>
              <b style={{ color: "var(--gold)" }}>Primeira oportunidade via A7Pro.</b> Ainda sem trabalhos pela plataforma. Já passou pela verificação do A7Pro e está pronto para estrear.
            </div>
            {searched && ready && (
              <div className="valnote"><b>Ao convidar, a proposta vai fechada:</b> R$ {budget} pela diária (transporte incluso), {hora} às {fim}. O profissional aceita já sabendo disso, e o valor não se renegocia depois.</div>
            )}
            <div className="lockbox">🔒 <b>Nome completo, telefone, WhatsApp e e-mail</b> são liberados somente após o profissional aceitar a sua oportunidade.</div>
            {estado[aberto.id] === "confirming" ? (
              <div className="confirming" style={{ marginTop: 14 }}><span className="spin" />Avisando o profissional e confirmando a disponibilidade…</div>
            ) : estado[aberto.id] === "done" ? (
              <div className="done" style={{ marginTop: 14 }}><div className="t">✓ Interesse registrado</div>Estamos confirmando a disponibilidade dele e conectamos vocês em até <b>24h úteis</b>. Confirmação no seu e-mail.</div>
            ) : (
              <div className="foot" style={{ marginTop: 14 }}><button className="btn" style={{ marginLeft: 0, width: "100%" }} onClick={() => marcar(aberto.id)}>Tenho interesse neste profissional</button></div>
            )}
            <div className="disc">O selo e o histórico são informação de apoio baseada em histórico verificado. Não são garantia de desempenho, recomendação nem vínculo. A relação de cada trabalho é direta entre empresa e profissional.</div>
          </div>
        </div>
      )}
    </>
  );
}
