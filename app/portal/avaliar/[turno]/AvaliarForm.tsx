"use client";
// Form de avaliação do turno (S6). Caloroso e objetivo. As constantes são duplicadas de
// propósito: lib/avaliacao.ts é server-only (Neon/Pipefy) e não pode ser importado num
// client component. O SERVIDOR valida de forma autoritativa (validarAvaliacao) — aqui é só
// UX. React 18.3: estado de loading manual, sem startTransition async (lição S5).
import { useState } from "react";
import { useRouter } from "next/navigation";

const COMPARECIMENTOS = ["Compareceu", "Atrasou", "Faltou com aviso", "Faltou sem aviso"] as const;
const CHAMARIA = ["Sim", "Não"] as const;
const MOTIVOS = ["Atraso", "Postura", "Apresentação", "Ritmo", "Não seguiu orientação", "Outro"] as const;

// D-D: checklist obrigatório quando nota baixa OU não chamaria.
function motivoObrigatorio(estrelas: number, chamaria: string): boolean {
  return estrelas <= 3 || chamaria === "Não";
}

type Resultado = {
  ok: true;
  card: string;
  projecao: { versao: string; linhas_livro: number; cards_projetados: number };
  prova: {
    title: string;
    reputacao: { reputacao_turnos: any; n_turnos: any; data_ultima_avaliacao: any; versao_da_formula_reputacao: any };
    intocaveis: { score_a7pro: any; rating: any };
  };
};

export default function AvaliarForm({
  turnoId,
  nome,
  primeiroNome,
}: {
  turnoId: number;
  nome: string;
  primeiroNome: string;
}) {
  const [comp, setComp] = useState<string>("");
  const [estrelas, setEstrelas] = useState<number>(0);
  const [chamaria, setChamaria] = useState<string>("");
  const [motivo, setMotivo] = useState<string[]>([]);
  const [obs, setObs] = useState<string>("");
  const [erro, setErro] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<Resultado | null>(null);
  const router = useRouter();

  const precisaMotivo = estrelas >= 1 && !!chamaria && motivoObrigatorio(estrelas, chamaria);
  const ready =
    !!comp && estrelas >= 1 && !!chamaria && (!precisaMotivo || motivo.length > 0) && !pending;

  function toggleMotivo(m: string) {
    setMotivo((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  async function onEnviar() {
    setErro("");
    setPending(true);
    try {
      const res = await fetch("/api/portal/avaliar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          turnoId,
          comparecimento: comp,
          estrelas,
          chamaria,
          motivo: precisaMotivo ? motivo : [],
          obs: obs.trim(),
        }),
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        setDone(j as Resultado);
      } else {
        setErro(j?.erro || "Não consegui registrar. Tente de novo.");
        setPending(false);
      }
    } catch {
      setErro("Falha de rede. Tente de novo.");
      setPending(false);
    }
  }

  // ---------- ESTADO PÓS-ENVIO ----------
  if (done) {
    return (
      <div style={{ marginTop: 16 }}>
        <div className="reserva" style={{ background: "#f0f7ee", borderColor: "#cfe6c6", borderLeftColor: "#2f7d52" }}>
          <span className="ic" style={{ color: "#2f7d52" }}>✓</span>
          <div>
            Pronto! A avaliação de <b>{nome}</b> foi registrada. Ela entra na reputação do profissional e ajuda a próxima empresa a escolher melhor. O selo de entrada dele não muda.
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button className="gobtn" onClick={() => router.push("/portal/turnos")}>← Voltar aos turnos</button>
        </div>
      </div>
    );
  }

  // ---------- FORM ----------
  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#46474b", margin: "18px 0 8px" };
  const chipBase: React.CSSProperties = {
    border: "1px solid #d8d3c6", background: "#fff", borderRadius: 20, padding: "8px 15px",
    fontSize: 13, cursor: "pointer", fontWeight: 600, color: "#46474b",
  };
  const chipOn: React.CSSProperties = { ...chipBase, background: "#231F20", color: "#fff", borderColor: "#231F20" };

  return (
    <div style={{ marginTop: 6 }}>
      {/* COMPARECIMENTO */}
      <div style={labelStyle}>{primeiroNome} compareceu?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {COMPARECIMENTOS.map((c) => (
          <button key={c} type="button" style={comp === c ? chipOn : chipBase} onClick={() => setComp(c)}>{c}</button>
        ))}
      </div>

      {/* ESTRELAS */}
      <div style={labelStyle}>Que nota você dá pro trabalho?</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`${s} estrela${s > 1 ? "s" : ""}`}
            onClick={() => setEstrelas(s)}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 30, lineHeight: 1, color: s <= estrelas ? "#AE863F" : "#d8d3c6", padding: "0 2px" }}
          >
            ★
          </button>
        ))}
        {estrelas > 0 && <span style={{ marginLeft: 8, fontSize: 13, color: "#7a7b7e" }}>{estrelas}/5</span>}
      </div>

      {/* CHAMARIA */}
      <div style={labelStyle}>Chamaria {primeiroNome} de novo?</div>
      <div style={{ display: "flex", gap: 8 }}>
        {CHAMARIA.map((c) => (
          <button key={c} type="button" style={chamaria === c ? chipOn : chipBase} onClick={() => setChamaria(c)}>{c}</button>
        ))}
      </div>

      {/* MOTIVO (condicional D-D) */}
      {precisaMotivo && (
        <>
          <div style={labelStyle}>O que pesou? <span style={{ color: "#b4452f", fontWeight: 700 }}>*</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MOTIVOS.map((m) => (
              <button key={m} type="button" style={motivo.includes(m) ? chipOn : chipBase} onClick={() => toggleMotivo(m)}>{m}</button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "#7a7b7e", marginTop: 6 }}>Obrigatório quando a nota é ≤ 3 ou você não chamaria de novo.</div>
        </>
      )}

      {/* OBS interna */}
      <div style={labelStyle}>Observação <span style={{ color: "#9b9c9e", fontWeight: 400 }}>(opcional, uso interno)</span></div>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        rows={3}
        placeholder="Anotação sua, não aparece pro profissional nem pra outras empresas."
        style={{ width: "100%", border: "1px solid #d8d3c6", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", resize: "vertical" }}
      />
      <div style={{ fontSize: 11.5, color: "#7a7b7e", marginTop: 5 }}>🔒 A observação é interna do A7Pro. O profissional nunca vê quem avaliou.</div>

      {erro && <div className="widen on" style={{ marginTop: 14 }}><span>!</span><div>{erro}</div></div>}

      <div style={{ marginTop: 20 }}>
        <button className="gobtn" disabled={!ready} onClick={onEnviar}>
          {pending ? "Registrando…" : "Registrar avaliação"}
        </button>
      </div>
    </div>
  );
}
