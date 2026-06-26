// TORNEIRA do "VOCÊ FOI ESCOLHIDO" (S5). É o ponto que a SKILL chama pra disparar o aviso
// de seleção no WhatsApp (com o link curto que agora REVELA empresa+endereço). Mesmo padrão
// de segredo da torneira de convite/calendário: x-a7-secret / ?secret= == REPUTACAO_SECRET||AUTH_SECRET.
//
// POST { pedidoId, marcar? } → lista de escolhidos (status='selecionado', < 3 lembretes) com
//   telefone (server-only) + link curto + prazo de 4h. Se `marcar:true`, incrementa o contador
//   de lembretes (cadência até 3×, decisão Hugo). NUNCA público — telefone sai só aqui.
import { NextResponse } from "next/server";
import { lerEscolhidosParaAviso } from "@/lib/selecao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request, url: URL): boolean {
  const esperado = process.env.REPUTACAO_SECRET || process.env.AUTH_SECRET || "";
  if (!esperado) return false;
  const dado = req.headers.get("x-a7-secret") || url.searchParams.get("secret") || "";
  return dado.length > 0 && dado === esperado;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!autorizado(req, url)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* permite ?pedidoId= sem corpo */
  }
  const pedidoId = Number(body?.pedidoId ?? url.searchParams.get("pedidoId"));
  if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ erro: "informe pedidoId" }, { status: 400 });
  }
  const marcar = body?.marcar === true || url.searchParams.get("marcar") === "1";
  try {
    const escolhidos = await lerEscolhidosParaAviso(pedidoId, { marcar });
    return NextResponse.json(
      { ok: true, pedidoId, total: escolhidos.length, escolhidos },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
