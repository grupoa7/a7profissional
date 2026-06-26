// API PÚBLICA do CONVITE (S4 cego + S5 ciclo do trabalhador). O link mágico É a chave.
// GET  ?ref=<slug|token>          → conviteView (CEGO ou REVELADO conforme o status).
// POST { ref, acao }              → interesse | confirmar | recusar.
//
// GUARD ÚNICO = a ref (slug curto OU token assinado), que resolve pro conviteId no servidor.
// NUNCA aceitamos conviteId/card por parâmetro → impossível agir sobre o convite de outro
// (LGPD). O telefone do diarista NÃO sai por aqui — só pela torneira /emitir, atrás de segredo.
import { NextResponse } from "next/server";
import { conviteView, registrarInteresse } from "@/lib/convites";
import { confirmarPresenca, recusar } from "@/lib/selecao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ref = q.get("ref") ?? q.get("t"); // ref = token longo OU slug curto
  const view = await conviteView(ref);
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
  const ref = body?.ref ?? body?.t ?? null;
  const acao = (body?.acao ?? "interesse") as string;

  let r: { ok: boolean; erro?: string };
  if (acao === "confirmar") r = await confirmarPresenca(ref);
  else if (acao === "recusar") r = await recusar(ref);
  else r = await registrarInteresse(ref); // default = "interesse" (compat S4)

  if (!r.ok) {
    const code = r.erro === "encerrado" ? 409 : 401;
    return NextResponse.json(r, { status: code, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(r, { headers: { "cache-control": "no-store" } });
}
