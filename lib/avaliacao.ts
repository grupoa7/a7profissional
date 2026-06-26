// AVALIAÇÃO DO TURNO + PROJEÇÃO VIVA (S6 · fecho do ciclo Cliente 00).
// Depois que o turno acontece, a EMPRESA avalia (compareceu/★/chamaria/motivo/obs).
// Isso vira 1 linha no LIVRO-RAZÃO `avaliacao` (Neon, fonte da verdade) e dispara a
// projeção REPUT v1.0 (já pronta em lib/reputacao.ts), que grava os 4 campos de
// reputação no banco Pipefy. É o loop que torna o score_a7pro FALSIFICÁVEL.
//
// GUARD-RAILS (PLANO-DE-VOO §7):
//   - Livro-razão é IMUTÁVEL (append-only). Correção = ANULAR a linha (D-B), nunca editar.
//   - score_a7pro/rating/identidade NUNCA tocados — a projeção só escreve os 4 campos de
//     reputação. A reputação (turnos) é sinal SEPARADO do selo (entrada).
//   - Avaliação é AÇÃO DA EMPRESA LOGADA (a rota gateia por sessão). `obs`/`avaliador` são
//     uso interno e NUNCA saem em payload exposto.
//   - Isolamento: só avalia turno do próprio estabelecimento (empresa da sessão).
import { sql, ensureTurnosSchema } from "./db-turnos";
import { lerContatoDoCard } from "./convites";
import { getTalentCards, type TalentCard } from "./talent";
import { projetarEEscrever, lerCardParaProva } from "./reputacao";

// ===================== VOCABULÁRIO CANÔNICO (contrato TURNO v1.0) =====================
// Bater EXATO com a fórmula REPUT v1.0 (db-turnos.estrelaEquivalente). Qualquer valor
// fora disto é rejeitado no servidor — não confiamos só no client.
export const COMPARECIMENTOS = ["Compareceu", "Atrasou", "Faltou com aviso", "Faltou sem aviso"] as const;
export const CHAMARIA = ["Sim", "Não"] as const;
// D-D (decisão Hugo): checklist obrigatório quando estrelas ≤ 3 OU chamaria = Não.
export const MOTIVOS = [
  "Atraso",
  "Postura",
  "Apresentação",
  "Ritmo",
  "Não seguiu orientação",
  "Outro",
] as const;

export type Comparecimento = (typeof COMPARECIMENTOS)[number];
export type Chamaria = (typeof CHAMARIA)[number];

export type AvaliacaoInput = {
  comparecimento: Comparecimento;
  estrelas: number; // 1..5
  chamaria: Chamaria;
  motivo?: string[]; // checklist (obrigatório quando estrelas<=3 OU chamaria='Não')
  obs?: string; // USO INTERNO — nunca exposto
};

/** Regra D-D: o checklist de motivo é obrigatório quando a nota é baixa OU não chamaria. */
export function motivoObrigatorio(estrelas: number, chamaria: string): boolean {
  return estrelas <= 3 || chamaria === "Não";
}

/** Valida o payload contra o vocabulário canônico + regra do motivo. Retorna msg de erro ou null. */
export function validarAvaliacao(input: Partial<AvaliacaoInput>): string | null {
  const comp = input.comparecimento;
  const estrelas = Number(input.estrelas);
  const chamaria = input.chamaria;
  const motivo = Array.isArray(input.motivo) ? input.motivo : [];
  if (!comp || !(COMPARECIMENTOS as readonly string[]).includes(comp)) return "Comparecimento inválido.";
  if (!Number.isInteger(estrelas) || estrelas < 1 || estrelas > 5) return "Estrelas deve ser de 1 a 5.";
  if (!chamaria || !(CHAMARIA as readonly string[]).includes(chamaria)) return "Campo 'chamaria de novo' inválido.";
  for (const m of motivo) {
    if (!(MOTIVOS as readonly string[]).includes(m)) return `Motivo inválido: ${m}.`;
  }
  if (motivoObrigatorio(estrelas, chamaria) && motivo.length === 0) {
    return "Selecione ao menos um motivo (nota baixa ou 'não chamaria' exigem o porquê).";
  }
  return null;
}

// ===================== LISTA DE TURNOS A AVALIAR (D-A) =====================
// Gated por sessão na rota. Turnos da empresa cujo dia já passou (data_do_turno <= hoje)
// e que ainda NÃO têm avaliação viva (não-anulada). No-show entra aqui também (o turno
// nasceu agendado; "Faltou sem aviso" é uma avaliação válida).
export type TurnoParaAvaliar = {
  turnoId: number;
  card: string;
  nome: string; // PII gated por sessão da empresa
  primeiroNome: string;
  funcao: string | null;
  selo: string;
  estabelecimento: string;
  dataDoTurno: string | null; // YYYY-MM-DD
  status: string; // agendado | realizado
};

