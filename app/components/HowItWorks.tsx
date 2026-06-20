"use client";
import { useEffect, useRef, useState } from "react";

const mono = "'SF Mono',ui-monospace,'Roboto Mono',Menlo,monospace";
const INK = "#231F20", GOLD = "#AE863F", LINE = "#E8E8E3", GRAY = "#5e5f63", FAINT = "#9b9c9e", OK = "#2f7d52";
const dur = [2800, 2800, 2600, 4200];

const steps = [
  { t: "Diga quando precisa", d: "Defina o dia, o turno e o valor da diária. Na hora a gente mostra quantos profissionais de alto padrão estão livres naquela data." },
  { t: "Escolha quem já provou", d: "Selo objetivo e histórico de comparecimento em cada perfil. Você compara e decide antes de qualquer contato." },
  { t: "Convide com um toque", d: "Convites ilimitados. Um toque e a oportunidade chega direto para quem você escolheu." },
  { t: "Combine os detalhes", d: "Quando o profissional aceita, o trabalho já está fechado. Liberamos nome e WhatsApp só pra vocês se alinharem direto antes do dia. Depois, é só avaliar." },
];
const capLabels = ["Diga quando precisa", "Escolha quem já provou", "Convide com um toque", "Contato liberado · combine os detalhes"];

const Lock = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto" }}><rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>);
const Check = ({ c = "#fff", w = 16, sw = 2.4 }: { c?: string; w?: number; sw?: number }) => (<svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
const Chip = ({ label, on, active }: { label: string; on?: boolean; active?: boolean }) => (
  <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "5px 11px", whiteSpace: "nowrap", border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : INK, boxShadow: active ? "0 0 0 3px rgba(174,134,63,.28)" : "none", transition: "box-shadow .3s ease" }}>{label}</span>
);

function Action({ p }: { p: number }) {
  if (p < 2) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: FAINT, fontWeight: 500 }}><Lock />contato após o aceite</span>
      <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#fff", background: INK, padding: "8px 14px", borderRadius: 9, whiteSpace: "nowrap" }}>Enviar convite</span>
    </div>
  );
  if (p === 2) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: FAINT, fontWeight: 500 }}><Lock />contato após o aceite</span>
      <span style={{ marginLeft: "auto", position: "relative", fontSize: 12.5, fontWeight: 700, color: "#fff", background: INK, padding: "8px 14px", borderRadius: 9, transform: "scale(.95)", whiteSpace: "nowrap" }}>Enviar convite
        <span style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: "50%", background: "rgba(255,255,255,.5)", animation: "a7ripple 1.1s ease-out infinite", pointerEvents: "none" }} />
      </span>
    </div>
  );
  return (
    <div style={{ background: "#f0f7f2", border: "1px solid #cfe7d8", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: OK, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}><Check c={OK} w={13} sw={2.2} />Contato liberado</div>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>João Santos Oliveira</div>
      <div style={{ fontSize: 12.5, color: GRAY, fontWeight: 500, marginTop: 1 }}>(71) 9 8xxx-2381 · WhatsApp</div>
    </div>
  );
}

