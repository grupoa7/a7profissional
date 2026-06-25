// Rota de PRODUÇÃO da projeção de reputação.
// Lê o livro-razão (Neon) → projeta (REPUT v1.0) → grava os 4 campos no banco Pipefy.
// Em S6 é chamada após cada avaliação; aqui já fica de pé, guardada por segredo.
//
// GUARD: header `x-a7-secret` (ou ?secret=) deve bater com REPUTACAO_SECRET (se setado)
// ou, no fallback do dogfood, com AUTH_SECRET. Sem segredo correto → 401.
import { NextResponse } from "next/server";
import { projetarEEscrever, garantirCamposReputacao } from "@/lib/reputacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request): boolean {
  const esperado = process.env.REPUTACAO_SECRET || process.env.AUTH_SECRET || "";
  if (!esperado) return false;
  const url = new URL(req.url);
  const dado = req.headers.get("x-a7-secret") || url.searchParams.get("secret") || "";
  return dado.length > 0 && dado === esperado;
}

export async function POST(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  try {
    // garante os 4 campos antes de escrever (idempotente; no-op se já existem).
    const campos = await garantirCamposReputacao();
    const faltando = campos.filter((c) => c.status === "ERRO");
    if (faltando.length) {
      return NextResponse.json({ erro: "campos de reputação indisponíveis", campos }, { status: 500 });
    }
    const resultado = await projetarEEscrever();
    return NextResponse.json({ ok: true, campos, ...resultado });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 300) }, { status: 500 });
  }
}
