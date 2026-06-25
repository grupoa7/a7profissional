// ⚠️ ROTA TEMPORÁRIA DE PROVA DA S2 — REMOVER ANTES DO MERGE EM web-next.
// Roda o checkpoint E2E server-side (tem AUTH_SECRET/DATABASE_URL/PIPEFY_TOKEN do
// ambiente): ler→semear→editar→salvar→reler→persistir + isolamento entre cards,
// já no MODELO NOVO (dias + janela de horário + feriado). Devolve o LINK HUMANO.
// Guardada por chave embutida (?k=) — some no merge.
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
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || url.origin;
  const out: any = { ok: true, base, etapas: {} };

  try {
    let cardA = url.searchParams.get("card") || "";
    const cards = await getTalentCards();
    out.etapas["0_exibiveis_no_banco"] = cards.length;
    if (!cardA) cardA = cards[0]?.id || "";
    const cardB = cards.find((c: { id: string }) => c.id !== cardA)?.id || "";
    if (!cardA) throw new Error("nenhum card exibível (PIPEFY_TOKEN no ambiente?)");
    out.cardA = cardA;
    out.cardB = cardB;

    // 1) SEMENTE (pré-marca do Pipefy: dias sem feriado + feriado próprio + janela do turno antigo)
    const seed = await lerDisponibilidade(cardA);
    out.etapas["1_semente"] = {
      fonte: seed.fonte,
      nome: seed.nome,
      dias: seed.dias,
      feriados: seed.feriados,
      horaInicio: seed.horaInicio,
      horaFim: seed.horaFim,
      valorSegSex: seed.valorSegSex,
      pipefy_ok: seed.nome != null || seed.dias.length > 0,
    };

    // 2) EDITAR: tira 1 dia, inverte feriados, fixa janela 07:00–19:00, +R$1 → salvar
    const diasEditados = seed.dias.length > 1 ? seed.dias.slice(0, -1) : seed.dias;
    const removido = seed.dias.length > 1 ? seed.dias[seed.dias.length - 1] : null;
    const novoFeriados = !seed.feriados;
    const novoValor = (seed.valorSegSex ?? 100) + 1;
    const salvo = await salvarDisponibilidade(cardA, {
      dias: diasEditados,
      horaInicio: "07:00",
      horaFim: "19:00",
      feriados: novoFeriados,
      valorSegSex: novoValor,
      valorFds: seed.valorFds,
    });
    out.etapas["2_editar_salvar"] = {
      dia_removido: removido,
      feriados_novo: novoFeriados,
      janela: `${salvo.horaInicio}–${salvo.horaFim}`,
      atualizadoEm: salvo.atualizadoEm,
    };

    // 3) RELER: persistiu no Neon?
    const reler = await lerDisponibilidade(cardA);
    const persistiu =
      reler.fonte === "neon" &&
      !reler.dias.includes(removido as string) &&
      reler.feriados === novoFeriados &&
      reler.horaInicio === "07:00" &&
      reler.horaFim === "19:00" &&
      reler.valorSegSex === novoValor;
    out.etapas["3_reler_persistiu"] = {
      fonte: reler.fonte,
      dias: reler.dias,
      feriados: reler.feriados,
      janela: `${reler.horaInicio}–${reler.horaFim}`,
      valorSegSex: reler.valorSegSex,
      PERSISTIU: persistiu,
    };

    // 4) ISOLAMENTO
    const tokA = makeCalendarToken(cardA);
    const tokB = cardB ? makeCalendarToken(cardB) : "";
    const vA = verifyCalendarToken(tokA);
    const vB = tokB ? verifyCalendarToken(tokB) : null;
    out.etapas["4_isolamento"] = {
      bate_em_A: vA?.card === cardA,
      nao_vaza_para_B: vA?.card !== cardB,
      bate_em_B: cardB ? vB?.card === cardB : "sem segundo card",
      token_adulterado_rejeitado: verifyCalendarToken(tokA + "x") === null,
    };

    // 5) RESTAURAR (cobaia volta à semente pura)
    if (sql) await sql`delete from disponibilidade where card = ${cardA}`;
    const restaurada = await lerDisponibilidade(cardA);
    out.etapas["5_restaurar"] = { linha_neon_removida: restaurada.fonte === "semente" };

    out.LINK_HUMANO = `${base}/t/calendario/${tokA}`;
    out.veredito =
      persistiu &&
      out.etapas["4_isolamento"].bate_em_A &&
      out.etapas["4_isolamento"].nao_vaza_para_B &&
      out.etapas["1_semente"].pipefy_ok
        ? "✅ S2 (horas+feriado) PROVADA"
        : "⚠️ revisar etapas";
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.erro = String(e).slice(0, 400);
    return NextResponse.json(out, { status: 500 });
  }
}