function primeiroNome(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : "—";
}

export async function lerTurnosParaAvaliar(empresa: string): Promise<TurnoParaAvaliar[]> {
  if (!sql) return [];
  await ensureTurnosSchema();
  // turno avaliável: do estabelecimento da sessão, dia já passou, ainda não avaliado, e
  // SEM linha de avaliação viva (não-anulada). Isolamento por `estabelecimento`.
  const rows = (await sql`
    select t.id, t.card, t.funcao, t.estabelecimento, t.status,
           to_char(t.data_do_turno, 'YYYY-MM-DD') as data_do_turno
    from turno t
    where t.estabelecimento = ${empresa}
      and t.status in ('agendado','realizado')
      and t.data_do_turno is not null
      and t.data_do_turno <= current_date
      and not exists (
        select 1 from avaliacao a where a.turno_id = t.id and not a.anulada
      )
    order by t.data_do_turno asc, t.id asc
  `) as Array<{
    id: number;
    card: string;
    funcao: string | null;
    estabelecimento: string;
    status: string;
    data_do_turno: string | null;
  }>;

  // perfil (selo) do universo exibível, best-effort (não bloqueia se o Pipefy falhar).
  const talentMap = new Map<string, TalentCard>();
  try {
    for (const t of await getTalentCards()) talentMap.set(t.id, t);
  } catch {
    /* sem Pipefy: segue só com o Neon */
  }

  const out: TurnoParaAvaliar[] = [];
  for (const r of rows) {
    const { nome } = await lerContatoDoCard(r.card);
    const t = talentMap.get(r.card);
    out.push({
      turnoId: Number(r.id),
      card: r.card,
      nome: nome || t?.nomeParcial || "—",
      primeiroNome: primeiroNome(nome),
      funcao: r.funcao ?? t?.funcao ?? null,
      selo: t?.selo ?? "—",
      estabelecimento: r.estabelecimento,
      dataDoTurno: r.data_do_turno,
      status: r.status,
    });
  }
  return out;
}

/** Lê 1 turno avaliável (gated). Usado pela página /portal/avaliar/[turno] pra montar o form. */
export async function lerTurnoParaAvaliar(empresa: string, turnoId: number): Promise<TurnoParaAvaliar | null> {
  const lista = await lerTurnosParaAvaliar(empresa);
  return lista.find((t) => t.turnoId === turnoId) ?? null;
}

// ===================== REGISTRAR AVALIAÇÃO (livro-razão → projeção viva) =====================
export type RegistrarResult =
  | {
      ok: true;
      avaliacaoId: number;
      turnoId: number;
      card: string;
      // resultado da projeção REPUT v1.0 + prova de que score_a7pro/rating ficaram intactos
      projecao: Awaited<ReturnType<typeof projetarEEscrever>>;
      prova: Awaited<ReturnType<typeof lerCardParaProva>>;
    }
  | { ok: false; erro: string };

/**
 * Insere 1 avaliação no livro-razão e dispara a projeção viva.
 *   - valida vocabulário canônico + regra do motivo (D-D);
 *   - isola por empresa (só avalia turno do próprio estabelecimento);
 *   - anti-corrida / idempotência D-B: só insere se o turno ainda não tem avaliação VIVA;
 *   - marca turno.status='avaliado';
 *   - chama projetarEEscrever() (recalcula do livro-razão e grava os 4 campos no Pipefy).
 * `avaliador` = empresa (interno, oculto). `obs` = uso interno.
 */
