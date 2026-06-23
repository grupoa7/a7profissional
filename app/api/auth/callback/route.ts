// Valida o link mágico e, se OK, abre a sessão (cookie httpOnly JWT de 30 dias) e
// manda pro /portal. Token inválido/expirado → volta pro /entrar com aviso.
import { NextResponse } from "next/server";
import { verifyToken, makeToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const magic = verifyToken(token, "magic");
  if (!magic) {
    return NextResponse.redirect(new URL("/entrar?status=expirado", siteUrl), 303);
  }
  const res = NextResponse.redirect(new URL("/portal", siteUrl), 303);
  res.cookies.set(SESSION_COOKIE, makeToken(magic.email, "session"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
