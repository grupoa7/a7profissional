// API de AVALIAÇÃO DO TURNO (S6 · empresa logada). GATED POR SESSÃO.
//   POST { turnoId, comparecimento, estrelas, chamaria, motivo[], obs }
//        → registra a avaliação no livro-razão + projeção viva (REPUT v1.0).
//
// GUARD: avaliação é AÇÃO DA EMPRESA — nunca aceita por token público do trabalhador.
// Sem sessão liberada → 401. A empresa do Cliente 00 = "Blue" (igual painel/convocar).
import { NextResponse } from "next/server";
import { getSession, isDogfood } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { registrarAvaliacao, type AvaliacaoInput } from "@/lib/avaliacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cliente 00: o dogfood interno opera como a empresa "Blue" (mesma regra de actions.ts).
const EMPRESA = "Blue";

async function gate(): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  if (isDogfood(session.email)) return true;
  return await isActiveSubscriber(session.email);
}

export async function POST(req: Request) {
  if (!(await gate())) return NextResponse.json({ ok: false, erro: "sem sessão" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "corpo inválido" }, { status: 400 });
  }

  const turnoId = Number(body?.turnoId);
  if (!turnoId) return NextResponse.json({ ok: false, erro: "turnoId" }, { status: 400 });

  const input: AvaliacaoInput = {
    comparecimento: body?.comparecimento,
    estrelas: Number(body?.estrelas),
    chamaria: body?.chamaria,
    motivo: Array.isArray(body?.motivo) ? body.motivo.map(String) : [],
    obs: typeof body?.obs === "string" ? body.obs : "",
  };

  const r = await registrarAvaliacao(EMPRESA, turnoId, input);
  // NUNCA expõe obs/avaliador: registrarAvaliacao não os devolve. A `prova` traz só os 4
  // campos de reputação + os intocáveis (score_a7pro/rating) lidos pra demonstração.
  return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "cache-control": "no-store" } });
}
