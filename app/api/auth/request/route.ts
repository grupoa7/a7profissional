// Recebe o e-mail do formulário /entrar e dispara o link mágico — MAS só envia se o
// e-mail puder acessar (allowlist OU assinante ativo), para o endpoint não virar relay.
// A resposta é SEMPRE genérica ("enviado"), para não vazar quem tem ou não acesso.
import { NextResponse } from "next/server";
import { makeToken, isDogfood, sendMagicLink } from "@/lib/auth";
import { isActiveSubscriber } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const email = ((form?.get("email") as string | null) ?? "").trim().toLowerCase();
  const valido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!valido) {
    return NextResponse.redirect(new URL("/entrar?status=invalido", siteUrl), 303);
  }

  let pode = isDogfood(email);
  if (!pode) pode = await isActiveSubscriber(email);
  if (pode) {
    try {
      const token = makeToken(email, "magic");
      const link = `${siteUrl}/api/auth/callback?token=${encodeURIComponent(token)}`;
      await sendMagicLink(email, link);
    } catch {
      /* falha silenciosa: resposta genérica não revela estado */
    }
  }
  return NextResponse.redirect(new URL("/entrar?status=enviado", siteUrl), 303);
}
