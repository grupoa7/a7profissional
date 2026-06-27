"use server";
// Server action de CONVOCAÇÃO (S3+S4, refeita em S7 · mecânica Uber ASSÍNCRONA).
// Roda no servidor (tem AUTH_SECRET/DATABASE_URL/PIPEFY_TOKEN). Gateia pela sessão da
// empresa, valida o pedido e — diferente do fluxo antigo — apenas CRIA o pedido com
// status='buscando' e devolve o id em milissegundos. O trabalho pesado (montar o pool no
// match via Pipefy, persistir e emitir os convites) saiu daqui para a rota
// /api/portal/montar, disparada pelo client logo em seguida, para não travar a tela
// (a montagem leva ~10s). A mensagem CEGA no WhatsApp segue saindo pela Skill, que lê a
// torneira /api/t/convite/emitir depois que a montagem emite os tokens.
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { type PedidoInput } from "@/lib/match";
import { criarPedido } from "@/lib/pedidos";

// Cliente 00: o dogfood interno opera como a empresa "Blue".
function empresaDaSessao(_email: string): string {
  return "Blue";
}

// Entrada do form: o match (PedidoInput) + os campos cegos do pedido (D-A).
// `endereco` fica GUARDADO OCULTO (revelado só na seleção, S5); `bairro` é o que o
// convite cego mostra.
type ConvocarInput = PedidoInput & { bairro?: string; endereco?: string };

// NÃO exportar (módulo "use server" só pode exportar funções async). Tipo interno.
// S7: a convocação devolve só o pedidoId (rápido). O pool/convites nascem depois, na
// rota /api/portal/montar, e a tela acompanha pelo polling do painel.
type ConvocarResult =
  | { ok: true; pedidoId: number }
  | { ok: false; erro: string };

export async function convocar(input: ConvocarInput): Promise<ConvocarResult> {
  const session = getSession();
  if (!session) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };

  let liberado = isDogfood(session.email);
  if (!liberado) liberado = await isActiveSubscriber(session.email);
  if (!liberado) return { ok: false, erro: "Acesso não liberado para esta conta." };

  const funcao = (input.funcao || "").trim();
  const data = (input.data || "").trim();
  const inicio = (input.inicio || "").trim();
  const valor = Number(input.valor);
  const vagas = Math.floor(Number(input.vagas));
  const bairro = (input.bairro || "").trim();
  const endereco = (input.endereco || "").trim();
  if (!funcao || !data || !inicio || !(valor > 0) || !(vagas >= 1)) {
    return { ok: false, erro: "Preencha função, data, horário, valor e quantas pessoas." };
  }
  if (!bairro) {
    return { ok: false, erro: "Informe o bairro. É o único dado de local que o profissional vê." };
  }

  try {
    const empresa = empresaDaSessao(session.email);
    // S7: nasce 'buscando' (rápido). O pool e os convites são montados depois, em
    // background, pela rota /api/portal/montar (disparada pelo client). Os ~10s de match
    // saem do caminho que trava a tela.
    const pedidoId = await criarPedido({
      empresa,
      funcao,
      data,
      inicio,
      valor,
      vagas,
      bairro,
      endereco: endereco || null, // oculto até a seleção (S5)
      status: "buscando",
    });
    return { ok: true, pedidoId };
  } catch {
    return { ok: false, erro: "Não consegui registrar sua busca agora. Tente de novo em instantes." };
  }
}
