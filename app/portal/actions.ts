"use server";
// Server action de CONVOCAÇÃO (S3). Roda no servidor (tem AUTH_SECRET/DATABASE_URL/
// PIPEFY_TOKEN). Gateia pela sessão da empresa, monta o pool (match via Neon) e
// persiste pedido + convites status='pool'. NÃO dispara WhatsApp (isso é S4).
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { montarPool, type PedidoInput } from "@/lib/match";
import { criarPedido, persistirPool } from "@/lib/pedidos";

// Cliente 00: o dogfood interno opera como a empresa "Blue".
function empresaDaSessao(_email: string): string {
  return "Blue";
}

// NÃO exportar (módulo "use server" só pode exportar funções async). Tipo interno.
type ConvocarResult =
  | { ok: true; pedidoId: number; total: number; metaMinima: number; atingiuMinimo: boolean }
  | { ok: false; erro: string };

export async function convocar(input: PedidoInput): Promise<ConvocarResult> {
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
  if (!funcao || !data || !inicio || !(valor > 0) || !(vagas >= 1)) {
    return { ok: false, erro: "Preencha função, data, horário, valor e quantas pessoas." };
  }

  try {
    const pool = await montarPool({ funcao, data, inicio, valor, vagas });
    const empresa = empresaDaSessao(session.email);
    const pedidoId = await criarPedido({ empresa, funcao, data, inicio, valor, vagas });
    await persistirPool(pedidoId, pool.aptos.map((a) => a.card));
    return {
      ok: true,
      pedidoId,
      total: pool.total,
      metaMinima: pool.metaMinima,
      atingiuMinimo: pool.atingiuMinimo,
    };
  } catch {
    return { ok: false, erro: "Não consegui montar o pool agora. Tente de novo em instantes." };
  }
}
