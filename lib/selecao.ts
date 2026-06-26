// SELEÇÃO + HOLD + REVELAÇÃO + CONFIRMAÇÃO + PLANO B (S5 · fecho da convocação).
// Separado de convites.ts (que cuida do convite CEGO/pré-convite) e de pedidos.ts
// (pedido+pool). Aqui mora o que acontece DEPOIS do interesse: a empresa escolhe entre
// os interessados, a plataforma revela empresa+endereço SÓ ao escolhido, trava o slot,
// e o turno nasce quando o trabalhador confirma presença.
//
// DECISÕES TRAVADAS COM HUGO (AskUserQuestion S5, 26/06):
//   - Login: dogfood do Blue (cliente 0) — /api/auth/dogfood.
//   - Hold:  empresa seleciona até N + 20% (arredondando pra cima). limiteSelecao(N).
//   - Plano B: MANUAL — o convite recusado aparece na lista marcado "recusou" e a
//     empresa escolhe o próximo. Não há auto-promoção.
//   - Prazo confirmar: 4h após o envio do convite-escolha (lembrete repete até 3× — a
//     Skill cuida da cadência; aqui guardamos selecionado_em e computamos o prazo).
//   - Revelação: empresa+endereço pro trabalhador / nome+telefone pra empresa — SÓ no
//     estado selecionado/confirmado.
//
// GUARD-RAILS (PLANO-DE-VOO §7):
//   - HOLD honesto: um slot em hold não pode ser oferecido a dois ao mesmo tempo. As
//     transições de status usam UPDATE condicional (where status=...) = anti-corrida.
//   - PII: nome+telefone do trabalhador saem SÓ por leitura GATED por sessão da empresa
//     (lerPainel/revelarParaEmpresa). NUNCA por rota pública.
//   - score_a7pro/rating do banco Pipefy NUNCA são tocados aqui. Reputação/avaliação = S6.
import { sql, ensureTurnosSchema } from "./db-turnos";
import { resolveConviteId, lerContatoDoCard } from "./convites";
import { getTalentCards, type TalentCard } from "./talent";
import { siteUrl } from "./site";

// ---- regra de hold: a empresa pode selecionar até N + 20% (arredondando pra cima).
//   N=1→2 · N=2→3 · N=5→6 · N=10→12. Margem anti-recusa (decisão Hugo).
export function limiteSelecao(vagas: number): number {
  return Math.ceil(Math.max(1, vagas) * 1.2);
}

// ---- prazo de confirmação de presença (2º toque): 4h após o convite-escolha sair.
export const CONFIRMA_HORAS = 4;

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
function primeiroNome(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : "tudo bem";
}

const RANK: Record<string, number> = { AAA: 5, AA: 4, A: 3, B: 2, NOVATA: 1 };

// ============================ LEITURA GATED (polling + página) ============================
// O QUE A EMPRESA VÊ do seu pedido. Server-only — a rota que chama isto GATEIA por sessão.
export type Interessado = {
  conviteId: number;
  card: string;
  nome: string; // completo (empresa é dona do pool — PII gated por sessão)
  primeiroNome: string;
  telefone: string | null;
  funcao: string | null;
  selo: string;
  exato: boolean; // função idêntica à pedida
  status: string; // interesse | selecionado | confirmado | recusado
  selecionadoEm: string | null; // ISO
  prazoConfirmarAte: string | null; // ISO (selecionado_em + 4h)
  prazoEstourado: boolean; // selecionado e já passou das 4h sem confirmar
};

export type PainelPedido = {
  pedidoId: number;
  status: string; // aberto | fechado | cancelado
  vagas: number;
  limiteSelecao: number; // ceil(N*1.2)
  enviado: number; // convites disparados aguardando resposta
  interesse: number; // toparam, ainda não selecionados
  selecionado: number; // escolhidos ativos aguardando confirmar
  confirmado: number; // confirmaram presença (turno nasceu)
  recusado: number; // recusaram na revelação (plano B manual)
  podeSelecionar: boolean; // ainda há vaga e o limite de hold não estourou
  interessados: Interessado[]; // ranqueados (exato > selo > quem topou antes)
};

/** Lê o painel de UM pedido (gated por sessão na rota). Inclui a lista de interessados
 *  com nome+telefone — é o insumo do pool ao vivo e da seleção. */