export async function registrarAvaliacao(
  empresa: string,
  turnoId: number,
  input: AvaliacaoInput,
): Promise<RegistrarResult> {
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();

  const erroVocab = validarAvaliacao(input);
  if (erroVocab) return { ok: false, erro: erroVocab };

  // turno tem que existir, ser do estabelecimento da sessão e estar avaliável.
  const tr = (await sql`
    select id, card, cpf, estabelecimento, status,
           (data_do_turno is not null and data_do_turno <= current_date) as venceu
    from turno where id = ${turnoId} limit 1
  `) as Array<{ id: number; card: string; cpf: string | null; estabelecimento: string; status: string; venceu: boolean }>;
  if (!tr.length) return { ok: false, erro: "turno não encontrado" };
  const t = tr[0];
  if (t.estabelecimento !== empresa) return { ok: false, erro: "esse turno não é da sua empresa" };
  if (t.status === "avaliado") return { ok: false, erro: "esse turno já foi avaliado" };
  if (!t.venceu) return { ok: false, erro: "o turno ainda não aconteceu" };

  // anti-corrida (D-B): só insere se NÃO houver avaliação viva pra este turno.
  const ja = (await sql`
    select id from avaliacao where turno_id = ${turnoId} and not anulada limit 1
  `) as Array<{ id: number }>;
  if (ja.length) return { ok: false, erro: "esse turno já foi avaliado" };

  const motivo = Array.isArray(input.motivo) ? input.motivo : [];
  const obs = (input.obs ?? "").trim() || null;

  const ins = (await sql`
    insert into avaliacao (turno_id, card, cpf, comparecimento, estrelas, chamaria, motivo, obs, avaliador, versao_contrato)
    values (${turnoId}, ${t.card}, ${t.cpf}, ${input.comparecimento}, ${input.estrelas},
            ${input.chamaria}, ${motivo}, ${obs}, ${empresa}, 'TURNO v1.0')
    returning id
  `) as Array<{ id: number }>;
  const avaliacaoId = Number(ins[0].id);

  // turno → avaliado (anti-corrida: só sai de agendado/realizado).
  await sql`
    update turno set status = 'avaliado'
    where id = ${turnoId} and status in ('agendado','realizado')
  `;

  // PROJEÇÃO VIVA: relê o livro-razão e grava os 4 campos no banco Pipefy (REPUT v1.0).
  const projecao = await projetarEEscrever();
  // PROVA: lê do card os 4 campos + os intocáveis (score_a7pro/rating) pra mostrar que a
  // entrada não foi tocada.
  const prova = await lerCardParaProva(t.card);

  return { ok: true, avaliacaoId, turnoId, card: t.card, projecao, prova };
}

// ===================== ANULAR (estorno administrativo, D-B) =====================
// Append-only: NÃO deleta a linha. Marca anulada=true (some da projeção) e reprojeta.
// Ação interna (sem UI nesta sessão). Reabre o turno pra reavaliação (status volta a
// 'realizado') se não houver outra avaliação viva.
export type AnularResult =
  | { ok: true; avaliacaoId: number; reprojetou: Awaited<ReturnType<typeof projetarEEscrever>> }
  | { ok: false; erro: string };

export async function anularAvaliacao(avaliacaoId: number, motivo: string): Promise<AnularResult> {
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  const rows = (await sql`
    select id, turno_id, anulada from avaliacao where id = ${avaliacaoId} limit 1
  `) as Array<{ id: number; turno_id: number | null; anulada: boolean }>;
  if (!rows.length) return { ok: false, erro: "avaliação não encontrada" };
  if (rows[0].anulada) return { ok: false, erro: "essa avaliação já está anulada" };

  await sql`
    update avaliacao set anulada = true, motivo_anulacao = ${motivo || null}, anulada_em = now()
    where id = ${avaliacaoId} and not anulada
  `;
  // reabre o turno pra reavaliação se não sobrou nenhuma avaliação viva.
  const turnoId = rows[0].turno_id;
  if (turnoId) {
    const viva = (await sql`
      select id from avaliacao where turno_id = ${turnoId} and not anulada limit 1
    `) as Array<{ id: number }>;
    if (!viva.length) {
      await sql`update turno set status = 'realizado' where id = ${turnoId} and status = 'avaliado'`;
    }
  }
  const reprojetou = await projetarEEscrever();
  return { ok: true, avaliacaoId, reprojetou };
}

// ===================== LEITURA DE REPUTAÇÃO DO CARD (D-C, exibição com volume) =====================
// Projeção viva de UM card a partir do livro-razão (não-anulado). A regra de EXIBIÇÃO
// (n_turnos >= MIN_TURNOS_EXIBE) vive em talent.ts; aqui é só o cálculo.
export const MIN_TURNOS_EXIBE = 3;

export type ReputacaoCardLeitura = {
  card: string;
  reputacaoTurnos: number;
  nTurnos: number;
  dataUltima: string | null;
};

export async function lerReputacaoCard(card: string): Promise<ReputacaoCardLeitura | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const rows = (await sql`
    select a.estrelas, a.comparecimento, a.chamaria,
           to_char(t.data_do_turno, 'YYYY-MM-DD') as data_do_turno
    from avaliacao a
    left join turno t on t.id = a.turno_id
    where a.card = ${card} and not a.anulada
  `) as Array<{ estrelas: number | null; comparecimento: string | null; chamaria: string | null; data_do_turno: string | null }>;
  if (!rows.length) return null;
  // reusa a fórmula canônica (REPUT v1.0) sem reimplementar a regra.
  const { estrelaEquivalente } = await import("./db-turnos");
  const eq = rows.map((r) => estrelaEquivalente(r));
  const rep = Math.round((eq.reduce((a, b) => a + b, 0) / eq.length) * 100) / 100;
  const datas = rows.map((r) => r.data_do_turno).filter(Boolean).sort() as string[];
  return {
    card,
    reputacaoTurnos: rep,
    nTurnos: rows.length,
    dataUltima: datas.length ? datas[datas.length - 1] : null,
  };
}
