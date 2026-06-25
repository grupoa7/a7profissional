// API PÚBLICA do CONVITE CEGO (S4 · sem login). O link mágico É a chave.
// GET  ?t=<token>  → conviteView (payload CEGO — NUNCA empresa/endereco).
// POST { t }       → registrarInteresse (enviado→interesse, idempotente).
//
// GUARD ÚNICO = validade do token (purpose:"convite", carrega o conviteId). NUNCA
// aceitamos conviteId/card por parâmetro → impossível abrir convite de outro (LGPD).
// O telefone do diarista NÃO sai por aqui — só pela torneira /emitir, atrás de segredo.
import { NextResponse } from "next/server";
import { conviteView, registrarInteresse } from "@/lib/convites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const view = await conviteView(t);
  if (!view.ok) {
    return NextResponse.json(view, { status: 401, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(view, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "corpo inválido" }, { status: 400 });
  }
  const r = await registrarInteresse(body?.t ?? null);
  if (!r.ok) {
    const code = r.erro === "encerrado" ? 409 : 401;
    return NextResponse.json(r, { status: code, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
