"use client";
// S7: a Vitrine é o FORM DE BUSCA + o PAINEL AO VIVO inline, tudo na mesma página
// (estilo Uber). Coleta função/data/início/valor/N, chama a server action `convocar`
// (que cria o pedido 'buscando' e devolve rápido), dispara a montagem em background e
// renderiza o painel da busca logo abaixo do form — sem trocar de rota. O acompanhamento
// (cards entrando, mensagem viva, seleção) vive no PainelPedido, reusado aqui.
import { useState } from "react";
import { convocar } from "./actions";
import PainelPedido from "./pedidos/PainelPedido";
import type { PainelPedido as PainelData } from "@/lib/selecao";

const FUNC_FALLBACK = ["Garçom", "Auxiliar de cozinha", "Bartender", "Cozinheiro", "Recepcionista", "Auxiliar de limpeza"];

function fimDe(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + m + 9 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function Vitrine({ funcoes, painelInicial }: { funcoes: string[]; painelInicial?: PainelData | null }) {
  const funcOpts = funcoes.length ? funcoes : FUNC_FALLBACK;
  const [func, setFunc] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [val, setVal] = useState("");
  const [n, setN] = useState("");
  const [bairro, setBairro] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erro, setErro] = useState("");
  const [pending, setPending] = useState(false);
  // busca ativa exibida inline: id do pedido + painel inicial (quando pré-carregado pelo
  // servidor). Recém-criada vem com initial=null e o painel busca sozinho.
  const [ativo, setAtivo] = useState<{ id: number; initial: PainelData | null } | null>(
    painelInicial ? { id: painelInicial.pedidoId, initial: painelInicial } : null,
  );

  const ready = !!(func && data && hora && val && Number(n) >= 1 && bairro.trim());
  const fim = hora ? fimDe(hora) : "";

  async function onConvocar() {
    setErro("");
    setPending(true);
    try {
      const r = await convocar({ funcao: func, data, inicio: hora, valor: Number(val), vagas: Math.floor(Number(n)), bairro: bairro.trim(), endereco: endereco.trim() });
      if (r.ok) {
        // S7: dispara o trabalho pesado (montar pool + emitir convites) em background,
        // SEM travar a tela. O painel inline acompanha pelo polling; o auto-retry dele
        // recupera se este disparo falhar.
        fetch(`/api/portal/montar?pedido=${r.pedidoId}`, { method: "POST" }).catch(() => {});
        setAtivo({ id: r.pedidoId, initial: null });
        setPending(false);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      } else { setErro(r.erro); setPending(false); }
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
              <input type="time" className="ctrl ro" value={fim} readOnly tabIndex={-1} aria-label="Término (automático)" />
            </div>
            <span className="hint">Você escolhe o início. O término é <b>automático</b>: 8h de trabalho mais 1h de descanso.</span>
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
            <span className="hint">Quantas pessoas você precisa para esse turno.</span>
          </div>
          <div className="fb">
            <span className="k">Bairro</span>
            <input type="text" className="ctrl" value={bairro} placeholder="ex.: Jardim de Alah" onChange={(e) => setBairro(e.target.value)} />
            <span className="hint">É o único dado de local que o profissional vê. A empresa fica oculta.</span>
          </div>
          <div className="fb">
            <span className="k">Endereço completo <span style={{ color: "var(--faint)", fontWeight: 400 }}>(opcional)</span></span>
            <input type="text" className="ctrl" value={endereco} placeholder="Rua, nº, ponto de referência" onChange={(e) => setEndereco(e.target.value)} />
            <span className="hint">🔒 Fica guardado e só é revelado a quem você escolher.</span>
          </div>
        </div>

        <div className="go">
          <button className="gobtn" disabled={!ready || pending} onClick={onConvocar}>
            {pending ? "Iniciando busca…" : "Buscar profissionais"}
          </button>
        </div>
        {erro && <div className="widen on" style={{ marginTop: 10 }}><span>!</span><div>{erro}</div></div>}

        <div className="lockval">
          <span className="ic">🔒</span>
          <div><b>O valor é fechado no aceite.</b> O convite vai com exatamente o valor e o horário que você definir aqui, e o profissional só aceita já sabendo quanto vai receber e em que turno. Por isso não há renegociação depois. Tentar mexer no valor na hora é a maior causa de desistência, e a plataforma protege os dois lados disso.</div>
        </div>
      </section>

      {ativo ? (
        <PainelPedido pedidoId={ativo.id} initial={ativo.initial} onNovaBusca={() => setAtivo(null)} />
      ) : (
        <section className="res">
          <div className="placeholder">
            <div className="big">Defina a vaga e clique em <b>Buscar profissionais</b></div>
            Mostramos quem está disponível na sua data e horário e já aceita o valor que você paga. Os profissionais aparecem aqui mesmo, conforme respondem.
          </div>
        </section>
      )}
    </>
  );
}
