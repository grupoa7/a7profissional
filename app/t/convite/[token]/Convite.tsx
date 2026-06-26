"use client";
// Cartão do convite — agora com TODO o ciclo do trabalhador (S4 cego + S5 revelado).
// Tom CALOROSO, mobile-first. Estados:
//   convite      → cego: bairro·função·valor·horário·data + "Tenho interesse" (S4)
//   interesse    → cego: "você está na lista" (S4)
//   selecionado  → REVELADO: empresa+endereço + "Confirmar presença" / "Não vou poder" (S5)
//   confirmado   → REVELADO: "tudo certo, combine os detalhes" (S5 · turno nasceu)
//   recusado     → "tranquilo, fica pra próxima" (S5)
//   encerrado    → oportunidade encerrada
// A revelação (empresa/endereço) vem do SERVIDOR só quando o status é selecionado/confirmado
// (projetarRevelado). O componente NUNCA inventa empresa/endereço — usa o que veio em `initial`.
import { useState } from "react";
import { BrandMark } from "@/app/components/BrandMark";

type Base = {
  ok: true;
  bairro: string | null;
  funcao: string | null;
  valor: number | null;
  data: string | null;
  dataFmt: string;
  diaSemana: string;
  horaInicio: string | null;
  horaFim: string | null;
  primeiroNome: string;
  status: string;
  encerrado: boolean;
};
type ConviteCego = Base & { revelado: false };
type ConviteRevelado = Base & {
  revelado: true;
  empresa: string | null;
  endereco: string | null;
  prazoConfirmarAte: string | null;
};
type ConviteView = ConviteCego | ConviteRevelado;

type Estado = "convite" | "interesse" | "selecionado" | "confirmado" | "recusado" | "encerrado";

function estadoInicial(i: ConviteView): Estado {
  if (i.status === "confirmado") return "confirmado";
  if (i.status === "recusado") return "recusado";
  if (i.status === "selecionado") return "selecionado";
  if (i.encerrado) return "encerrado";
  if (i.status === "interesse") return "interesse";
  return "convite";
}