export async function lerPainel(pedidoId: number): Promise<PainelPedido | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const ped = (await sql`
    select id, funcao, vagas, status from pedido where id = ${pedidoId} limit 1
  `) as Array<{ id: number; funcao: string | null; vagas: number; status: string }>;
  if (!ped.length) return null;
  const vagas = Number(ped[0].vagas);
  const funcaoAlvo = norm(ped[0].funcao);

  // convites do funil de seleção (pré-pool 'enviado' fica só na contagem).
  const rows = (await sql`
    select id, card, status,
           to_char(selecionado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as selecionado_em
    from convite
    where pedido_id = ${pedidoId}
      and status in ('interesse','selecionado','confirmado','recusado')
    order by id asc
  `) as Array<{ id: number; card: string; status: string; selecionado_em: string | null }>;

  // contagens (inclui 'enviado' pra "+y podem vir")
  const cont = (await sql`
    select status, count(*)::int as n from convite where pedido_id = ${pedidoId} group by status
  `) as Array<{ status: string; n: number }>;
  const c = (s: string) => cont.find((x) => x.status === s)?.n ?? 0;

  // mapa card→perfil (selo/função/nome parcial) do universo exibível, pra ranquear/exibir.
  const talentMap = new Map<string, TalentCard>();
  try {
    for (const t of await getTalentCards()) talentMap.set(t.id, t);
  } catch {
    /* sem Pipefy: segue só com o que tem no Neon */
  }

  const agora = Date.now();
  const interessados: Interessado[] = [];
  for (const r of rows) {
    const t = talentMap.get(r.card);
    const { telefone, nome } = await lerContatoDoCard(r.card);
    const prazoAte =
      r.selecionado_em
        ? new Date(new Date(r.selecionado_em).getTime() + CONFIRMA_HORAS * 3600_000).toISOString()
        : null;
    // PII (guard-rail §7): o TELEFONE só é liberado à empresa DEPOIS da seleção. Na fila
    // de interesse ela escolhe por nome+selo+função; o contato aparece ao selecionar.
    const revelaTel = r.status === "selecionado" || r.status === "confirmado";
    interessados.push({
      conviteId: Number(r.id),
      card: r.card,
      nome: nome || t?.nomeParcial || "—",
      primeiroNome: primeiroNome(nome),
      telefone: revelaTel ? telefone : null,
      funcao: t?.funcao ?? null,
      selo: t?.selo ?? "B",
      exato: !!t?.funcao && norm(t.funcao) === funcaoAlvo,
      status: r.status,
      selecionadoEm: r.selecionado_em,
      prazoConfirmarAte: prazoAte,
      prazoEstourado:
        r.status === "selecionado" && !!prazoAte && new Date(prazoAte).getTime() < agora,
    });
  }

  // ranking: função exata > selo desc > quem topou antes (id asc, já ordenado).
  interessados.sort(
    (a, b) =>
      Number(b.exato) - Number(a.exato) ||
      (RANK[b.selo] ?? 0) - (RANK[a.selo] ?? 0) ||
      a.conviteId - b.conviteId,
  );

  const selecionado = c("selecionado");
  const confirmado = c("confirmado");
  const lim = limiteSelecao(vagas);
  const podeSelecionar =
    ped[0].status === "aberto" &&
    confirmado < vagas &&
    selecionado + confirmado < lim;

  return {
    pedidoId,
    status: ped[0].status,
    vagas,
    limiteSelecao: lim,
    enviado: c("enviado"),
    interesse: c("interesse"),
    selecionado,
    confirmado,
    recusado: c("recusado"),
    podeSelecionar,
    interessados,
  };
}

// ============================ SELEÇÃO (interesse → selecionado, HOLD) ============================
export type SelecaoResult =
  | { ok: true; status: string; selecionado: number; confirmado: number; limite: number }
  | { ok: false; erro: string };

/**
 * A empresa escolhe um interessado → trava o slot (status='selecionado', carimba
 * selecionado_em). Respeita o limite N+20% e N de confirmados. Anti-corrida: só vira
 * 'selecionado' se ainda estava 'interesse'. Idempotente (re-selecionar = no-op ok).
 */
