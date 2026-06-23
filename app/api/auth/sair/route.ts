// Logout: limpa o cookie de sessão e volta pro /entrar.
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = NextResponse.redirect(new URL("/entrar?status=saiu", siteUrl), 303);
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
