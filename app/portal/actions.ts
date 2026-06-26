"use server";
// Server action de CONVOCAÇÃO (S3 + S4). Roda no servidor (tem AUTH_SECRET/DATABASE_URL/
// PIPEFY_TOKEN). Gateia pela sessão da empresa, monta o pool (match via Neon), persiste
// pedido + convites status='pool' e — S4 / decisão Hugo D-B (modelo de dois convites) —
// EMITE os convites na mesma operação (pool→enviado, cunha token). O disparo da mensagem
// CEGA no WhatsApp é feito pela Skill, que lê a torneira /api/t/convite/emitir.
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { montarPool, type PedidoInput } from "@/lib/match";
import { criarPedido, persistirPool } from "@/lib/pedidos";
import { emitirConvites } from "@/lib/convites";

// Cliente 00: o dogfood interno opera como a empresa "Blue".
function empresaDaSessao(_email: string): string {
  return "Blue";
}

// Entrada do form: o match (PedidoInput) + os campos cegos do pedido (D-A).
// `endereco` fica GUARDADO OCULTO (revelado só na seleção, S5); `bairro` é o que o
// convite cego mostra.
type ConvocarInput = PedidoInput & { bairro?: string; endereco?: string };

// NÃO exportar (módulo "use server" só pode exportar funções async). Tipo interno.
type ConvocarResult =
  | {
      ok: true;
      pedidoId: number;
      total: number;
      metaMinima: number;
      atingiuMinimo: boolean;
      emitidos: number;
    }
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
    return { ok: false, erro: "Informe o bairro — é o que o convite cego mostra ao profissional." };
  }

  try {
    const pool = await montarPool({ funcao, data, inicio, valor, vagas });
    const empresa = empresaDaSessao(session.email);
    const pedidoId = await criarPedido({
      empresa,
      funcao,
      data,
      inicio,
      valor,
      vagas,
      bairro,
      endereco: endereco || null, // oculto até a seleção (S5)
    });
    await persistirPool(pedidoId, pool.aptos.map((a) => a.card));
    // D-B: disparo "automático" — emite os tokens já na convocação. A mensagem CEGA
    // sai pela Skill (carteiro WhatsApp), lendo a torneira /api/t/convite/emitir.
    const emitidos = await emitirConvites(pedidoId);
    return {
      ok: true,
      pedidoId,
      total: pool.total,
      metaMinima: pool.metaMinima,
      atingiuMinimo: pool.atingiuMinimo,
      emitidos: emitidos.length,
    };
  } catch {
    return { ok: false, erro: "Não consegui montar o pool agora. Tente de novo em instantes." };
  }
}
