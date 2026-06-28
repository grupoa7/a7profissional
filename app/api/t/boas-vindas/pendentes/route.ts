// TORNEIRA de BOAS-VINDAS — lista de exibíveis ainda não saudados que a skill "Lia"
// consome pra dar as boas-vindas no WhatsApp. Mesmo padrão das torneiras de
// calendário/convite: guard por segredo (x-a7-secret / ?secret=) batendo
// REPUTACAO_SECRET || AUTH_SECRET. Devolve telefone (PII) — exposto SÓ aqui, sob
// segredo. NUNCA público. Só leitura (idempotente, não marca nada).
import { NextResponse } from "next/server";
import { listarPendentes } from "@/lib/boas-vindas";

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
  return url.origin;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (!autorizado(req, url)) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* permite chamada sem corpo */
  }
  const limite = Number(body?.limite ?? url.searchParams.get("limite")) || undefined;
  try {
    const r = await listarPendentes({ limite, baseUrl: baseUrl(url) });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
