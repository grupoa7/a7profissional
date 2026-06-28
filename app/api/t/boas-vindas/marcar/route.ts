// TORNEIRA de BOAS-VINDAS — marca um card como saudado (idempotência das boas-vindas).
// A skill "Lia" chama após enviar as mensagens de boas-vindas com sucesso. Mesmo guard
// das demais torneiras (x-a7-secret / ?secret= = REPUTACAO_SECRET || AUTH_SECRET).
// Aceita status "enviada" (default) ou "optout" (suprimir alguém da fila).
import { NextResponse } from "next/server";
import { marcarSaudado } from "@/lib/boas-vindas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function autorizado(req: Request, url: URL): boolean {
  const esperado = process.env.REPUTACAO_SECRET || process.env.AUTH_SECRET || "";
  if (!esperado) return false;
  const dado = req.headers.get("x-a7-secret") || url.searchParams.get("secret") || "";
  return dado.length > 0 && dado === esperado;
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
    /* permite ?card= sem corpo */
  }
  const card = String(body?.card || url.searchParams.get("card") || "").trim();
  if (!card) {
    return NextResponse.json({ erro: "informe card" }, { status: 400 });
  }
  const status = body?.status === "optout" ? "optout" : "enviada";
  try {
    const r = await marcarSaudado(card, status);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
