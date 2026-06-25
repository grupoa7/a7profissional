// Camada de dados do CICLO DE DIÁRIA (Cliente 00 / Blue) — Neon Postgres.
// Separado de db.ts (que cuida só de `subscriber`) pra não inchar a trava do portal.
//
// PRINCÍPIO INEGOCIÁVEL (selado 14/06/2026, ver ESTADO-TURNOS.md):
//   A tabela `avaliacao` é o LIVRO-RAZÃO CRU — fonte da verdade da reputação.
//   A reputação é PROJEÇÃO recalculável disso (REPUT v1.0). Trocar a fórmula =
//   reler o livro-razão e regravar os 4 campos do banco Pipefy; nada se perde.
//   O `score_a7pro` (entrada, fórmula Coca-Cola) NUNCA é tocado por aqui.
//
// O Neon passa a ser dono do ESTADO OPERACIONAL VIVO; o Pipefy segue dono de
// identidade/score/selo. Chave de ligação entre os dois = o id do table_record
// do banco (ZxbYr_AS), guardado como `card` nas tabelas abaixo (1:1 com o CPF).
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
// Reusa a MESMA instância Neon do portal (db.ts) — só um schema a mais de tabelas.
export const sql = url ? neon(url) : null;

// ---- schema idempotente (nasce na 1ª escrita; CREATE IF NOT EXISTS é no-op barato) ----
let schemaReady = false;

/** Cria as 5 tabelas do ciclo de diária, se não existirem. Idempotente. */
export async function ensureTurnosSchema(): Promise<void> {
  if (!sql || schemaReady) return;

  // calendário vivo do trabalhador (Spotify) — S2 popula; aqui só nasce a casa.
  await sql`
    create table if not exists disponibilidade (
      id            bigint generated always as identity primary key,
      card          text not null unique,            -- id do table_record (1:1 CPF)
      cpf           text,
      dias          text[] not null default '{}',
      turnos        text[] not null default '{}',
      valor_seg_sex numeric,
      valor_fds     numeric,
      esmaecido     boolean not null default false,  -- quem não renova sai do pool
      atualizado_em timestamptz not null default now()
    )
  `;

  // pedido de diária da empresa (Uber) — endereço OCULTO até a seleção (convite cego).
  await sql`
    create table if not exists pedido (
      id         bigint generated always as identity primary key,
      empresa    text not null,                      -- "Blue" no Cliente 00
      funcao     text,
      bairro     text,
      endereco   text,                               -- só revelado ao selecionado
      data       date,
      hora       text,
      valor      numeric,
      vagas      int not null default 1,             -- N (quantas pessoas)
      janela_ate timestamptz,
      status     text not null default 'aberto',     -- aberto→fechado→cancelado
      criado_em  timestamptz not null default now()
    )
  `;

  // 1 linha por convidado do pool. status: enviado→interesse→selecionado→confirmado/expirado.
  await sql`
    create table if not exists convite (
      id            bigint generated always as identity primary key,
      pedido_id     bigint not null references pedido(id) on delete cascade,
      card          text not null,                   -- id do table_record (liga ao banco/CPF)
      token         text unique,                     -- link mágico do convite cego
      status        text not null default 'enviado',
      enviado_em    timestamptz not null default now(),
      respondido_em timestamptz
    )
  `;

  // convite confirmado vira turno (o que acontece de fato).
  await sql`
    create table if not exists turno (
      id               bigint generated always as identity primary key,
      pedido_id        bigint references pedido(id) on delete set null,
      convite_id       bigint references convite(id) on delete set null,
      card             text not null,                -- chave da projeção (liga ao banco/CPF)
      cpf              text,
      estabelecimento  text not null default 'Blue',
      funcao           text,
      data_do_turno    date,
      status           text not null default 'agendado', -- agendado→realizado→avaliado
      contato_liberado boolean not null default false,
      criado_em        timestamptz not null default now()
    )
  `;

  // LIVRO-RAZÃO CRU — fonte da verdade da reputação. 1 linha = 1 turno avaliado.
  // `card`/`cpf` denormalizados (além do turno_id) pra projeção robusta mesmo sem join.
  // `avaliador` guardado pro registro interno, mas NUNCA exposto (LGPD: oculta empresa
  // avaliadora no que sai). É só auditoria interna.
  await sql`
    create table if not exists avaliacao (
      id              bigint generated always as identity primary key,
      turno_id        bigint references turno(id) on delete cascade,
      card            text not null,                 -- id do table_record (liga ao banco/CPF)
      cpf             text,
      comparecimento  text,                          -- Compareceu/Atrasou/Faltou com aviso/Faltou sem aviso
      estrelas        int,                           -- 1..5
      chamaria        text,                          -- Sim/Não
      motivo          text[] not null default '{}',  -- checklist (nota baixa OU não chamaria)
      obs             text,                          -- USO INTERNO — nunca exposto
      avaliador       text,                          -- empresa/gestor — interno, oculto na exposição
      versao_contrato text not null default 'TURNO v1.0',
      criado_em       timestamptz not null default now()
    )
  `;

  schemaReady = true;
}