export function HowItWorks() {
  const [phase, setPhase] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setPhase((p) => (p + 1) % 4), dur[phase]);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [phase]);
  const jumpTo = (i: number) => { if (timer.current) clearTimeout(timer.current); setPhase(i); };
  const p = phase;
  const joaoSel = p >= 1;
  const jBorder = p === 3 ? OK : joaoSel ? GOLD : LINE;
  const jShadow = p === 2 ? "0 14px 30px -12px rgba(174,134,63,.4)" : p === 3 ? "0 14px 30px -12px rgba(47,125,82,.3)" : joaoSel ? "0 0 0 3px rgba(174,134,63,.18)" : "none";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(32px,5vw,56px)", alignItems: "center", width: "100%" }}>
      {/* STEPS */}
      <div style={{ flex: "1 1 360px", minWidth: 300 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((s, i) => {
            const on = i === p, done = i < p;
            return (
              <button key={i} onClick={() => jumpTo(i)} style={{ textAlign: "left", cursor: "pointer", display: "flex", gap: 15, padding: "15px 17px", borderRadius: 14, border: `1px solid ${on ? LINE : "transparent"}`, background: on ? "#fff" : "transparent", boxShadow: on ? "0 14px 34px -18px rgba(20,20,20,.22)" : "none", opacity: on ? 1 : done ? 0.9 : 0.5, transition: "opacity .3s ease,background .3s ease,border-color .3s ease,box-shadow .3s ease" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mono, fontSize: 14, fontWeight: 700, transition: "background .3s ease,color .3s ease,border-color .3s ease", background: on ? INK : done ? GOLD : "#fff", color: on || done ? "#fff" : FAINT, border: `1px solid ${on ? INK : done ? GOLD : LINE}` }}>{done ? <Check /> : "0" + (i + 1)}</div>
                <div style={{ flex: 1, paddingTop: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.4px", color: on || done ? INK : GRAY, marginBottom: 5, transition: "color .3s ease" }}>{s.t}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: GRAY, fontWeight: 400 }}>{s.d}</div>
                </div>
              </button>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 17px 0", fontSize: 12.5, color: FAINT, fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={FAINT} stroke="none"><path d="M5 2.5 19 11l-6.5 1.5L16.2 19l-2.7 1.3-3.1-6.4L5 18z" /></svg>
            Toque em qualquer etapa para revê-la
          </div>
        </div>
      </div>
      {/* DEMO */}
      <div style={{ flex: "1 1 420px", minWidth: 300 }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(20,20,20,.18),0 6px 20px rgba(20,20,20,.04)" }}>
          {/* chrome */}
          <div style={{ height: 40, display: "flex", alignItems: "center", gap: 7, padding: "0 14px", borderBottom: `1px solid ${LINE}`, background: "#F5F4F1" }}>
            {[0, 1, 2].map((k) => <span key={k} style={{ width: 9, height: 9, borderRadius: "50%", background: "#E0E0DA" }} />)}
            <span style={{ flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: 600, color: FAINT, marginRight: 27, letterSpacing: "-.1px" }}>A7Pro · Banco de Talentos</span>
          </div>
          {/* body */}
          <div style={{ padding: 16, background: "#fff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "2px 2px 13px", borderBottom: `1px solid ${LINE}`, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: FAINT, width: 44, flex: "0 0 auto" }}>Data</span>
                <Chip label="Sex 20" /><Chip label="Sáb 21" on active={p === 0} /><Chip label="Dom 22" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", color: FAINT, width: 44, flex: "0 0 auto" }}>Turno</span>
                <Chip label="Manhã" /><Chip label="Tarde" /><Chip label="Noite" on active={p === 0} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 1 }}>
                <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: INK }}>12</span>
                <span style={{ fontSize: 11.5, color: FAINT, fontWeight: 500 }}>profissionais disponíveis em Salvador</span>
              </div>
            </div>
            {p === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.35 }}>
                <div style={{ height: 66, borderRadius: 13, border: `1px solid ${LINE}`, background: "#fff" }} />
                <div style={{ height: 54, borderRadius: 13, border: `1px solid ${LINE}`, background: "#fff" }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#fff", border: `1px solid ${jBorder}`, borderRadius: 13, padding: 14, display: "flex", flexDirection: "column", gap: 11, boxShadow: jShadow, transition: "border-color .35s ease,box-shadow .35s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#F0F0EB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, letterSpacing: "-.5px", flex: "0 0 auto" }}>JS</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-.3px" }}>João S.</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: GRAY, marginTop: 1 }}><span>Garçom</span><span style={{ fontFamily: mono, color: FAINT }}>96% comparec</span></div>
                    </div>
                    <div style={{ background: INK, color: "#fff", fontWeight: 800, fontSize: 12, padding: "5px 9px", borderRadius: 8, letterSpacing: ".3px" }}>AAA</div>
                  </div>
                  <div style={{ minHeight: p >= 3 ? 56 : 34, display: "flex", flexDirection: "column", justifyContent: "flex-end", transition: "min-height .35s ease" }}><Action p={p} /></div>
                </div>
                <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 13, padding: "11px 14px", display: "flex", alignItems: "center", gap: 11, opacity: 0.5 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F0F0EB", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12.5, flex: "0 0 auto" }}>MF</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Maria F.</div>
                    <div style={{ fontSize: 12, color: GRAY }}>Garçom · Salvador</div>
                  </div>
                  <div style={{ background: "#46474b", color: "#fff", fontWeight: 800, fontSize: 11.5, padding: "4px 8px", borderRadius: 7 }}>AA</div>
                </div>
              </div>
            )}
          </div>
          {/* caption */}
          <div style={{ padding: "13px 16px", borderTop: `1px solid ${LINE}`, background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: GOLD }}>0{p + 1}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: INK, flex: "0 1 auto" }}>{capLabels[p]}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 5, flex: "0 0 130px", width: 130 }}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < p ? INK : LINE, overflow: "hidden", position: "relative", transition: "background .3s ease" }}>
                  {i === p ? <span key={"f" + p} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 0, background: GOLD, animation: `a7fill ${dur[p]}ms linear forwards` }} /> : null}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
