"use client";
import { useEffect, useState } from "react";

const mono = "'SF Mono',ui-monospace,'Roboto Mono',Menlo,monospace";
const INK = "#231F20", GOLD = "#AE863F", LINE = "#E8E8E3", FAINT = "#9b9c9e", OK = "#2f7d52";

const dates = [
  { dow: "QUI", d: "19", long: "quinta, dia 19", elite: 28, cats: [12, 6, 4, 9] },
  { dow: "SEX", d: "20", long: "sexta, dia 20", elite: 44, cats: [18, 8, 7, 11] },
  { dow: "SÁB", d: "21", long: "sábado, dia 21", elite: 59, cats: [23, 11, 8, 17] },
  { dow: "DOM", d: "22", long: "domingo, dia 22", elite: 36, cats: [16, 9, 5, 12] },
];
const catMeta = [
  { label: "garçons", tag: "AA/AAA" },
  { label: "auxiliares de cozinha" },
  { label: "bartenders" },
  { label: "cozinheiros" },
] as { label: string; tag?: string }[];

function colsFor(w: number) { return w >= 900 ? 4 : w >= 560 ? 2 : 1; }

export function AvailabilityBoard() {
  const [idx, setIdx] = useState(2);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const f = () => setCols(colsFor(window.innerWidth));
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const sel = dates[idx];
  return (
    <div>
      {/* selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".9px", color: FAINT }}>Selecione a data</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {dates.map((dd, i) => {
            const on = i === idx;
            return (
              <button key={i} onClick={() => setIdx(i)} style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 54, padding: "8px 13px", borderRadius: 11, border: `1px solid ${on ? INK : LINE}`, background: on ? INK : "#fff", color: on ? "#fff" : INK, transition: "all .15s" }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".6px", opacity: on ? .7 : .5 }}>{dd.dow}</span>
                <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 700, letterSpacing: "-.5px" }}>{dd.d}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* panel */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 30px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "22px 26px", marginBottom: 14, boxShadow: "0 18px 50px -28px rgba(20,20,20,.16)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: mono, fontSize: "clamp(42px,6vw,56px)", fontWeight: 700, letterSpacing: "-2.5px", lineHeight: 1, color: INK }}>{sel.elite}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".7px", color: GOLD }}>Selo AA/AAA</div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".7px", color: FAINT, marginTop: 3 }}>90%+ comparecimento</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 11, paddingLeft: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: OK, display: "block", animation: "a7pulse 2.2s infinite", flex: "0 0 auto" }} />
          <p style={{ fontSize: 15.5, fontWeight: 500, color: INK, lineHeight: 1.45, margin: 0 }}>profissionais de alto padrão livres <b style={{ fontWeight: 700 }}>no {sel.long}.</b></p>
        </div>
      </div>
      {/* grid */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 14 }}>
        {catMeta.map((c, i) => (
          <div key={i} className="catcard" style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 15, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex" }}>
                {[0, 1, 2].map((k) => <span key={k} style={{ width: 30, height: 30, borderRadius: "50%", background: k % 2 ? "#dedcd4" : "#E8E8E3", filter: "blur(.6px)", display: "block", border: "2px solid #fff", marginLeft: k ? -11 : 0 }} />)}
              </div>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: OK, display: "block", animation: "a7pulse 2.2s infinite" }} />
            </div>
            <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1 }}>{sel.cats[i]}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, letterSpacing: "-.3px" }}>{c.label}{c.tag ? <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, letterSpacing: ".3px" }}> {c.tag}</span> : null}</div>
            <div style={{ fontSize: 13, color: FAINT, marginTop: 7, fontWeight: 500 }}>Salvador</div>
          </div>
        ))}
      </div>
    </div>
  );
}
