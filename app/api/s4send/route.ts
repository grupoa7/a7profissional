// ⚠️ ROTA TEMPORÁRIA (teste de disparo real em produção) — REMOVER após o teste.
// Cria UM pedido real (com endereço-sentinela p/ purge), emite os convites e devolve o
// LINK CURTO de um deles, pra mandar 1 mensagem real e ver a capa branded chegar no
// WhatsApp. Guardada por chave (?k=). ?purge=1 apaga os pedidos de teste.
import { NextResponse } from "next/server";
import { montarPool } from "@/lib/match";
import { getTalentCards } from "@/lib/talent";
import { criarPedido, persistirPool } from "@/lib/pedidos";
import { emitirConvites, conviteView } from "@/lib/convites";
import { sql } from "@/lib/db-turnos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = "s4send-Td1sp4ro-2026";
const BAIRRO = "Jardim de Alah";
const ENDERECO_SENTINELA = "RUA-TESTE-DISPARO-PROD";

function proxData(alvoDow: number): string {
  const d = new Date();
  for (let i = 2; i <= 9; i++) {
    const t = new Date(d);
    t.setDate(d.getDate() + i);
    if (t.getDay() === alvoDow) {
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }
  }
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== KEY) return NextResponse.json({ erro: "nope" }, { status: 404 });
  if (!sql) return NextResponse.json({ erro: "Neon indisponível" }, { status: 500 });

  // purge dos pedidos de teste deste endpoint
  if (url.searchParams.get("purge") === "1") {
    try {
      const apagados = (await sql`delete from pedido where endereco = ${ENDERECO_SENTINELA} returning id`) as Array<{ id: number }>;
      return NextResponse.json({ ok: true, purge: true, pedidos_apagados: apagados.map((r) => Number(r.id)) });
    } catch (e: any) {
      return NextResponse.json({ ok: false, erro: String(e?.message || e) }, { status: 500 });
    }
  }

  try {
    const cards = await getTalentCards();
    const freq = new Map<string, number>();
    for (const c of cards) if (c.funcao) freq.set(c.funcao, (freq.get(c.funcao) ?? 0) + 1);
    const funcao = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!funcao) return NextResponse.json({ erro: "sem função classificada" }, { status: 500 });

    const base = { funcao, data: proxData(5), inicio: "08:00", valor: 200, vagas: 1 };
    const pool = await montarPool(base);
    const pedidoId = await criarPedido({ empresa: "Blue", ...base, bairro: BAIRRO, endereco: ENDERECO_SENTINELA });
    await persistirPool(pedidoId, pool.aptos.map((a) => a.card));
    const emitidos = await emitirConvites(pedidoId);
    if (!emitidos.length) return NextResponse.json({ erro: "pool vazio — nenhum apto" }, { status: 500 });

    const origin = `${url.protocol}//${url.host}`;
    const slug = emitidos[0].slug;
    const view = await conviteView(slug);
    return NextResponse.json({
      ok: true,
      pedidoId,
      pool: pool.total,
      link_curto: `${origin}/c/${slug}`,
      dados: view, // payload cego (pra montar a mensagem)
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, erro: String(e?.message || e) }, { status: 500 });
  }
}
