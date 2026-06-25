"use client";
// S3: a Vitrine virou o FORM DE CONVOCAÇÃO. Coleta função/data/início/valor/N e
// chama a server action `convocar`, que cria o pedido real e monta o pool (match via
// Neon). O resultado (pool com o porquê de cada apto) vive em /portal/pedidos — fonte
// única e autoritativa. O preview client-side antigo (que casava pelo Pipefy e tinha
// "Tenho interesse" falso) saiu: divergia da fonte do match e induzia ao erro.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { convocar } from "./actions";

const FUNC_FALLBACK = ["Garçom", "Auxiliar de cozinha", "Bartender", "Cozinheiro", "Recepcionista", "Auxiliar de limpeza"];

function fimDe(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + 9 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function Vitrine({ funcoes }: { funcoes: string[] }) {
  const funcOpts = funcoes.length ? funcoes : FUNC_FALLBACK;
  const [func, setFunc] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [val, setVal] = useState("");
  const [n, setN] = useState("");
  const [erro, setErro] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const ready = !!(func && data && hora && val && Number(n) >= 1);
  const fim = hora ? fimDe(hora) : "";

  async function onConvocar() {
    setErro("");
    setPending(true);
    try {
      const r = await convocar({ funcao: func, data, inicio: hora, valor: Number(val), vagas: Math.floor(Number(n)) });
      if (r.ok) router.push(`/portal/pedidos?novo=${r.pedidoId}`);
      else { setErro(r.erro); setPending(false); }
    } catch {
      setErro("Falha de rede. Tente de novo."); setPending(false);
    }
  }

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
          <div className="fb">
            <span className="k">Quantas pessoas</span>
            <input type="number" className="ctrl" min={1} max={50} step={1} value={n} placeholder="ex.: 2" onChange={(e) => setN(e.target.value)} />
            <span className="hint">Buscamos pelo menos o dobro disso pra você escolher.</span>
          </div>
        </div>

        <div className="go">
          <button className="gobtn" disabled={!ready || pending} onClick={onConvocar}>
            {pending ? "Montando o pool…" : "Convocar e montar o pool"}
          </button>
        </div>
        {erro && <div className="widen on" style={{ marginTop: 10 }}><span>!</span><div>{erro}</div></div>}

        <div className="lockval">
          <span className="ic">🔒</span>
          <div><b>O valor é fechado no aceite.</b> O convite vai com exatamente o valor e o horário que você definir aqui, e o profissional só aceita já sabendo quanto vai receber e em que turno. Por isso não há renegociação depois. Tentar mexer no valor na hora é a maior causa de desistência, e a plataforma protege os dois lados disso.</div>
        </div>
      </section>

      <section className="res">
        <div className="placeholder">
          <div className="big">Defina a vaga e clique em <b>Convocar</b></div>
          Montamos o pool com quem está disponível na sua data e horário, que já aceita o valor que você paga. Você acompanha o pool em <a href="/portal/pedidos" style={{ color: "var(--gold)", fontWeight: 700 }}>Meus pedidos</a>.
        </div>
      </section>
    </>
  );
}