export async function selecionar(pedidoId: number, conviteId: number): Promise<SelecaoResult> {
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();

  const ped = (await sql`select vagas, status from pedido where id = ${pedidoId} limit 1`) as Array<{
    vagas: number;
    status: string;
  }>;
  if (!ped.length) return { ok: false, erro: "pedido não encontrado" };
  if (ped[0].status !== "aberto") return { ok: false, erro: "pedido encerrado" };
  const vagas = Number(ped[0].vagas);
  const lim = limiteSelecao(vagas);

  // estado atual do convite-alvo
  const cur = (await sql`
    select status from convite where id = ${conviteId} and pedido_id = ${pedidoId} limit 1
  `) as Array<{ status: string }>;
  if (!cur.length) return { ok: false, erro: "convite não é deste pedido" };
  // idempotente: já selecionado/confirmado → devolve o estado sem reprocessar.
  if (cur[0].status === "selecionado" || cur[0].status === "confirmado") {
    const co = await contagens(pedidoId);
    return { ok: true, status: cur[0].status, ...co, limite: lim };
  }
  if (cur[0].status !== "interesse") return { ok: false, erro: "só dá pra escolher quem topou (interesse)" };

  // checa o teto de hold ANTES de travar
  const co0 = await contagens(pedidoId);
  if (co0.confirmado >= vagas) return { ok: false, erro: "as vagas já foram preenchidas" };
  if (co0.selecionado + co0.confirmado >= lim)
    return { ok: false, erro: `limite de escolhas atingido (até ${lim} para ${vagas} vaga(s))` };

  // trava (anti-corrida): só vira selecionado se ainda estava interesse.
  const upd = (await sql`
    update convite set status = 'selecionado', selecionado_em = now()
    where id = ${conviteId} and pedido_id = ${pedidoId} and status = 'interesse'
    returning id
  `) as Array<{ id: number }>;
  if (!upd.length) return { ok: false, erro: "esse convite mudou de estado — recarregue" };

  const co = await contagens(pedidoId);
  return { ok: true, status: "selecionado", ...co, limite: lim };
}

async function contagens(pedidoId: number): Promise<{ selecionado: number; confirmado: number }> {
  const cont = (await sql!`
    select
      count(*) filter (where status='selecionado')::int as selecionado,
      count(*) filter (where status='confirmado')::int as confirmado
    from convite where pedido_id = ${pedidoId}
  `) as Array<{ selecionado: number; confirmado: number }>;
  return { selecionado: Number(cont[0]?.selecionado ?? 0), confirmado: Number(cont[0]?.confirmado ?? 0) };
}

/** Dados do escolhido pra empresa (nome+telefone). Gated por sessão na rota. */
export async function revelarParaEmpresa(
  pedidoId: number,
  conviteId: number,
): Promise<{ ok: true; nome: string; telefone: string | null } | { ok: false; erro: string }> {
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  const rows = (await sql`
    select card, status from convite where id = ${conviteId} and pedido_id = ${pedidoId} limit 1
  `) as Array<{ card: string; status: string }>;
  if (!rows.length) return { ok: false, erro: "convite não é deste pedido" };
  if (rows[0].status !== "selecionado" && rows[0].status !== "confirmado")
    return { ok: false, erro: "ainda não selecionado" };
  const { telefone, nome } = await lerContatoDoCard(rows[0].card);
  return { ok: true, nome, telefone };
}

// ============================ CONFIRMAR PRESENÇA (selecionado → confirmado) ============================
// AÇÃO DO TRABALHADOR (por `ref` = slug/token). Nasce o TURNO (agendado) e o contato é
// liberado dos dois lados. Idempotente: confirmar 2× = 1 turno. Ao atingir N confirmados,
// o pedido fecha sozinho.
export type ConfirmaResult =
  | { ok: true; status: "confirmado"; turnoId: number; pedidoFechou: boolean }
  | { ok: false; erro: string };

