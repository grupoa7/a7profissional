import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "./portal.css";
import { getTalentCards, type TalentCard } from "@/lib/talent";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerPedidoVivo } from "@/lib/pedidos";
import { lerPainel, type PainelPedido } from "@/lib/selecao";
import { PortalNav } from "@/app/components/PortalNav";
import { Vitrine } from "./Vitrine";

// Fora dos buscadores.
export const metadata: Metadata = {
  title: "A7Pro · Banco de Talentos · Portal da Empresa",
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

  // S7: continuidade da busca — se a empresa já tem um pedido VIVO (buscando/aberto),
  // pré-carrega o painel pra ele reaparecer inline mesmo depois de um refresh.
  let painelInicial: PainelPedido | null = null;
  try {
    const vivoId = await lerPedidoVivo("Blue");
    if (vivoId) painelInicial = await lerPainel(vivoId);
  } catch {
    /* sem pedido vivo / banco indisponível — segue só com o form */
  }

  return (
    <>
      <PortalNav email={session.email} atual="/portal" sub="Banco de Talentos" />

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

        <Vitrine funcoes={funcoes} painelInicial={painelInicial} />
      </main>

      <footer>
        <div className="in">
          <div className="row"><span className="ic">↧</span><div>Dados para <b>consulta na plataforma</b>. Copiar, exportar ou fotografar fora do A7Pro é vedado pelo contrato.</div></div>
          <div className="row"><span className="ic">○</span><div>Quem está abaixo do padrão de exibição <b>não aparece</b>, sem marca nem aviso. Ausência de perfil não é avaliação negativa.</div></div>
          <div className="row"><span className="ic">✓</span><div>Nome, telefone e e-mail são liberados <b>só depois que o profissional aceita</b>.</div></div>
        </div>
      </footer>
    </>
  );
}
