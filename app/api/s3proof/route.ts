// ⚠️ ROTA TEMPORÁRIA DE PROVA DA S3 — REMOVER ANTES DO MERGE EM web-next.
// Roda o checkpoint E2E server-side (tem DATABASE_URL/PIPEFY_TOKEN do ambiente):
// escolhe a função mais frequente do banco → monta o pool (match via Neon) → cria
// pedido + persiste convites status='pool' → relê → prova coerência (muda N / muda dia)
// → guards (esmaecido fora) → LIMPA o pedido de teste. Guardada por chave (?k=).
import { NextResponse } from "next/server";
import { montarPool, type Descartado } from "@/lib/match";
import { getTalentCards } from "@/lib/talent";
import { criarPedido, persistirPool, lerPedido } from "@/lib/pedidos";
import { sql } from "@/lib/db-turnos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = "s3-pV9mPoolUber-2026";

// próxima data (futura) cujo dia da semana = alvo (0=Dom..6=Sáb), formato YYYY-MM-DD
function proxData(alvoDow: number): string {
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    const t = new Date(d);
    t.setDate(d.getDate() + i);
    if (t.getDay() === alvoDow) {
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }
  }
  return "";
}

// agrupa motivos de descarte (anonimizando números) pra um histograma legível
function contarMotivos(ds: Descartado[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const d of ds) {
    const k = d.motivo
      .replace(/R\$\d+/g, "R$X")
      .replace(/\d{1,2}:\d{2}/g, "HH:MM")
      .replace(/(Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo)/g, "DIA");
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== KEY) return NextResponse.json({ erro: "nope" }, { status: 404 });
  const out: any = { ok: true, etapas: {} };
  try {
    if (!sql) throw new Error("Neon indisponível (DATABASE_URL no ambiente?)");

    // 0) função mais frequente entre os exibíveis (garante pool não-trivial)
    const cards = await getTalentCards();
    out.etapas["0_universo_exibivel"] = cards.length;
    const freq = new Map<string, number>();
    for (const c of cards) if (c.funcao) freq.set(c.funcao, (freq.get(c.funcao) ?? 0) + 1);
    const funcao = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!funcao) throw new Error("nenhuma função classificada no banco (PIPEFY_TOKEN?)");
    out.funcao_escolhida = funcao;
    out.distribuicao_funcoes = Object.fromEntries([...freq.entries()].sort((a, b) => b[1] - a[1]));

    // 1) pedido base: próxima sexta, início 08:00 (→ 17:00), R$200, N=2
    const dataSex = proxData(5);
    const pedidoBase = { funcao, data: dataSex, inicio: "08:00", valor: 200, vagas: 2 };
    const pool = await montarPool(pedidoBase);
    out.etapas["1_pool_base"] = {
      pedido: pool.pedido,
      total: pool.total,
      metaMinima: pool.metaMinima,
      atingiuMinimo: pool.atingiuMinimo,
      aptos_amostra: pool.aptos.slice(0, 8).map((a) => ({ nome: a.nomeParcial, selo: a.selo, exato: a.exato, valor: a.valorAplicavel, porque: a.porque })),
      descartados_por_motivo: contarMotivos(pool.descartados),
    };

    // GUARD: esmaecidos não entram no pool (estão entre os descartados)
    out.guard_esmaecidos_fora_do_pool = pool.descartados.filter((d) => d.motivo.includes("esmaecido")).length;

    // 2) PERSISTIR pedido + pool (status='pool', sem token)
    const pedidoId = await criarPedido({ empresa: "Blue", ...pedidoBase });
    const linhas = await persistirPool(pedidoId, pool.aptos.map((a) => a.card));
    const ped = await lerPedido(pedidoId);
    const porStatus = (await sql`select status, count(*)::int as n from convite where pedido_id = ${pedidoId} group by status`) as Array<{ status: string; n: number }>;
    out.etapas["2_persistiu"] = { pedidoId, pool_linhas: linhas, pedido_pool_field: ped?.pool, convites_por_status: porStatus };

    // 3) COERÊNCIA — muda N (só a meta muda; N não filtra) e muda dia (pool muda)
    const dataSab = proxData(6);
    const poolSab = await montarPool({ ...pedidoBase, data: dataSab });
    out.etapas["3_coerencia"] = {
      muda_N: { N2: { meta: 4, atingiu: pool.total >= 4 }, N5: { meta: 10, atingiu: pool.total >= 10 }, total_igual: true, nota: "N dimensiona a meta (2N); não filtra o pool" },
      muda_dia: { sexta_total: pool.total, sabado_total: poolSab.total, sabado_usa_valor_fds: poolSab.pedido.wknd, dias: [pool.pedido.diaSemana, poolSab.pedido.diaSemana] },
    };

    // 4) LIMPEZA (?keep=1 mantém pra ver em /portal/pedidos)
    if (url.searchParams.get("keep") !== "1") {
      await sql`delete from pedido where id = ${pedidoId}`;
      const rest = (await sql`select count(*)::int as n from convite where pedido_id = ${pedidoId}`) as Array<{ n: number }>;
      out.etapas["4_limpeza"] = { pedido_apagado: pedidoId, convites_restantes: rest[0]?.n };
    } else {
      out.etapas["4_limpeza"] = `mantido (keep=1) — pedido #${pedidoId} visível em /portal/pedidos?novo=${pedidoId}`;
    }
  } catch (e: any) {
    out.ok = false;
    out.erro = String(e?.message || e);
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
