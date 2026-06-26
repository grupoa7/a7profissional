// ROTA DE PROVA DA S6 — TEMPORÁRIA. Semeia turnos de teste e expõe leitura de prova.
// Guardada por ?k=<AUTH_SECRET|REPUTACAO_SECRET>. SEM underscore (underscore não roteia).
// REMOVER ANTES DO MERGE (deletar o blob no branch). Não toca em score_a7pro/rating.
//
//   GET ?k=..&acao=pick                          → lista cards exibíveis (escolher cobaia)
//   GET ?k=..&acao=seed&card=ID&data=YYYY-MM-DD&funcao=F → cria 1 turno 'agendado' (Blue, passado)
//   GET ?k=..&acao=prova&card=ID                 → lê os 4 campos de reputação + intocáveis
//   GET ?k=..&acao=cleanup&turnoIds=1,2&card=ID  → apaga avaliacao+turno de teste + zera reputação do card
import { NextResponse } from "next/server";
import { sql, ensureTurnosSchema } from "@/lib/db-turnos";
import { getTalentCards } from "@/lib/talent";
import { lerCardParaProva, limparReputacaoDoCard } from "@/lib/reputacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPRESA = "Blue";

function ok(k: string | null): boolean {
  const secret = process.env.AUTH_SECRET || process.env.REPUTACAO_SECRET || "";
  return !!secret && k === secret;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  if (!ok(u.searchParams.get("k"))) {
    return NextResponse.json({ ok: false, erro: "forbidden" }, { status: 403 });
  }
  if (!sql) return NextResponse.json({ ok: false, erro: "sem banco" }, { status: 500 });
  await ensureTurnosSchema();
  const acao = u.searchParams.get("acao") || "";

  // ---- PICK: cards exibíveis pra escolher a cobaia ----
  if (acao === "pick") {
    const cards = await getTalentCards();
    return NextResponse.json({
      ok: true,
      total: cards.length,
      cards: cards.slice(0, 12).map((c) => ({
        id: c.id, nome: c.nomeParcial, selo: c.selo, funcao: c.funcao,
        reputacaoTurnos: c.reputacaoTurnos, nTurnos: c.nTurnos, reputacaoExibivel: c.reputacaoExibivel,
      })),
    });
  }

  // ---- SEED: cria 1 turno 'agendado' no passado (avaliável). Retorna turnoId ----
  if (acao === "seed") {
    const card = u.searchParams.get("card") || "";
    const data = u.searchParams.get("data") || ""; // YYYY-MM-DD (passado)
    const funcao = u.searchParams.get("funcao") || "Garçom";
    if (!card || !data) return NextResponse.json({ ok: false, erro: "card e data obrigatórios" }, { status: 400 });
    const ins = (await sql`
      insert into turno (pedido_id, convite_id, card, cpf, estabelecimento, funcao, data_do_turno, status, contato_liberado)
      values (null, null, ${card}, null, ${EMPRESA}, ${funcao}, ${data}::date, 'agendado', true)
      returning id
    `) as Array<{ id: number }>;
    return NextResponse.json({ ok: true, turnoId: Number(ins[0].id), card, data, funcao });
  }

  // ---- PROVA: lê os 4 campos de reputação + os intocáveis de um card ----
  if (acao === "prova") {
    const card = u.searchParams.get("card") || "";
    if (!card) return NextResponse.json({ ok: false, erro: "card obrigatório" }, { status: 400 });
    const prova = await lerCardParaProva(card);
    return NextResponse.json({ ok: true, prova });
  }

  // ---- CLEANUP: apaga avaliacao+turno de teste e zera os 4 campos do card ----
  if (acao === "cleanup") {
    const turnoIds = (u.searchParams.get("turnoIds") || "")
      .split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
    const card = u.searchParams.get("card") || "";
    const apagados: Record<string, number> = {};
    if (turnoIds.length) {
      const delAv = (await sql`delete from avaliacao where turno_id = any(${turnoIds}) returning id`) as Array<{ id: number }>;
      const delT = (await sql`delete from turno where id = any(${turnoIds}) returning id`) as Array<{ id: number }>;
      apagados.avaliacoes = delAv.length;
      apagados.turnos = delT.length;
    }
    if (card) await limparReputacaoDoCard(card);
    return NextResponse.json({ ok: true, apagados, cardZerado: card || null });
  }

  return NextResponse.json({ ok: false, erro: "acao desconhecida (pick|seed|prova|cleanup)" }, { status: 400 });
}
