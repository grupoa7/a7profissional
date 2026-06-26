"use client";
// Cartão CEGO do convite + botão "Tenho interesse" (S4). Tom CALOROSO, mobile-first.
// Mostra SÓ bairro·função·valor·horário·data — nunca empresa/endereço. O aviso de
// compromisso (decisão Hugo D-C) deixa a pessoa alerta a só topar se for de verdade.
import { useState } from "react";

type ConviteCego = {
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

const JA_RESPONDEU = new Set(["interesse", "selecionado", "confirmado"]);

export default function Convite({ conviteRef, initial }: { conviteRef: string; initial: ConviteCego }) {
  const jaTopou = JA_RESPONDEU.has(initial.status);
  const [estado, setEstado] = useState<"convite" | "interesse" | "encerrado">(
    initial.encerrado ? "encerrado" : jaTopou ? "interesse" : "convite",
  );
  const [erro, setErro] = useState("");
  const [pending, setPending] = useState(false);

  async function topar() {
    setErro("");
    setPending(true);
    try {
      const r = await fetch("/api/t/convite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: conviteRef }),
      });
      const d = await r.json();
      if (r.ok && d.ok) setEstado("interesse");
      else if (d.erro === "encerrado") setEstado("encerrado");
      else {
        setErro("Não consegui registrar agora. Tenta de novo em instantes.");
        setPending(false);
      }
    } catch {
      setErro("Falha de conexão. Tenta de novo.");
      setPending(false);
    }
  }

  // ---- tela: oportunidade encerrada ----
  if (estado === "encerrado") {
    return (
      <div className="cv-card">
        <Logo />
        <h1 className="cv-hi">Essa oportunidade já encerrou</h1>
        <p className="cv-lead">Dessa vez não deu — mas fica tranquilo, isso não te prejudica em nada. Logo aparece outra com a sua cara. 🙂</p>
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
          v={`a partir das ${initial.horaInicio ?? "—"} — 9h no total`}
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
        ⚠️ Só toque em <b>Tenho interesse</b> se você puder e quiser mesmo ir. Não poder dessa vez não tem problema nenhum — não te prejudica em nada. O que pega de verdade é dizer sim, ser escolhido e não aparecer no dia. <b>Isso diminui a sua pontuação.</b>
      </div>

      <p className="cv-urgencia">Quanto antes você confirmar, maior a chance da empresa te convidar.</p>

      <button className="cv-btn" disabled={pending} onClick={topar}>
        {pending ? "Confirmando…" : "Tenho interesse →"}
      </button>
      {erro && <div className="cv-erro">{erro}</div>}

      <p className="cv-rodape">Seus dados de contato só são liberados pra empresa se você for escolhido. Até lá, é tudo pelo A7Pro.</p>
    </div>
  );
}

function Logo() {
  return (
    <div className="cv-logo">
      <span className="cv-logo-badge">a7</span>pro
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
