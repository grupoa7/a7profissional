import type { Metadata } from "next";
import "./portal.css";
import { getTalentCards, type TalentCard } from "@/lib/talent";
import { Vitrine } from "./Vitrine";

// Enquanto o gate de login (Checkpoint 3) não existe, mantém fora dos buscadores.
export const metadata: Metadata = {
  title: "A7Pro · Banco de Talentos — Portal da Empresa",
  robots: { index: false, follow: false },
};

// Página dinâmica: renderiza a cada request (os dados já têm cache de 120s na
// camada talent.ts). Evita servir um prerender estático preso em estado antigo.
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  // TRAVA DE ACESSO (piso jurídico, Anexo 4.1): perfis do Bloco 1 só podem ser
  // servidos a assinante ativo. Enquanto o login (Checkpoint 3) não existe, NÃO
  // enviamos identidades ao cliente. A flag PORTAL_DOGFOOD habilita só em ambiente
  // controlado; o gate real de assinatura substitui isto no Checkpoint 3.
  const liberado = process.env.PORTAL_DOGFOOD === "1";
  let cards: TalentCard[] = [];
  let erro = false;
  if (liberado) {
    try {
      cards = await getTalentCards();
    } catch {
      erro = true;
    }
  }
  const funcoes = Array.from(new Set(cards.map((c) => c.funcao).filter((f): f is string => !!f))).sort();

  return (
    <>
      <header>
        <div className="hd">
          <div className="logo"><span className="mk">a7</span>pro <span className="sub">Banco de Talentos</span></div>
          <div className="who">Empresa parceira · <b>Plano Fundador</b></div>
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
