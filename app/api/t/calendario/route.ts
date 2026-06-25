// API do PERFIL-CALENDÁRIO do trabalhador (S2).
// GET  ?t=<token>  → carrega a disponibilidade viva (pré-marcada da semente se 1ª vez).
// POST { t, dias, turnos, valorSegSex, valorFds } → salva (upsert) e renova o frescor.
//
// GUARD ÚNICO = validade do token de calendário (purpose:"calendar"). O token carrega
// o `card` do próprio diarista; NUNCA aceitamos card por parâmetro → impossível abrir
// o calendário de outro titular (isolamento LGPD). Sem login, mas sem vazar.
import { NextResponse } from "next/server";
import { verifyCalendarToken } from "@/lib/auth";
import { lerDisponibilidade, salvarDisponibilidade } from "@/lib/calendario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cardDoToken(token: string | null): string | null {
  const p = verifyCalendarToken(token);
  return p?.card ?? null;
}

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const card = cardDoToken(t);
  if (!card) {
    return NextResponse.json({ erro: "link inválido ou expirado" }, { status: 401 });
  }
  try {
    const view = await lerDisponibilidade(card);
    return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }
  const card = cardDoToken(body?.t ?? null);
  if (!card) {
    return NextResponse.json({ erro: "link inválido ou expirado" }, { status: 401 });
  }
  try {
    const view = await salvarDisponibilidade(card, {
      dias: Array.isArray(body.dias) ? body.dias : [],
      horaInicio: typeof body.horaInicio === "string" ? body.horaInicio : null,
      horaFim: typeof body.horaFim === "string" ? body.horaFim : null,
      feriados: body.feriados === true,
      valorSegSex: typeof body.valorSegSex === "number" ? body.valorSegSex : null,
      valorFds: typeof body.valorFds === "number" ? body.valorFds : null,
    });
    return NextResponse.json({ ok: true, ...view }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