// ===================== REPUT v1.0 (fórmula PORTADA de projecao_turnos_a7pro.js) =====================
// Por turno, calcula uma "estrela-equivalente" (1..5):
//   base = estrelas (1..5)
//   comparecimento sobrepõe: "Faltou sem aviso" => 1 ; "Faltou com aviso" => 2
//   "Chamaria de novo? = Não" rebaixa o teto para 3 (sinal forte de insatisfação)
// reputacao_turnos = média das estrela-equivalentes do card. Trocar isto = bump de versão.
export const VERSAO_FORMULA_REP = "REPUT v1.0";

export function estrelaEquivalente(av: {
  estrelas?: number | null;
  comparecimento?: string | null;
  chamaria?: string | null;
}): number {
  let s = av.estrelas || 0;
  if (av.comparecimento === "Faltou sem aviso") s = 1;
  else if (av.comparecimento === "Faltou com aviso") s = 2;
  if (av.chamaria === "Não") s = Math.min(s, 3);
  return s;
}

export type AvaliacaoRow = {
  card: string;
  estrelas: number | null;
  comparecimento: string | null;
  chamaria: string | null;
  data_do_turno: string | null; // ISO (YYYY-MM-DD), vindo do join com turno
};

export type ReputacaoCard = {
  card: string;
  reputacao_turnos: number;
  n_turnos: number;
  data_ultima_avaliacao: string | null;
};

/** Lê o livro-razão (avaliacao) com a data do turno (join) — insumo cru da projeção. */
export async function lerLivroRazao(): Promise<AvaliacaoRow[]> {
  if (!sql) return [];
  await ensureTurnosSchema();
  const rows = (await sql`
    select a.card,
           a.estrelas,
           a.comparecimento,
           a.chamaria,
           to_char(t.data_do_turno, 'YYYY-MM-DD') as data_do_turno
    from avaliacao a
    left join turno t on t.id = a.turno_id
  `) as Array<AvaliacaoRow>;
  return rows;
}

/** Agrega o livro-razão por card → reputação (REPUT v1.0). Pura, recalculável. */
export function projetarReputacao(rows: AvaliacaoRow[]): ReputacaoCard[] {
  const byCard = new Map<string, AvaliacaoRow[]>();
  for (const r of rows) {
    if (!r.card) continue;
    const arr = byCard.get(r.card) ?? [];
    arr.push(r);
    byCard.set(r.card, arr);
  }
  const out: ReputacaoCard[] = [];
  for (const [card, avs] of byCard) {
    const eq = avs.map(estrelaEquivalente);
    const rep = Math.round((eq.reduce((a, b) => a + b, 0) / eq.length) * 100) / 100;
    const datas = avs.map((a) => a.data_do_turno).filter(Boolean).sort() as string[];
    out.push({
      card,
      reputacao_turnos: rep,
      n_turnos: avs.length,
      data_ultima_avaliacao: datas.length ? datas[datas.length - 1] : null,
    });
  }
  return out;
}
