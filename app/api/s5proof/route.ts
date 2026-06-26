// ⚠️ ROTA TEMPORÁRIA DE PROVA DA S5 — REMOVER ANTES DO MERGE EM web-next.
// Roda o checkpoint E2E do fecho da convocação (tem DATABASE_URL/PIPEFY_TOKEN/AUTH_SECRET):
//   pedido+pool → emitir → interesse(≥2) → POOL AO VIVO (contadores) → SELEÇÃO+HOLD →
//   cap N+20% (excedente rejeitado) → REVELAÇÃO ASSIMÉTRICA (escolhido vê empresa+endereço;
//   não-escolhido segue CEGO) → CONFIRMAR (nasce turno, idempotente) → PLANO B (recusa→escolhe
//   próximo) → guards → LIMPA. Guardada por chave (?k=).
import { NextResponse } from "next/server";
import { montarPool } from "@/lib/match";
import { getTalentCards } from "@/lib/talent";
import { criarPedido, persistirPool } from "@/lib/pedidos";
import { emitirConvites, conviteView, registrarInteresse } from "@/lib/convites";
import { lerPainel, selecionar, confirmarPresenca, recusar, limiteSelecao } from "@/lib/selecao";
import { sql } from "@/lib/db-turnos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = "s5-h0ldR3v3al-2026";
const BAIRRO = "Pituba";
const EMPRESA_SENT = "Blue"; // o que deve REVELAR ao escolhido
const ENDERECO_SENT = "RUA-S5-OCULTA-777, Sala Z"; // sentinela: só pode vazar ao escolhido

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

  // PURGE: apaga os pedidos de teste desta rota (pelo endereço-sentinela).
  if (url.searchParams.get("purge") === "1") {
    if (!sql) return NextResponse.json({ ok: false, erro: "Neon indisponível" }, { status: 500 });
    try {
      const apagados = (await sql`delete from pedido where endereco = ${ENDERECO_SENT} returning id`) as Array<{ id: number }>;
      const rest = (await sql`select count(*)::int as n from pedido where endereco = ${ENDERECO_SENT}`) as Array<{ n: number }>;
      return NextResponse.json({ ok: true, purge: true, pedidos_apagados: apagados.map((r) => Number(r.id)), restantes: rest[0]?.n });
    } catch (e: any) {
      return NextResponse.json({ ok: false, erro: String(e?.message || e) }, { status: 500 });
    }
  }

  try {
    if (!sql) throw new Error("Neon indisponível (DATABASE_URL no ambiente?)");

    // função mais frequente → pool não-trivial
    const cards = await getTalentCards();
    const freq = new Map<string, number>();
    for (const c of cards) if (c.funcao) freq.set(c.funcao, (freq.get(c.funcao) ?? 0) + 1);
    const funcao = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!funcao) throw new Error("nenhuma função classificada (PIPEFY_TOKEN?)");
    out.funcao_escolhida = funcao;

    // ---------- 1) pedido N=2 (cap=ceil(2*1.2)=3) + pool ----------
    const base = { funcao, data: proxData(5), inicio: "08:00", valor: 200, vagas: 2 };
    const pool = await montarPool(base);
    const pedido = await criarPedido({ empresa: EMPRESA_SENT, ...base, bairro: BAIRRO, endereco: ENDERECO_SENT });
    criados.push(pedido);
    await persistirPool(pedido, pool.aptos.map((a) => a.card));
    const emit = await emitirConvites(pedido);
    out.etapas["1_setup"] = { pedidoId: pedido, pool: pool.total, vagas: 2, cap: limiteSelecao(2), emitidos: emit.length };
    if (emit.length < 2) throw new Error("pool < 2 — amplie valor/dia pra provar seleção (precisa de ≥2 aptos)");

    // ---------- 2) interesse de até 4 convites ----------
    const usar = emit.slice(0, Math.min(4, emit.length));
    for (const e of usar) await registrarInteresse(e.token);
    const painel0 = await lerPainel(pedido);
    out.etapas["2_pool_vivo"] = {
      interesse: painel0?.interesse,
      enviado: painel0?.enviado,
      podeSelecionar: painel0?.podeSelecionar,
      contador: `${painel0?.confirmado} de ${painel0?.vagas} · ${painel0?.interesse} aguardando · +${painel0?.enviado} podem vir`,
    };

    // ---------- 3) SELEÇÃO + HOLD ----------
    const escolhido = usar[0];
    const sel1 = await selecionar(pedido, escolhido.conviteId);
    // idempotência: selecionar de novo = ok, sem duplicar
    const sel1b = await selecionar(pedido, escolhido.conviteId);
    out.etapas["3_selecao"] = {
      sel1,
      idempotente: sel1b.ok && (sel1b as any).selecionado === (sel1 as any).selecionado,
    };

    // ---------- 4) CAP N+20%: selecionar além de 3 deve ser rejeitado ----------
    // já temos 1 selecionado; seleciona +2 (total 3 = cap) deve passar, o 4º deve falhar.
    let capOk = true;
    let capDetalhe: any = {};
    if (usar.length >= 4) {
      const s2 = await selecionar(pedido, usar[1].conviteId); // 2/3
      const s3 = await selecionar(pedido, usar[2].conviteId); // 3/3 (cap)
      const s4 = await selecionar(pedido, usar[3].conviteId); // 4 → deve FALHAR
      capOk = s2.ok && s3.ok && !s4.ok;
      capDetalhe = { s2: s2.ok, s3: s3.ok, s4_rejeitado: !s4.ok, motivo_s4: (s4 as any).erro };
      // desfaz os extras pra continuar o teste limpo: recusa s2/s3 (libera slots)
      await recusar(usar[1].token);
      await recusar(usar[2].token);
    } else {
      capDetalhe = { nota: "pool < 4 — cap provado parcialmente (precisa de 4 interessados)" };
    }
    out.etapas["4_cap"] = { cap: limiteSelecao(2), respeitado: capOk, ...capDetalhe };

    // ---------- 5) REVELAÇÃO ASSIMÉTRICA ----------
    const viewEscolhido: any = await conviteView(escolhido.token); // selecionado → REVELADO
    // um convite NÃO selecionado do mesmo pedido (ainda 'enviado' ou 'interesse')
    const naoSel = emit.find((e) => e.conviteId !== escolhido.conviteId && !usar.slice(1).some((u) => u.conviteId === e.conviteId)) || usar[usar.length - 1];
    const viewCego: any = await conviteView(naoSel.token);
    const blobCego = JSON.stringify(viewCego);
    out.etapas["5_revelacao"] = {
      escolhido_revelado: viewEscolhido.revelado === true,
      escolhido_tem_empresa: !!viewEscolhido.empresa,
      escolhido_tem_endereco: !!viewEscolhido.endereco,
      escolhido_empresa: viewEscolhido.empresa,
      naoSel_status: viewCego.status,
      naoSel_revelado_false: viewCego.revelado === false,
      naoSel_SEM_empresa: !("empresa" in viewCego),
      naoSel_SEM_endereco: !("endereco" in viewCego),
      naoSel_NAO_vaza_sentinela: !blobCego.includes("RUA-S5-OCULTA"),
    };

    // ---------- 6) CONFIRMAR PRESENÇA: nasce turno (idempotente) ----------
    const conf1 = await confirmarPresenca(escolhido.token);
    const conf2 = await confirmarPresenca(escolhido.token); // 2º toque
    const turnos = (await sql`select count(*)::int as n from turno where convite_id = ${escolhido.conviteId}`) as Array<{ n: number }>;
    const turnoRow = (await sql`select status, contato_liberado, estabelecimento, funcao from turno where convite_id = ${escolhido.conviteId} limit 1`) as Array<any>;
    out.etapas["6_confirmar"] = {
      conf1,
      conf2_idempotente: conf2.ok && (conf2 as any).turnoId === (conf1 as any).turnoId,
      turnos_para_o_convite: turnos[0]?.n,
      um_turno_so: turnos[0]?.n === 1,
      turno_agendado: turnoRow[0]?.status === "agendado",
      contato_liberado: turnoRow[0]?.contato_liberado === true,
    };

    // ---------- 7) PLANO B: escolhe outro, recusa, escolhe o próximo ----------
    // após confirmar 1, ainda falta 1 vaga (N=2). seleciona um interessado, ele recusa,
    // a empresa seleciona o próximo (manual).
    const painelB = await lerPainel(pedido);
    const aindaInteresse = painelB?.interessados.filter((i) => i.status === "interesse") ?? [];
    let planoB: any = { interessados_livres: aindaInteresse.length };
    if (aindaInteresse.length >= 1) {
      const alvo = aindaInteresse[0];
      const sA = await selecionar(pedido, alvo.conviteId);
      // recusa pelo trabalhador (precisa do token/slug — pega do emit)
      const tokAlvo = emit.find((e) => e.conviteId === alvo.conviteId)?.token ?? null;
      const rec = await recusar(tokAlvo);
      const painelC = await lerPainel(pedido);
      const recusados = painelC?.interessados.filter((i) => i.status === "recusado").length ?? 0;
      const livresDepois = painelC?.interessados.filter((i) => i.status === "interesse") ?? [];
      let promoveu = false;
      if (livresDepois.length >= 1) {
        const s = await selecionar(pedido, livresDepois[0].conviteId);
        promoveu = s.ok;
      }
      planoB = {
        ...planoB,
        selecionou: sA.ok,
        recusou: rec.ok,
        aparece_recusado_na_lista: recusados >= 1,
        escolheu_proximo: promoveu,
      };
    } else {
      planoB.nota = "sem interessado livre pra provar plano B (pool pequeno)";
    }
    out.etapas["7_plano_b"] = planoB;

    // ---------- 8) GUARD: seleção exige pedido aberto / convite do pedido ----------
    const selForaPedido = await selecionar(pedido, 99999999); // convite inexistente
    out.etapas["8_guards"] = {
      selecionar_convite_invalido_rejeitado: !selForaPedido.ok,
    };

    // resumo
    out.PASSOU = {
      pool_vivo_conta: (painel0?.interesse ?? 0) >= 2,
      selecao_hold: (sel1 as any).status === "selecionado",
      selecao_idempotente: out.etapas["3_selecao"].idempotente,
      cap_n_mais_20: capOk,
      revelacao_escolhido: out.etapas["5_revelacao"].escolhido_tem_empresa && out.etapas["5_revelacao"].escolhido_tem_endereco,
      naoSel_segue_cego: out.etapas["5_revelacao"].naoSel_SEM_empresa && out.etapas["5_revelacao"].naoSel_SEM_endereco && out.etapas["5_revelacao"].naoSel_NAO_vaza_sentinela,
      confirmar_nasce_turno: out.etapas["6_confirmar"].turno_agendado && out.etapas["6_confirmar"].contato_liberado,
      confirmar_idempotente: out.etapas["6_confirmar"].um_turno_so,
      plano_b_manual: planoB.aparece_recusado_na_lista ?? "parcial",
      guard_selecao: out.etapas["8_guards"].selecionar_convite_invalido_rejeitado,
    };
  } catch (e: any) {
    out.ok = false;
    out.erro = String(e?.message || e);
  } finally {
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
