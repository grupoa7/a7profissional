// ATALHO DE LOGIN DOGFOOD (S5 · P0) — abre a sessão da empresa SEM depender do e-mail.
// Motivo (PLANO-DE-VOO §2): o magic-link via Resend só entrega ao dono da conta até o
// domínio ser verificado, então o portal de produção fica inacessível pro piloto Blue.
// Esta rota gera a sessão DIRETO, mas só para e-mails da allowlist de dogfood (hugo@/rh@)
// E só se o segredo de operador bater. Sem o segredo no ambiente, a rota é 404 (desligada
// por padrão — não vira porta dos fundos). O domínio no Resend segue como fast-follow
// (pré-requisito de EMPRESA EXTERNA; o dogfood interno não depende dele).
//
// Uso: /api/auth/dogfood?k=<DOGFOOD_LOGIN_SECRET>[&email=rh@grupoa7.com.br]
//   - sem email → entra como o 1º da allowlist (hugo@grupoa7.com.br)
//   - empresa operada = "Blue" (Cliente 00), resolvida em app/portal/actions.ts.
import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  makeToken,
  isDogfood,
  dogfoodEmails,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const segredo = process.env.DOGFOOD_LOGIN_SECRET || "";
  // Desligada por padrão: sem segredo configurado no ambiente, a rota nem existe.
  if (!segredo) return NextResponse.json({ erro: "indisponível" }, { status: 404 });

  const k = url.searchParams.get("k") || "";
  // comparação em tempo constante (anti-timing)
  const a = Buffer.from(k);
  const b = Buffer.from(segredo);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ erro: "nope" }, { status: 404 });

  // e-mail alvo: o informado (precisa estar na allowlist) ou o 1º dogfood por default.
  const pedido = (url.searchParams.get("email") || "").trim().toLowerCase();
  const email = pedido || dogfoodEmails()[0] || "";
  if (!email || !isDogfood(email)) {
    return NextResponse.json({ erro: "e-mail fora da allowlist de dogfood" }, { status: 403 });
  }

  const res = NextResponse.redirect(new URL("/portal", siteUrl), 303);
  res.cookies.set(SESSION_COOKIE, makeToken(email, "session"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
