// API do PAINEL DO PEDIDO (S5 · empresa logada). GATED POR SESSÃO — é aqui que a PII do
// pool (nome+telefone dos interessados) é liberada à empresa dona do pedido.
//   GET  ?id=X                                   → painel ao vivo (polling 8s)
//   POST { pedidoId, acao:"selecionar", conviteId } → escolhe (interesse→selecionado, hold)
//   POST { pedidoId, acao:"fechar" }                → encerra a janela (fechar agora)
//   POST { pedidoId, acao:"revelar",  conviteId }   → nome+telefone do escolhido
//
// GUARD: sem sessão liberada → 401. A empresa do pedido (Cliente 00 = "Blue") é a da sessão.
import { NextResponse } from "next/server";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { lerPainel, selecionar, fecharPedido, revelarParaEmpresa } from "@/lib/selecao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function gate(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  if (isDogfood(session.email)) return true;
  return await isActiveSubscriber(session.email);
}

export async function GET(req: Request) {
  if (!(await gate())) return NextResponse.json({ ok: false, erro: "sem sessão" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ ok: false, erro: "id" }, { status: 400 });
  const painel = await lerPainel(id);
  if (!painel) return NextResponse.json({ ok: false, erro: "pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, painel }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  if (!(await gate())) return NextResponse.json({ ok: false, erro: "sem sessão" }, { status: 401 });
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "corpo inválido" }, { status: 400 });
  }
  const pedidoId = Number(body?.pedidoId);
  const acao = String(body?.acao || "");
  if (!pedidoId) return NextResponse.json({ ok: false, erro: "pedidoId" }, { status: 400 });

  if (acao === "selecionar") {
    const r = await selecionar(pedidoId, Number(body?.conviteId));
    return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
  }
  if (acao === "fechar") {
    const r = await fecharPedido(pedidoId);
    return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
  }
  if (acao === "revelar") {
    const r = await revelarParaEmpresa(pedidoId, Number(body?.conviteId));
    return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json({ ok: false, erro: "ação desconhecida" }, { status: 400 });
}
