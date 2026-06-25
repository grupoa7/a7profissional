// PERSISTÊNCIA do PEDIDO + POOL (S3 · mecânica Uber) — escreve no Neon.
// Separado de match.ts (que é puro/decisão) — aqui mora o efeito colateral.
//
// PRINCÍPIO (PLANO-DE-VOO §3/§4): o `convite` nasce em status='pool' (PRÉ-ENVIO,
// SEM token). O disparo no WhatsApp (token + status='enviado') é da S4. Em S3 só
// materializamos que o pool nasceu. `endereco` da empresa fica OCULTO (convite cego,
// revelado só na seleção — S5); em S3 nem trafega pro lado trabalhador.
import { sql, ensureTurnosSchema } from "./db-turnos";

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
      ${p.janelaAte ?? null}, 'aberto'
    )
    returning id
  `) as Array<{ id: number }>;
  return Number(rows[0].id);
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