export async function confirmarPresenca(ref: string | null): Promise<ConfirmaResult> {
  const conviteId = await resolveConviteId(ref);
  if (!conviteId) return { ok: false, erro: "link inválido ou expirado" };
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();

  const rows = (await sql`
    select c.status as cstatus, c.card, c.pedido_id,
           p.status as pstatus, p.funcao, p.vagas, p.empresa,
           to_char(p.data, 'YYYY-MM-DD') as data
    from convite c join pedido p on p.id = c.pedido_id
    where c.id = ${conviteId} limit 1
  `) as Array<{
    cstatus: string;
    card: string;
    pedido_id: number;
    pstatus: string;
    funcao: string | null;
    vagas: number;
    empresa: string;
    data: string | null;
  }>;
  if (!rows.length) return { ok: false, erro: "convite não encontrado" };
  const r = rows[0];

  // idempotente: já confirmado → devolve o turno existente, sem duplicar.
  if (r.cstatus === "confirmado") {
    const t = (await sql`select id from turno where convite_id = ${conviteId} order by id asc limit 1`) as Array<{ id: number }>;
    return { ok: true, status: "confirmado", turnoId: Number(t[0]?.id ?? 0), pedidoFechou: r.pstatus !== "aberto" };
  }
  if (r.cstatus !== "selecionado")
    return { ok: false, erro: "esse convite ainda não foi escolhido" };
  if (r.pstatus !== "aberto") return { ok: false, erro: "encerrado" };

  // cpf (se houver no calendário) — robustez da projeção; turno.cpf é opcional.
  const disp = (await sql`select cpf from disponibilidade where card = ${r.card} limit 1`) as Array<{ cpf: string | null }>;
  const cpf = disp[0]?.cpf ?? null;

  // selecionado → confirmado (anti-corrida)
  const upd = (await sql`
    update convite set status = 'confirmado', confirmado_em = now()
    where id = ${conviteId} and status = 'selecionado'
    returning id
  `) as Array<{ id: number }>;
  if (!upd.length) return { ok: false, erro: "esse convite mudou de estado — recarregue" };

  // nasce o TURNO (agendado), contato liberado. Idempotência defensiva: só insere se
  // ainda não há turno pra este convite.
  const jaTurno = (await sql`select id from turno where convite_id = ${conviteId} limit 1`) as Array<{ id: number }>;
  let turnoId: number;
  if (jaTurno.length) {
    turnoId = Number(jaTurno[0].id);
  } else {
    const ins = (await sql`
      insert into turno (pedido_id, convite_id, card, cpf, estabelecimento, funcao, data_do_turno, status, contato_liberado)
      values (${r.pedido_id}, ${conviteId}, ${r.card}, ${cpf}, ${r.empresa}, ${r.funcao}, ${r.data}::date, 'agendado', true)
      returning id
    `) as Array<{ id: number }>;
    turnoId = Number(ins[0].id);
  }

  // ao atingir N confirmados, o pedido fecha sozinho (e expira o que ficou pendurado).
  const co = await contagens(r.pedido_id);
  let pedidoFechou = false;
  if (co.confirmado >= Number(r.vagas)) {
    await sql`update pedido set status = 'fechado' where id = ${r.pedido_id} and status = 'aberto'`;
    await sql`
      update convite set status = 'expirado'
      where pedido_id = ${r.pedido_id} and status in ('enviado','interesse','selecionado')
    `;
    pedidoFechou = true;
  }
  return { ok: true, status: "confirmado", turnoId, pedidoFechou };
}

// ============================ RECUSAR (selecionado → recusado) ============================
// AÇÃO DO TRABALHADOR (por `ref`). Libera o slot. O convite recusado APARECE na lista da
// empresa marcado "recusou" e ela escolhe o próximo (plano B MANUAL — decisão Hugo).
export type RecusaResult = { ok: true; status: "recusado" } | { ok: false; erro: string };

export async function recusar(ref: string | null): Promise<RecusaResult> {
  const conviteId = await resolveConviteId(ref);
  if (!conviteId) return { ok: false, erro: "link inválido ou expirado" };
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  const cur = (await sql`select status from convite where id = ${conviteId} limit 1`) as Array<{ status: string }>;
  if (!cur.length) return { ok: false, erro: "convite não encontrado" };
  if (cur[0].status === "recusado") return { ok: true, status: "recusado" }; // idempotente
  // só faz sentido recusar quem foi escolhido (selecionado). confirmado não recua.
  if (cur[0].status !== "selecionado") return { ok: false, erro: "nada a recusar" };
  await sql`
    update convite set status = 'recusado', recusado_em = now()
    where id = ${conviteId} and status = 'selecionado'
  `;
  return { ok: true, status: "recusado" };
}