export default function Convite({ conviteRef, initial }: { conviteRef: string; initial: ConviteView }) {
  const [estado, setEstado] = useState<Estado>(estadoInicial(initial));
  const [erro, setErro] = useState("");
  const [pending, setPending] = useState<"" | "interesse" | "confirmar" | "recusar">("");
  const rev = initial.revelado ? initial : null;

  async function acao(tipo: "interesse" | "confirmar" | "recusar") {
    setErro("");
    setPending(tipo);
    try {
      const r = await fetch("/api/t/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: conviteRef, acao: tipo }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        if (tipo === "interesse") setEstado("interesse");
        else if (tipo === "confirmar") setEstado("confirmado");
        else setEstado("recusado");
      } else if (d.erro === "encerrado") {
        setEstado("encerrado");
      } else {
        setErro("Não consegui registrar agora. Tenta de novo em instantes.");
        setPending("");
      }
    } catch {
      setErro("Falha de conexão. Tenta de novo.");
      setPending("");
    }
  }

  // ---- tela: turno confirmado (REVELADO) ----
  if (estado === "confirmado") {
    return (
      <div className="cv-card">
        <Logo />
        <div className="cv-ok-badge">✓ Presença confirmada</div>
        <h1 className="cv-hi">Fechou, {initial.primeiroNome}! 🎉</h1>
        <p className="cv-lead">Tá tudo certo pra sua diária. Anota os detalhes e, se precisar, já pode combinar direto com a empresa.</p>
        <div className="cv-detalhe">
          {rev?.empresa && <Linha ic="🏢" k="Empresa" v={rev.empresa} />}
          <Linha ic="📅" k="Quando" v={`${initial.dataFmt} (${initial.diaSemana})`} />
          <Linha ic="🕐" k="Horário" v={`a partir das ${initial.horaInicio ?? "—"}, 9h no total`} sub="8h de trabalho + 1h de intervalo" />
          {rev?.endereco
            ? <Linha ic="📍" k="Endereço" v={rev.endereco} />
            : <Linha ic="📍" k="Bairro" v={initial.bairro ?? "—"} />}
          <Linha ic="💰" k="Valor da diária" v={initial.valor != null ? `R$ ${initial.valor}` : "—"} sub="já com o transporte (ida e volta)" />
        </div>
        <div className="cv-reminder">
          O combinado de sempre: <b>aparecer no dia e horário é o que constrói a sua pontuação</b>. É ela que faz as próximas oportunidades chegarem mais rápido.
        </div>
      </div>
    );
  }

  // ---- tela: recusou ----
  if (estado === "recusado") {
    return (
      <div className="cv-card">
        <Logo />
        <h1 className="cv-hi">Tudo certo, {initial.primeiroNome}.</h1>
        <p className="cv-lead">Você abriu mão dessa diária, sem problema nenhum: isso não te prejudica. A empresa segue com a lista e logo aparece outra com a sua cara. 🙂</p>
      </div>
    );
  }

  // ---- tela: ESCOLHIDO (REVELADO) — confirma ou recusa ----
  if (estado === "selecionado") {
    return (
      <div className="cv-card">
        <Logo />
        <div className="cv-ok-badge cv-escolhido">★ Você foi escolhido!</div>
        <h1 className="cv-hi">Boa, {initial.primeiroNome}! A empresa te escolheu. 🙌</h1>
        <p className="cv-lead">Agora sim dá pra ver tudo. Confirme a presença pra fechar a diária:</p>

        <div className="cv-detalhe cv-detalhe-reveal">
          {rev?.empresa && <Linha ic="🏢" k="Empresa" v={rev.empresa} />}
          <Linha ic="📅" k="Quando" v={`${initial.dataFmt} (${initial.diaSemana})`} />
          <Linha ic="🕐" k="Horário" v={`a partir das ${initial.horaInicio ?? "—"}, 9h no total`} sub="8h de trabalho + 1h de intervalo" />
          {rev?.endereco
            ? <Linha ic="📍" k="Endereço" v={rev.endereco} sub={initial.bairro ?? undefined} />
            : <Linha ic="📍" k="Bairro" v={initial.bairro ?? "—"} />}
          <Linha ic="💰" k="Valor da diária" v={initial.valor != null ? `R$ ${initial.valor}` : "—"} sub="já com o transporte (ida e volta)" />
        </div>

        <div className="cv-aviso">
          ⚠️ Só confirme se você <b>realmente vai</b>. Confirmar e não aparecer no dia é o que mais prejudica a sua pontuação. Se não der mais, toque em <b>"Não vou poder"</b>: sem problema, a empresa chama outra pessoa.
        </div>

        <button className="cv-btn" disabled={!!pending} onClick={() => acao("confirmar")}>
          {pending === "confirmar" ? "Confirmando…" : "Confirmar presença →"}
        </button>
        <button className="cv-btn-sec" disabled={!!pending} onClick={() => acao("recusar")}>
          {pending === "recusar" ? "Registrando…" : "Não vou poder"}
        </button>
        {erro && <div className="cv-erro">{erro}</div>}
        <p className="cv-rodape">Ao confirmar, seu contato é liberado pra empresa e o contato dela pra você — aí é só combinar os detalhes.</p>
      </div>
    );
  }

  // ---- tela: oportunidade encerrada ----
  if (estado === "encerrado") {
    return (
      <div className="cv-card">
        <Logo />
        <h1 className="cv-hi">Essa oportunidade já encerrou</h1>
        <p className="cv-lead">Dessa vez não deu, mas fica tranquilo: isso não te prejudica em nada. Logo aparece outra com a sua cara. 🙂</p>
      </div>
    );
  }

  // ---- tela: já topou (pós-interesse, AINDA CEGO — D-E) ----
  if (estado === "interesse") {
    return (
      <div className="cv-card">
        <Logo />
        <div className="cv-ok-badge">✓ Interesse confirmado</div>
        <h1 className="cv-hi">Boa, {initial.primeiroNome}! Você está na lista.</h1>
        <p className="cv-lead">
          Agora é com a empresa. <b>Se você for escolhido</b>, a gente te manda os detalhes do local e você confirma a presença. Pode ficar de olho no WhatsApp.
        </p>
        <div className="cv-reminder">
          Lembra do combinado: se rolar e te escolherem, <b>aparecer no dia é o que constrói a sua pontuação</b>. É ela que faz as próximas oportunidades chegarem mais rápido.
        </div>
      </div>
    );
  }

  // ---- tela: o convite cego ----
  return (
    <div className="cv-card">
      <Logo />
      <h1 className="cv-hi">Oi, {initial.primeiroNome}! 👋</h1>
      <p className="cv-lead">
        Tem empresa procurando profissional de <b>{initial.funcao ?? "—"}</b> pra uma diária e o seu perfil combinou. Olha os detalhes:
      </p>

      <div className="cv-detalhe">
        <Linha ic="📅" k="Quando" v={`${initial.dataFmt} (${initial.diaSemana})`} />
        <Linha
          ic="🕐"
          k="Horário"
          v={`a partir das ${initial.horaInicio ?? "—"}, 9h no total`}
          sub="8h de trabalho + 1h de intervalo"
        />
        <Linha ic="📍" k="Bairro" v={initial.bairro ?? "—"} />
        <Linha
          ic="💰"
          k="Valor da diária"
          v={initial.valor != null ? `R$ ${initial.valor}` : "—"}
          sub="já com o transporte (ida e volta)"
        />
      </div>

      <p className="cv-pergunta">Você tem disponibilidade nesse dia e horário pra eu te indicar ao A7Pro pra essa empresa?</p>

      <div className="cv-aviso">
        ⚠️ Só toque em <b>Tenho interesse</b> se você puder e quiser mesmo ir. Não poder dessa vez não tem problema nenhum, não te prejudica em nada. O que pega de verdade é dizer sim, ser escolhido e não aparecer no dia. <b>Isso diminui a sua pontuação.</b>
      </div>

      <p className="cv-urgencia">Quanto antes você confirmar, maior a chance da empresa te convidar.</p>

      <button className="cv-btn" disabled={!!pending} onClick={() => acao("interesse")}>
        {pending === "interesse" ? "Confirmando…" : "Tenho interesse →"}
      </button>
      {erro && <div className="cv-erro">{erro}</div>}

      <p className="cv-rodape">Seus dados de contato só são liberados pra empresa se você for escolhido. Até lá, é tudo pelo A7Pro.</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="cv-logo">
      <BrandMark size={24} />
    </div>
  );
}

function Linha({ ic, k, v, sub }: { ic: string; k: string; v: string; sub?: string }) {
  return (
    <div className="cv-linha">
      <span className="cv-ic">{ic}</span>
      <div>
        <span className="cv-k">{k}</span>
        <span className="cv-v">{v}</span>
        {sub && <span className="cv-sub">{sub}</span>}
      </div>
    </div>
  );
}
