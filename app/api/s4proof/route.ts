// ⚠️ ROTA TEMPORÁRIA DE PROVA DA S4 — REMOVER ANTES DO MERGE EM web-next.
// Roda o checkpoint E2E server-side (tem DATABASE_URL/PIPEFY_TOKEN/AUTH_SECRET do
// ambiente): cria pedido com bairro+endereço(oculto) + pool → EMITE (pool→enviado,
// token único) → conviteView (CEGO: prova que NÃO vaza empresa/endereco/telefone) →
// registra interesse (enviado→interesse) → relê → idempotência (2 cliques = 1) →
// guards (token inválido/adulterado rejeitado; isolamento entre pedidos) → LIMPA.
// Guardada por chave (?k=).
import { NextResponse } from "next/server";
import { montarPool } from "@/lib/match";
import { getTalentCards } from "@/lib/talent";
import { criarPedido, persistirPool, lerPedido } from "@/lib/pedidos";
import { emitirConvites, conviteView, registrarInteresse } from "@/lib/convites";
import { sql } from "@/lib/db-turnos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = "s4-cVbInd1tCego-2026";
const BAIRRO_A = "Jardim de Alah";
const ENDERECO_OCULTO = "RUA-OCULTA-TESTE-999, Bloco Z"; // sentinela: NÃO pode vazar
const BAIRRO_B = "Rio Vermelho";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== KEY) return NextResponse.json({ erro: "nope" }, { status: 404 });
  const out: any = { ok: true, etapas: {} };
  const criados: number[] = [];

  // PURGE: apaga TODOS os pedidos de teste criados por esta rota (identificados pelos
  // endereços-sentinela), sem criar novos. Pra limpar o Neon antes do merge.
  if (url.searchParams.get("purge") === "1") {
    if (!sql) return NextResponse.json({ ok: false, erro: "Neon indisponível" }, { status: 500 });
    try {
      const apagados = (await sql`
        delete from pedido
        where endereco in ('RUA-OCULTA-TESTE-999, Bloco Z', 'OUTRO-ENDERECO')
        returning id
      `) as Array<{ id: number }>;
      const rest = (await sql`select count(*)::int as n from pedido where endereco in ('RUA-OCULTA-TESTE-999, Bloco Z','OUTRO-ENDERECO')`) as Array<{ n: number }>;
      return NextResponse.json({ ok: true, purge: true, pedidos_apagados: apagados.map((r) => Number(r.id)), restantes: rest[0]?.n });
    } catch (e: any) {
      return NextResponse.json({ ok: false, erro: String(e?.message || e) }, { status: 500 });
    }
  }

  try {
    if (!sql) throw new Error("Neon indisponível (DATABASE_URL no ambiente?)");

    // função mais frequente entre os exibíveis → pool não-trivial
    const cards = await getTalentCards();
    const freq = new Map<string, number>();
    for (const c of cards) if (c.funcao) freq.set(c.funcao, (freq.get(c.funcao) ?? 0) + 1);
    const funcao = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!funcao) throw new Error("nenhuma função classificada no banco (PIPEFY_TOKEN?)");
    out.funcao_escolhida = funcao;

    // ---------- pedido A: cria + pool + bairro/endereço ----------
    const dataSex = proxData(5);
    const baseA = { funcao, data: dataSex, inicio: "08:00", valor: 200, vagas: 2 };
    const poolA = await montarPool(baseA);
    const pedidoA = await criarPedido({ empresa: "Blue", ...baseA, bairro: BAIRRO_A, endereco: ENDERECO_OCULTO });
    criados.push(pedidoA);
    await persistirPool(pedidoA, poolA.aptos.map((a) => a.card));
    out.etapas["1_pedidoA"] = { pedidoId: pedidoA, pool: poolA.total, bairro: BAIRRO_A };

    // ---------- 2) EMITIR: pool→enviado, token único ----------
    const emitidos = await emitirConvites(pedidoA);
    const tokens = emitidos.map((e) => e.token);
    const distintos = new Set(tokens).size;
    const porStatus1 = (await sql`select status, count(*)::int as n from convite where pedido_id=${pedidoA} group by status`) as Array<{ status: string; n: number }>;
    // reemitir = idempotente (não cunha de novo)
    const emitidos2 = await emitirConvites(pedidoA);
    out.etapas["2_emitir"] = {
      emitidos: emitidos.length,
      tokens_distintos: distintos,
      todos_unicos: distintos === tokens.length,
      por_status: porStatus1,
      reemissao_idempotente: emitidos2.length === 0,
    };
    if (!emitidos.length) throw new Error("pool vazio — não dá pra provar o convite (ampliar valor/dia)");
    const tokenA = emitidos[0].token;
    // PEEK p/ teste manual/WhatsApp: link FRESCO (último token, intocado pelos passos 4-6,
    // segue 'enviado') no domínio DESTE deploy (preview) — o token HMAC vale em qualquer host.
    const origin = `${url.protocol}//${url.host}`;
    out.peek_link = `${origin}/t/convite/${emitidos[emitidos.length - 1].token}`;

    // ---------- 3) VIEW CEGA: prova que NÃO vaza empresa/endereco/telefone ----------
    const view: any = await conviteView(tokenA);
    const blob = JSON.stringify(view);
    const keys = view.ok ? Object.keys(view) : [];
    out.etapas["3_view_cego"] = {
      ok: view.ok,
      chaves: keys,
      tem_bairro: !!view.bairro,
      tem_funcao: !!view.funcao,
      tem_horario: !!view.horaInicio && !!view.horaFim,
      // GUARDS de vazamento:
      NAO_tem_chave_empresa: !keys.includes("empresa"),
      NAO_tem_chave_endereco: !keys.includes("endereco"),
      NAO_tem_chave_telefone: !keys.includes("telefone"),
      NAO_vaza_endereco_oculto: !blob.includes("RUA-OCULTA"),
      NAO_vaza_palavra_empresa_blue: !blob.includes("Blue"),
    };

    // ---------- 4) INTERESSE: enviado→interesse + idempotência ----------
    const r1 = await registrarInteresse(tokenA);
    const apos1 = (await sql`select status, to_char(respondido_em,'YYYY-MM-DD"T"HH24:MI:SS') as resp from convite where token=${tokenA} limit 1`) as Array<any>;
    const r2 = await registrarInteresse(tokenA); // 2º clique
    const apos2 = (await sql`select status, to_char(respondido_em,'YYYY-MM-DD"T"HH24:MI:SS') as resp from convite where token=${tokenA} limit 1`) as Array<any>;
    const interesseCount = (await sql`select count(*)::int as n from convite where pedido_id=${pedidoA} and status='interesse'`) as Array<{ n: number }>;
    out.etapas["4_interesse"] = {
      registrou: r1,
      status_apos: apos1[0]?.status,
      respondido_em: apos1[0]?.resp,
      segundo_clique: r2,
      idempotente_mesmo_respondido_em: apos1[0]?.resp === apos2[0]?.resp,
      total_com_interesse: interesseCount[0]?.n,
    };

    // ---------- 5) GUARDS de token: inválido / adulterado ----------
    const invalido = await conviteView("lixo.naoassinado");
    const adulterado = await conviteView(tokenA.slice(0, -2) + (tokenA.endsWith("a") ? "bb" : "aa"));
    out.etapas["5_guards_token"] = {
      invalido_rejeitado: invalido.ok === false,
      adulterado_rejeitado: adulterado.ok === false,
    };

    // ---------- 6) ISOLAMENTO entre pedidos: token de A mostra bairro de A ----------
    const baseB = { funcao, data: proxData(6), inicio: "08:00", valor: 200, vagas: 1 };
    const poolB = await montarPool(baseB);
    const pedidoB = await criarPedido({ empresa: "Blue", ...baseB, bairro: BAIRRO_B, endereco: "OUTRO-ENDERECO" });
    criados.push(pedidoB);
    await persistirPool(pedidoB, poolB.aptos.map((a) => a.card));
    const emitB = await emitirConvites(pedidoB);
    let isol: any = { pedidoB, emitidosB: emitB.length };
    if (emitB.length) {
      const viewB: any = await conviteView(emitB[0].token);
      const viewAagain: any = await conviteView(tokenA);
      isol = {
        ...isol,
        tokenA_bairro: viewAagain.bairro,
        tokenB_bairro: viewB.bairro,
        isolado: viewAagain.bairro === BAIRRO_A && viewB.bairro === BAIRRO_B && viewAagain.bairro !== viewB.bairro,
      };
    } else {
      isol.nota = "pedidoB sem pool (ok) — isolamento parcial provado só com A";
    }
    out.etapas["6_isolamento"] = isol;

    // resumo dos guards (tudo true = passou)
    out.PASSOU = {
      tokens_unicos: out.etapas["2_emitir"].todos_unicos,
      reemissao_idempotente: out.etapas["2_emitir"].reemissao_idempotente,
      view_cego_sem_empresa: out.etapas["3_view_cego"].NAO_tem_chave_empresa,
      view_cego_sem_endereco: out.etapas["3_view_cego"].NAO_tem_chave_endereco && out.etapas["3_view_cego"].NAO_vaza_endereco_oculto,
      view_cego_sem_telefone: out.etapas["3_view_cego"].NAO_tem_chave_telefone,
      interesse_gravado: out.etapas["4_interesse"].status_apos === "interesse",
      interesse_idempotente: out.etapas["4_interesse"].idempotente_mesmo_respondido_em && out.etapas["4_interesse"].total_com_interesse === 1,
      token_invalido_rejeitado: out.etapas["5_guards_token"].invalido_rejeitado,
      token_adulterado_rejeitado: out.etapas["5_guards_token"].adulterado_rejeitado,
      isolamento: out.etapas["6_isolamento"].isolado ?? "parcial",
    };
  } catch (e: any) {
    out.ok = false;
    out.erro = String(e?.message || e);
  } finally {
    // LIMPEZA (?keep=1 mantém pra ver em /portal/pedidos)
    if (url.searchParams.get("keep") !== "1" && sql) {
      for (const id of criados) {
        try {
          await sql`delete from pedido where id = ${id}`;
        } catch {
          /* best effort */
        }
      }
      out.limpeza = { pedidos_apagados: criados };
    } else if (criados.length) {
      out.limpeza = `mantido (keep=1) — pedidos ${criados.join(", ")} visíveis em /portal/pedidos`;
    }
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