// ============================ FECHAR PEDIDO (empresa, "fechar agora") ============================
export type FecharResult = { ok: true; status: "fechado" } | { ok: false; erro: string };

/** A empresa encerra a janela manualmente. Confirmados ficam; o resto vira 'expirado'. */
export async function fecharPedido(pedidoId: number): Promise<FecharResult> {
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  const ped = (await sql`select status from pedido where id = ${pedidoId} limit 1`) as Array<{ status: string }>;
  if (!ped.length) return { ok: false, erro: "pedido não encontrado" };
  if (ped[0].status !== "aberto") return { ok: true, status: "fechado" }; // idempotente
  await sql`update pedido set status = 'fechado' where id = ${pedidoId} and status = 'aberto'`;
  await sql`
    update convite set status = 'expirado'
    where pedido_id = ${pedidoId} and status in ('enviado','interesse','selecionado')
  `;
  return { ok: true, status: "fechado" };
}

// ============================ LEMBRETE (Skill, cadência do "você foi escolhido") ============================
// A Skill dispara o aviso de escolha; aqui só contamos quantas vezes já saiu (até 3×).
// Devolve os selecionados ainda NÃO confirmados que ainda podem receber lembrete.
export type LembreteAlvo = {
  conviteId: number;
  card: string;
  slug: string | null;
  lembretesEscolha: number;
  prazoConfirmarAte: string | null;
};

export async function lerSelecionadosParaAviso(pedidoId: number, maxLembretes = 3): Promise<LembreteAlvo[]> {
  if (!sql) return [];
  await ensureTurnosSchema();
  const rows = (await sql`
    select id, card, slug, lembretes_escolha,
           to_char(selecionado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as selecionado_em
    from convite
    where pedido_id = ${pedidoId} and status = 'selecionado' and lembretes_escolha < ${maxLembretes}
    order by id asc
  `) as Array<{ id: number; card: string; slug: string | null; lembretes_escolha: number; selecionado_em: string | null }>;
  return rows.map((r) => ({
    conviteId: Number(r.id),
    card: r.card,
    slug: r.slug,
    lembretesEscolha: Number(r.lembretes_escolha),
    prazoConfirmarAte: r.selecionado_em
      ? new Date(new Date(r.selecionado_em).getTime() + CONFIRMA_HORAS * 3600_000).toISOString()
      : null,
  }));
}

/** Marca que o aviso de escolha saiu (incrementa o contador). Idempotência leve. */
export async function marcarAvisoEnviado(conviteId: number): Promise<void> {
  if (!sql) return;
  await ensureTurnosSchema();
  await sql`update convite set lembretes_escolha = lembretes_escolha + 1 where id = ${conviteId} and status = 'selecionado'`;
}

// ---- TORNEIRA da Skill: lista de "você foi escolhido" a disparar (telefone+link).
// Server-only (a rota /api/portal/escolhidos gateia por segredo). Junta o telefone do
// banco Pipefy + o link curto + o prazo de 4h. Se `marcar=true`, incrementa o contador
// de lembretes (cadência até 3×, decisão Hugo).
export type EscolhidoAviso = {
  conviteId: number;
  card: string;
  primeiroNome: string;
  telefone: string | null;
  link: string;
  prazoConfirmarAte: string | null;
  lembretesEscolha: number;
};

export async function lerEscolhidosParaAviso(
  pedidoId: number,
  opts: { maxLembretes?: number; marcar?: boolean } = {},
): Promise<EscolhidoAviso[]> {
  const maxLembretes = opts.maxLembretes ?? 3;
  const alvos = await lerSelecionadosParaAviso(pedidoId, maxLembretes);
  const base = siteUrl.replace(/\/$/, "");
  const out: EscolhidoAviso[] = [];
  for (const a of alvos) {
    const { telefone, nome } = await lerContatoDoCard(a.card);
    const link = a.slug ? `${base}/c/${a.slug}` : "";
    out.push({
      conviteId: a.conviteId,
      card: a.card,
      primeiroNome: primeiroNome(nome),
      telefone,
      link,
      prazoConfirmarAte: a.prazoConfirmarAte,
      lembretesEscolha: a.lembretesEscolha,
    });
    if (opts.marcar) await marcarAvisoEnviado(a.conviteId);
  }
  return out;
}
