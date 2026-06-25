// TORNEIRA de EMISSÃO + DISPARO do convite (S4). É o ponto que a SKILL chama pra
// montar o disparo no WhatsApp. Mesmo padrão da torneira de calendário (link/route):
// guard por segredo (x-a7-secret / ?secret=) batendo REPUTACAO_SECRET || AUTH_SECRET.
//
// POST { pedidoId } →
//   1) emitirConvites(pedidoId)  — pool→enviado, cunha token (idempotente).
//   2) lerConvidadosParaDisparo  — junta telefone (Bloco 2, server-only) + link pronto.
// Devolve a lista de disparo COM TELEFONE — exposta SÓ aqui, sob segredo. NUNCA público.
//
// Obs: na convocação a action já chama emitirConvites; aqui é idempotente (não reemite)
// e serve pra Skill buscar a lista de quem disparar (e re-disparar se precisar).
import { NextResponse } from "next/server";
import { emitirConvites, lerConvidadosParaDisparo } from "@/lib/convites";

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
  try {
    const emitidos = await emitirConvites(pedidoId);
    const convidados = await lerConvidadosParaDisparo(pedidoId);
    return NextResponse.json(
      { ok: true, pedidoId, emitidosAgora: emitidos.length, total: convidados.length, convidados },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
