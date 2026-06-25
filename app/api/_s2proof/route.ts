// ⚠️ ROTA TEMPORÁRIA DE PROVA DA S2 — REMOVER ANTES DO MERGE EM web-next.
// Padrão da S1 (s1proof): roda o checkpoint E2E server-side (tem AUTH_SECRET/
// DATABASE_URL/PIPEFY_TOKEN do ambiente), provando ler→semear→editar→salvar→
// reler→persistir + isolamento entre cards, e devolve o LINK HUMANO pro Hugo
// abrir no navegador. Guardada por chave embutida (?k=) — some no merge.
import { NextResponse } from "next/server";
import { makeCalendarToken, verifyCalendarToken } from "@/lib/auth";
import { lerDisponibilidade, salvarDisponibilidade } from "@/lib/calendario";
import { getTalentCards } from "@/lib/talent";
import { sql } from "@/lib/db-turnos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROOF_KEY = "s2-7xQ9mProvaCalendario-2026";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== PROOF_KEY) {
    return NextResponse.json({ erro: "nope" }, { status: 404 });
  }
  const base =
    (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || url.origin);
  const out: any = { ok: true, base, etapas: {} };

  try {
    // 0) escolher 2 cards exibíveis reais (A = cobaia; B = pra isolamento)
    let cardA = url.searchParams.get("card") || "";
    let cardB = "";
    const cards = await getTalentCards();
    out.etapas["0_exibiveis_no_banco"] = cards.length;
    if (!cardA) cardA = cards[0]?.id || "";
    cardB = cards.find((c) => c.id !== cardA)?.id || "";
    if (!cardA) throw new Error("nenhum card exibível encontrado (PIPEFY_TOKEN no ambiente?)");
    out.cardA = cardA;
    out.cardB = cardB;

    // 1) SEMENTE: ler antes (deve pré-marcar do Pipefy se ainda não há linha no Neon)
    const seed = await lerDisponibilidade(cardA);
    out.etapas["1_semente"] = {
      fonte: seed.fonte,
      nome: seed.nome,
      dias: seed.dias,
      turnos: seed.turnos,
      valorSegSex: seed.valorSegSex,
      valorFds: seed.valorFds,
      atualizadoEm: seed.atualizadoEm,
      pipefy_ok: seed.nome != null || seed.dias.length > 0,
    };

    // 2) EDITAR: remove 1 dia e soma R$1 no Seg-Sex → salvar
    const diasEditados = seed.dias.length > 1 ? seed.dias.slice(0, -1) : seed.dias;
    const removido = seed.dias.length > 1 ? seed.dias[seed.dias.length - 1] : null;
    const novoValor = (seed.valorSegSex ?? 100) + 1;
    const salvo = await salvarDisponibilidade(cardA, {
      dias: diasEditados,
      turnos: seed.turnos,
      valorSegSex: novoValor,
      valorFds: seed.valorFds,
    });
    out.etapas["2_editar_salvar"] = {
      dia_removido: removido,
      valorSegSex_novo: salvo.valorSegSex,
      atualizadoEm: salvo.atualizadoEm,
    };

    // 3) RELER: a mudança persistiu no Neon?
    const reler = await lerDisponibilidade(cardA);
    const persistiu =
      reler.fonte === "neon" &&
      !reler.dias.includes(removido as string) &&
      reler.valorSegSex === novoValor;
    out.etapas["3_reler_persistiu"] = {
      fonte: reler.fonte,
      dias: reler.dias,
      valorSegSex: reler.valorSegSex,
      atualizadoEm: reler.atualizadoEm,
      PERSISTIU: persistiu,
    };

    // 4) ISOLAMENTO: token de A resolve A (não B); token de B resolve B.
    const tokA = makeCalendarToken(cardA);
    const tokB = cardB ? makeCalendarToken(cardB) : "";
    const vA = verifyCalendarToken(tokA);
    const vB = tokB ? verifyCalendarToken(tokB) : null;
    out.etapas["4_isolamento"] = {
      tokenA_resolve: vA?.card,
      bate_em_A: vA?.card === cardA,
      nao_vaza_para_B: vA?.card !== cardB,
      tokenB_resolve: vB?.card,
      bate_em_B: cardB ? vB?.card === cardB : "sem segundo card",
      token_adulterado_rejeitado: verifyCalendarToken(tokA + "x") === null,
    };

    // 5) RESTAURAR: apaga a linha do Neon → cobaia volta ao estado de semente puro
    // (pra você abrir o link humano e ver pré-marcado do zero, sem resíduo da prova).
    if (sql) await sql`delete from disponibilidade where card = ${cardA}`;
    const restaurada = await lerDisponibilidade(cardA);
    out.etapas["5_restaurar"] = {
      fonte_apos_restauro: restaurada.fonte, // deve voltar a "semente"
      linha_neon_removida: restaurada.fonte === "semente",
    };

    // LINK HUMANO — abra no navegador pra ver o calendário caloroso pré-marcado.
    out.LINK_HUMANO = `${base}/t/calendario/${tokA}`;
    out.LINK_HUMANO_cardB = cardB ? `${base}/t/calendario/${tokB}` : null;
    out.veredito =
      persistiu &&
      out.etapas["4_isolamento"].bate_em_A &&
      out.etapas["4_isolamento"].nao_vaza_para_B &&
      out.etapas["1_semente"].pipefy_ok
        ? "✅ S2 PROVADA"
        : "⚠️ revisar etapas";
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.erro = String(e).slice(0, 400);
    return NextResponse.json(out, { status: 500 });
  }
}
