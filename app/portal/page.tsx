import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "./portal.css";
import { getTalentCards, type TalentCard } from "@/lib/talent";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { Vitrine } from "./Vitrine";

// Fora dos buscadores.
export const metadata: Metadata = {
  title: "A7Pro · Banco de Talentos — Portal da Empresa",
  robots: { index: false, follow: false },
};

// Página dinâmica: renderiza a cada request (os dados já têm cache de 120s na
// camada talent.ts). Evita servir um prerender estático preso em estado antigo.
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  // TRAVA DE ACESSO (piso jurídico, Anexo 4.1): os perfis do Bloco 1 só podem ser
  // servidos a quem (a) tem sessão válida E (b) é assinante ativo OU está na
  // allowlist de dogfood. Sem isso, NENHUMA identidade é buscada nem trafega: a
  // chamada a getTalentCards() acontece SÓ depois do gate aprovar.
  const session = getSession();
  if (!session) redirect("/entrar");

  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) redirect("/entrar?status=sem-acesso");

  let cards: TalentCard[] = [];
  let erro = false;
  try {
    cards = await getTalentCards();
  } catch {
    erro = true;
  }
  const funcoes = Array.from(new Set(cards.map((c) => c.funcao).filter((f): f is string => !!f))).sort();

  return (
    <>
      <header>
        <div className="hd">
          <div className="logo"><span className="mk">a7</span>pro <span className="sub">Banco de Talentos</span></div>
          <div className="who">{session.email} · <b>Plano Fundador</b><br /><a href="/api/auth/sair" style={{ color: "#9b9c9e", fontSize: 11.5 }}>Sair</a></div>
        </div>
      </header>

      <main className="wrap">
        <section className="intro">
          <div className="eyebrow"><span className="bar" /><span>Agora é com você</span></div>
          <h1>Convoque seu time e <span className="g">reserve o turno</span>, tudo na plataforma.</h1>
          <p className="lead">Diga a função, a data, o horário e o valor da diária. Você vê só profissionais disponíveis que <b>já aceitam esse valor</b>, com transporte incluso.</p>
          <div className="reserva"><span className="ic">★</span><div>Quando um profissional aceita a sua proposta, ele fica <b>reservado para você</b> e sai da vitrine das outras empresas. Por isso feche pela plataforma: quem convoca primeiro, garante o time.</div></div>
        </section>

        {erro && (
          <div className="placeholder" style={{ marginTop: 8 }}>
            <div className="big">Não foi possível carregar a vitrine agora.</div>
            Tente recarregar em instantes.
          </div>
        )}

        <Vitrine cards={cards} funcoes={funcoes} />
      </main>

      <footer>
        <div className="in">
          <div className="row"><span className="ic">↧</span><div>Dados para <b>consulta na plataforma</b>. Exportar, copiar, fotografar ou armazenar fora do A7Pro é vedado pelo contrato de adesão.</div></div>
          <div className="row"><span className="ic">○</span><div>Profissionais abaixo do padrão de exibição <b>simplesmente não aparecem</b>, sem nenhuma marca ou aviso. Ausência de perfil não é avaliação negativa.</div></div>
          <div className="row"><span className="ic">✓</span><div>Nome completo, telefone, WhatsApp e e-mail são liberados <b>somente após o profissional aceitar</b> a sua oportunidade.</div></div>
        </div>
      </footer>
    </>
  );
}
