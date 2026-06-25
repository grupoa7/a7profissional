// Geração do LINK MÁGICO do calendário (a "torneira" da S2).
// É o ponto de entrada que a futura SKILL-AGENTE (conversa com os candidatos no
// WhatsApp) vai chamar pra cunhar o link de cada diarista. Também é o que uso pra
// PROVAR o checkpoint S2 com um diarista real.
//
// GUARD: header `x-a7-secret` (ou ?secret=) tem que bater com REPUTACAO_SECRET
// (ou, no fallback do dogfood, AUTH_SECRET). Sem segredo → 401. Mesmo padrão da
// rota de reputação da S1. NUNCA exposto ao público — só o operador/skill cunha links.
import { NextResponse } from "next/server";
import { makeCalendarToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request, url: URL): boolean {
  const esperado = process.env.REPUTACAO_SECRET || process.env.AUTH_SECRET || "";
  if (!esperado) return false;
  const dado = req.headers.get("x-a7-secret") || url.searchParams.get("secret") || "";
  return dado.length > 0 && dado === esperado;
}

function baseUrl(url: URL): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  return url.origin; // fallback: origem do próprio deploy
}

function montar(card: string, dias: number | undefined, url: URL) {
  const token = dias ? makeCalendarToken(card, dias) : makeCalendarToken(card);
  return { card, token, link: `${baseUrl(url)}/t/calendario/${token}` };
}

// aceita 1 card (?card= / body.card) ou vários (body.cards: string[]) — a skill
// pode pedir um lote de links de uma vez.
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!autorizado(req, url)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* permite ?card= sem corpo */
  }
  const dias = Number.isFinite(body?.dias) ? Number(body.dias) : undefined;
  const um = body?.card || url.searchParams.get("card");
  const muitos: string[] = Array.isArray(body?.cards) ? body.cards : [];

  try {
    if (muitos.length) {
      const links = muitos.filter(Boolean).map((c) => montar(String(c), dias, url));
      return NextResponse.json({ ok: true, n: links.length, links });
    }
    if (um) {
      return NextResponse.json({ ok: true, ...montar(String(um), dias, url) });
    }
    return NextResponse.json({ erro: "informe card ou cards[]" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
