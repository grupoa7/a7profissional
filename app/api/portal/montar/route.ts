// MONTAGEM ASSÍNCRONA DA BUSCA (S7 · mecânica Uber). GATED POR SESSÃO.
// O client chama esta rota logo depois de `convocar()` (que cria o pedido 'buscando' e
// retorna na hora). Aqui roda o trabalho PESADO — montarPool (match, ~10s no Pipefy),
// persistirPool e emitirConvites — e vira o pedido para 'aberto'. A tela não fica travada:
// quem espera é o painel, com a mensagem viva de "buscando…", e o polling de 8s detecta
// quando o pedido vira 'aberto'.
//
//   POST ?pedido=X   (ou  body { pedido: X })  → monta a busca do pedido X
//
// Idempotente e seguro pra re-disparar (auto-retry do painel) — ver montarBusca().
import { NextResponse } from "next/server";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { montarBusca } from "@/lib/pedidos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// a montagem bate no Pipefy card a card (~10s) — dá folga ao serverless.
export const maxDuration = 60;

async function gate(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  if (isDogfood(session.email)) return true;
  return await isActiveSubscriber(session.email);
}

export async function POST(req: Request) {
  if (!(await gate())) return NextResponse.json({ ok: false, erro: "sem sessão" }, { status: 401 });

  let pedidoId = Number(new URL(req.url).searchParams.get("pedido"));
  if (!pedidoId) {
    try {
      const b = await req.json();
      pedidoId = Number(b?.pedido ?? b?.pedidoId);
    } catch {
      /* sem corpo — ok, exige ?pedido= */
    }
  }
  if (!pedidoId) return NextResponse.json({ ok: false, erro: "pedido" }, { status: 400 });

  const r = await montarBusca(pedidoId);
  // 200 quando montou ou já estava montado; 409 quando faltam dados / falhou no meio
  // (o painel re-tenta). Sem cache.
  return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
}
