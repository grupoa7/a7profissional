// PERSISTÊNCIA do PEDIDO + POOL (S3 · mecânica Uber) — escreve no Neon.
// Separado de match.ts (que é puro/decisão) — aqui mora o efeito colateral.
//
// PRINCÍPIO (PLANO-DE-VOO §3/§4): o `convite` nasce em status='pool' (PRÉ-ENVIO,
// SEM token). O disparo no WhatsApp (token + status='enviado') é da S4. Em S3 só
// materializamos que o pool nasceu. `endereco` da empresa fica OCULTO (convite cego,
// revelado só na seleção — S5); em S3 nem trafega pro lado trabalhador.
import { sql, ensureTurnosSchema } from "./db-turnos";
import { montarPool } from "./match";
import { emitirConvites } from "./convites";

export type CriarPedidoInput = {
  empresa: string; // "Blue" no Cliente 00
  funcao: string;
  data: string; // "YYYY-MM-DD"
  inicio: string; // "HH:MM" (a diária ocupa 9h a partir daqui)
  valor: number;
  vagas: number; // N
  bairro?: string | null;
  endereco?: string | null; // oculto até a seleção (S5)
  janelaAte?: string | null; // ISO; default null (janela ao vivo é S5)
  // S7 (mecânica Uber assíncrona): o pedido nasce 'buscando' (a montagem do pool roda
  // DEPOIS, em background, via /api/portal/montar). Quem não passa status cai em 'aberto'
  // (compatível com o fluxo antigo/síncrono). Status é text livre — sem DDL.
  status?: string;
};

/** Cria o pedido no Neon e devolve o id. */
export async function criarPedido(p: CriarPedidoInput): Promise<number> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();
  const rows = (await sql`
    insert into pedido (empresa, funcao, bairro, endereco, data, hora, valor, vagas, janela_ate, status)
    values (
      ${p.empresa}, ${p.funcao}, ${p.bairro ?? null}, ${p.endereco ?? null},
      ${p.data}::date, ${p.inicio}, ${p.valor}, ${Math.max(1, p.vagas)},
      ${p.janelaAte ?? null}, ${p.status ?? "aberto"}
    )
    returning id
  `) as Array<{ id: number }>;
  return Number(rows[0].id);
}

/** Conta os convites (pool) de um pedido. Helper interno da montagem assíncrona. */
async function contarPool(pedidoId: number): Promise<number> {
  if (!sql) return 0;
  const r = (await sql`select count(*)::int as n from convite where pedido_id = ${pedidoId}`) as Array<{ n: number }>;
  return r[0]?.n ?? 0;
}

export type MontarBuscaResult =
  | { ok: true; status: string; total: number; emitidos: number; jaProcessado?: boolean }
  | { ok: false; erro: string };

/**
 * TRABALHO PESADO da busca (S7 · assíncrono). Roda DEPOIS da convocação, disparado pelo
 * client via POST /api/portal/montar. Faz, nesta ordem, exatamente o que o `convocar()`
 * síncrono fazia — só que fora do caminho que trava a tela:
 *   montarPool (match, ~lento no Pipefy) → persistirPool → emitirConvites
 * e então vira o pedido de 'buscando' → 'aberto' (transição condicional anti-corrida).
 *
 * NÃO toca a lógica provada por dentro (match/persistir/emitir intactos — S3/S4). Só muda
 * QUANDO/ONDE são chamados.
 *
 * SEGURO PRA RE-DISPARAR E RODAR EM PARALELO (o auto-retry do painel depende disso):
 *   - persistirPool é idempotente por (pedido_id, card);
 *   - emitirConvites só toca quem está em 'pool' SEM token (UPDATE condicional);
 *   - a virada final é `where status='buscando'` (só um disparo "ganha").
 * Se falhar no meio, o pedido FICA em 'buscando' (não rebaixa nada) e um retry recupera.
 * Se já saiu de 'buscando', devolve o estado atual sem reprocessar (idempotente).
 */
export async function montarBusca(pedidoId: number): Promise<MontarBuscaResult> {
  if (!sql) return { ok: false, erro: "Banco (Neon) indisponível." };
  await ensureTurnosSchema();
  const rows = (await sql`
    select id, funcao, to_char(data, 'YYYY-MM-DD') as data, hora, valor, vagas, status
    from pedido where id = ${pedidoId} limit 1
  `) as Array<{ id: number; funcao: string | null; data: string | null; hora: string | null; valor: number | null; vagas: number; status: string }>;
  if (!rows.length) return { ok: false, erro: "pedido não encontrado" };
  const p = rows[0];

  // já saiu de 'buscando' → idempotente (outra aba / retry já montou). Não refaz.
  if (p.status !== "buscando") {
    const total = await contarPool(pedidoId);
    return { ok: true, status: p.status, total, emitidos: total, jaProcessado: true };
  }
  if (!p.funcao || !p.data || !p.hora || p.valor == null) {
    return { ok: false, erro: "pedido sem dados para montar a busca" };
  }

  try {
    const pool = await montarPool({
      funcao: p.funcao,
      data: p.data,
      inicio: p.hora,
      valor: Number(p.valor),
      vagas: Number(p.vagas),
    });
    await persistirPool(pedidoId, pool.aptos.map((a) => a.card));
    const emitidos = await emitirConvites(pedidoId);
    // transição final (anti-corrida): só de 'buscando' → 'aberto'.
    await sql`update pedido set status = 'aberto' where id = ${pedidoId} and status = 'buscando'`;
    return { ok: true, status: "aberto", total: pool.total, emitidos: emitidos.length };
  } catch {
    // falhou no meio: NÃO mexe no status (fica 'buscando') → o retry do painel recupera.
    return { ok: false, erro: "não consegui montar a busca agora" };
  }
}

