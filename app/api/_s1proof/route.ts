// ⚠️ ROTA TEMPORÁRIA — PROVA DO CHECKPOINT S1. REMOVER ANTES DO MERGE À PRODUÇÃO.
// Faz o ciclo de prova num lugar só, atrás de um token embutido (não vai pra prod):
//   ?acao=pickcard  → acha 1 card real NÃO-EXIBÍVEL (rating C) pra usar de cobaia
//   ?acao=ensure    → cria tabelas Neon + garante os 4 campos no banco + lista campos
//   ?acao=seed&card=ID  → insere 1 turno+avaliacao FAKE (tag __PROVA_S1__) ligada ao card
//   ?acao=verify&card=ID → lê os 4 campos + score_a7pro/rating do card (antes/depois)
//   ?acao=project   → roda a projeção (lê Neon, escreve banco)
//   ?acao=cleanup&card=ID → apaga as linhas fake no Neon + zera os 4 campos no card
// Tudo idempotente. A cobaia é rating C (invisível na vitrine) → prova não afeta o portal.
import { NextResponse } from "next/server";
import { sql, ensureTurnosSchema } from "@/lib/db-turnos";
import { BANCO_TID, pipefyQuery } from "@/lib/pipefy";
import {
  garantirCamposReputacao,
  listarCamposBanco,
  projetarEEscrever,
  lerCardParaProva,
  limparReputacaoDoCard,
} from "@/lib/reputacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_TOKEN = "s1-proof-7Qk2mZ9vX4tB"; // descartável; arquivo sai antes do merge
const TAG = "__PROVA_S1__";

function ok(req: Request): boolean {
  const u = new URL(req.url);
  return (req.headers.get("x-proof-token") || u.searchParams.get("t")) === PROOF_TOKEN;
}

// acha 1 registro real rating C (não-exibível) com CPF — cobaia segura.
async function pickCard() {
  const d = await pipefyQuery<any>(
    `query($id:ID!){ table(id:$id){ table_records(first:50){ edges{ node{
       id title record_fields{ field{id} value array_value } } } } } }`,
    { id: BANCO_TID },
  );
  const edges = d.table.table_records.edges as any[];
  for (const e of edges) {
    const f = (slug: string) => (e.node.record_fields.find((x: any) => x.field?.id === slug) || {}).value;
    if (String(f("rating")).trim() === "C" && f("cpf")) {
      return { id: e.node.id, title: e.node.title, cpf: f("cpf"), rating: f("rating") };
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (!ok(req)) return NextResponse.json({ erro: "nope" }, { status: 401 });
  const u = new URL(req.url);
  const acao = u.searchParams.get("acao");
  const card = u.searchParams.get("card") || "";
  try {
    if (acao === "pickcard") {
      return NextResponse.json({ cobaia: await pickCard() });
    }

    if (acao === "ensure") {
      await ensureTurnosSchema();
      const campos = await garantirCamposReputacao();
      const tabelas = sql
        ? await sql`select table_name from information_schema.tables
                    where table_schema='public'
                    and table_name in ('disponibilidade','pedido','convite','turno','avaliacao')
                    order by table_name`
        : [];
      const todosCampos = (await listarCamposBanco()).map((f) => f.id);
      return NextResponse.json({ tabelas, campos, campos_banco: todosCampos });
    }

    if (acao === "seed") {
      if (!sql || !card) return NextResponse.json({ erro: "sem sql/card" }, { status: 400 });
      await ensureTurnosSchema();
      const est = Number(u.searchParams.get("estrelas") ?? 2);
      const comp = u.searchParams.get("comp") ?? "Atrasou";
      const cham = u.searchParams.get("cham") ?? "Não";
      const data = u.searchParams.get("data") ?? new Date().toISOString().slice(0, 10);
      const t = (await sql`
        insert into turno (card, cpf, estabelecimento, funcao, data_do_turno, status)
        values (${card}, null, 'Blue', ${TAG}, ${data}, 'avaliado')
        returning id`) as Array<{ id: number }>;
      const turnoId = t[0].id;
      const a = (await sql`
        insert into avaliacao (turno_id, card, comparecimento, estrelas, chamaria, motivo, obs, avaliador)
        values (${turnoId}, ${card}, ${comp}, ${est}, ${cham}, '{}', ${TAG}, ${TAG})
        returning id`) as Array<{ id: number }>;
      return NextResponse.json({ turno_id: turnoId, avaliacao_id: a[0].id, card, estrelas: est, comp, cham, data });
    }

    if (acao === "verify") {
      if (!card) return NextResponse.json({ erro: "sem card" }, { status: 400 });
      return NextResponse.json(await lerCardParaProva(card));
    }

    if (acao === "project") {
      return NextResponse.json(await projetarEEscrever());
    }

    if (acao === "cleanup") {
      let neon = { avaliacao: 0, turno: 0 };
      if (sql) {
        const da = (await sql`delete from avaliacao where avaliador=${TAG} returning id`) as any[];
        const dt = (await sql`delete from turno where funcao=${TAG} returning id`) as any[];
        neon = { avaliacao: da.length, turno: dt.length };
      }
      if (card) await limparReputacaoDoCard(card);
      return NextResponse.json({ limpou_neon: neon, zerou_card: card || null });
    }

    return NextResponse.json({ erro: "acao desconhecida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: String(e).slice(0, 400) }, { status: 500 });
  }
}