/**
 * Materializa o POOL: 1 linha `convite` por card, status='pool' (pré-envio, sem token).
 * Idempotente por (pedido_id, card): se já existe linha pra esse card nesse pedido, não duplica.
 * Devolve quantas linhas o pool tem.
 */
export async function persistirPool(pedidoId: number, cards: string[]): Promise<number> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();
  const unicos = Array.from(new Set(cards.filter(Boolean)));
  for (const card of unicos) {
    await sql`
      insert into convite (pedido_id, card, status)
      select ${pedidoId}, ${card}, 'pool'
      where not exists (
        select 1 from convite where pedido_id = ${pedidoId} and card = ${card}
      )
    `;
  }
  const r = (await sql`select count(*)::int as n from convite where pedido_id = ${pedidoId}`) as Array<{ n: number }>;
  return r[0]?.n ?? 0;
}

export type PedidoRow = {
  id: number;
  empresa: string;
  funcao: string | null;
  data: string | null; // "YYYY-MM-DD"
  hora: string | null;
  valor: number | null;
  vagas: number;
  status: string;
  criado_em: string; // ISO
  pool: number; // nº total de convites do pedido
  enviado: number; // convites disparados (pré-convite saiu), aguardando resposta (S4)
  interesse: number; // convites com "Tenho interesse" confirmado (S4)
};

/** Lista os pedidos de uma empresa (mais recentes primeiro) + a contagem do pool. */
export async function lerPedidos(empresa: string): Promise<PedidoRow[]> {
  if (!sql) return [];
  await ensureTurnosSchema();
  const rows = (await sql`
    select p.id, p.empresa, p.funcao,
           to_char(p.data, 'YYYY-MM-DD') as data,
           p.hora, p.valor, p.vagas, p.status,
           to_char(p.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as criado_em,
           (select count(*)::int from convite c where c.pedido_id = p.id) as pool,
           (select count(*)::int from convite c where c.pedido_id = p.id and c.status = 'enviado') as enviado,
           (select count(*)::int from convite c where c.pedido_id = p.id and c.status = 'interesse') as interesse
    from pedido p
    where p.empresa = ${empresa}
    order by p.id desc
    limit 50
  `) as Array<any>;
  return rows.map((r) => ({
    id: Number(r.id),
    empresa: r.empresa,
    funcao: r.funcao,
    data: r.data,
    hora: r.hora,
    valor: r.valor == null ? null : Number(r.valor),
    vagas: Number(r.vagas),
    status: r.status,
    criado_em: r.criado_em,
    pool: Number(r.pool),
    enviado: Number(r.enviado),
    interesse: Number(r.interesse),
  }));
}

/** O pedido VIVO mais recente da empresa (status 'buscando' ou 'aberto'), ou null.
 *  S7: a /portal usa isto pra reexibir o painel inline da busca em andamento mesmo
 *  depois de um refresh (continuidade estilo Uber). */
export async function lerPedidoVivo(empresa: string): Promise<number | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const r = (await sql`
    select id from pedido
    where empresa = ${empresa} and status in ('buscando', 'aberto')
    order by id desc limit 1
  `) as Array<{ id: number }>;
  return r.length ? Number(r[0].id) : null;
}

/** Cards (ids) do pool de um pedido — pra rehidratar o "porquê" via match na tela. */
export async function lerPoolCards(pedidoId: number): Promise<string[]> {
  if (!sql) return [];
  await ensureTurnosSchema();
  const rows = (await sql`
    select card from convite where pedido_id = ${pedidoId} and status = 'pool' order by id asc
  `) as Array<{ card: string }>;
  return rows.map((r) => r.card);
}

/** Lê 1 pedido (pra remontar o cabeçalho da tela). */
export async function lerPedido(pedidoId: number): Promise<PedidoRow | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const rows = (await sql`
    select p.id, p.empresa, p.funcao,
           to_char(p.data, 'YYYY-MM-DD') as data,
           p.hora, p.valor, p.vagas, p.status,
           to_char(p.criado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as criado_em,
           (select count(*)::int from convite c where c.pedido_id = p.id) as pool,
           (select count(*)::int from convite c where c.pedido_id = p.id and c.status = 'enviado') as enviado,
           (select count(*)::int from convite c where c.pedido_id = p.id and c.status = 'interesse') as interesse
    from pedido p where p.id = ${pedidoId} limit 1
  `) as Array<any>;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    empresa: r.empresa,
    funcao: r.funcao,
    data: r.data,
    hora: r.hora,
    valor: r.valor == null ? null : Number(r.valor),
    vagas: Number(r.vagas),
    status: r.status,
    criado_em: r.criado_em,
    pool: Number(r.pool),
    enviado: Number(r.enviado),
    interesse: Number(r.interesse),
  };
}
