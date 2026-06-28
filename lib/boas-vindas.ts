// Camada da TORNEIRA DE BOAS-VINDAS — a peça que a skill "Lia" consome pra saber
// quem saudar. Reusa a régua de EXIBÍVEL da vitrine (getTalentCards) como fonte
// única — a boas-vindas NUNCA reimplementa elegibilidade. O estado "já saudei"
// mora no Neon (tabela boas_vindas), nunca no Pipefy.
//
// PII (telefone) sai só server-side, atrás do segredo das torneiras. O DTO da
// vitrine já traz funcao/dias/valor pro resumo; o telefone vem de lerContatoDoCard.
import { neon } from "@neondatabase/serverless";
import { getTalentCards } from "./talent";
import { lerContatoDoCard } from "./convites";
import { makeCalendarToken } from "./auth";

const url = process.env.DATABASE_URL;
// Reusa a MESMA instância Neon do portal/ciclo (db.ts / db-turnos.ts).
export const sql = url ? neon(url) : null;

let schemaReady = false;

/** Cria a tabela boas_vindas se não existir. Idempotente (anti-corrida via try/catch). */
export async function ensureBoasVindasSchema(): Promise<void> {
  if (!sql || schemaReady) return;
  await sql`
    create table if not exists boas_vindas (
      card          text primary key,            -- id do table_record (1:1 CPF)
      status        text not null default 'enviada',  -- enviada | optout
      enviada_em    timestamptz not null default now(),
      atualizado_em timestamptz not null default now()
    )
  `;
  schemaReady = true;
}

/** Conjunto de cards que já receberam boas-vindas (ou optout) — saem da fila. */
export async function cardsSaudados(): Promise<Set<string>> {
  if (!sql) return new Set();
  await ensureBoasVindasSchema();
  const rows = (await sql`select card from boas_vindas`) as { card: string }[];
  return new Set(rows.map((r) => String(r.card)));
}

/** Marca um card como saudado. Idempotente (upsert). */
export async function marcarSaudado(
  card: string,
  status: "enviada" | "optout" = "enviada",
): Promise<{ card: string; status: string; enviada_em: string }> {
  if (!sql) throw new Error("sem DATABASE_URL");
  await ensureBoasVindasSchema();
  const rows = (await sql`
    insert into boas_vindas (card, status)
    values (${card}, ${status})
    on conflict (card) do update
      set status = excluded.status, atualizado_em = now()
    returning card, status, enviada_em
  `) as { card: string; status: string; enviada_em: string }[];
  return rows[0];
}

const DIA_FULL: Record<string, string> = {
  Dom: "domingo", Seg: "segunda", Ter: "terça", Qua: "quarta",
  Qui: "quinta", Sex: "sexta", "Sáb": "sábado",
};

// "Seg,Ter,Qua,Qui,Sex" (5 dias úteis) → "seg a sex"; senão lista os dias.
function resumoDias(dias: string[]): string {
  if (!dias.length) return "";
  const uteis = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const set = new Set(dias);
  const temTodosUteis = uteis.every((d) => set.has(d));
  if (temTodosUteis && !set.has("Sáb") && !set.has("Dom")) return "seg a sex";
  if (temTodosUteis && set.has("Sáb") && set.has("Dom")) return "todos os dias";
  return dias.map((d) => DIA_FULL[d] ?? d).join(", ");
}

function resumoInfoInicial(funcao: string | null, dias: string[], valor: number | null): string {
  const partes: string[] = [];
  if (funcao) partes.push(funcao);
  const d = resumoDias(dias);
  if (d) partes.push(d);
  if (valor && valor > 0) partes.push(`a partir de R$${Math.round(valor)}`);
  if (!partes.length) return "sua função e a disponibilidade que você declarou";
  return partes.join(", ");
}

function primeiroNome(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : "";
}

export type PendenteBoasVindas = {
  card: string;
  primeiroNome: string;
  telefone: string | null;
  linkCalendario: string;
  resumoInfoInicial: string;
};

/**
 * Lista exibíveis ainda não saudados, prontos pra Lia disparar.
 * baseUrl: origem do deploy (pra montar o link de calendário).
 */
export async function listarPendentes(
  opts: { limite?: number; baseUrl: string },
): Promise<{ total: number; pendentes: PendenteBoasVindas[] }> {
  const limite = Number.isFinite(opts.limite) && (opts.limite as number) > 0
    ? Math.min(Number(opts.limite), 200)
    : 35;

  const [cards, saudados] = await Promise.all([getTalentCards(), cardsSaudados()]);
  const fila = cards.filter((c) => !saudados.has(String(c.id))).slice(0, limite);

  const base = opts.baseUrl.replace(/\/$/, "");
  const pendentes: PendenteBoasVindas[] = [];
  for (const c of fila) {
    const { telefone, nome } = await lerContatoDoCard(String(c.id));
    const token = makeCalendarToken(String(c.id));
    pendentes.push({
      card: String(c.id),
      primeiroNome: primeiroNome(nome) || (c.nomeParcial?.split(" ")[0] ?? ""),
      telefone,
      linkCalendario: `${base}/t/calendario/${token}`,
      resumoInfoInicial: resumoInfoInicial(c.funcao, c.dias, c.valorSegSex),
    });
  }
  return { total: pendentes.length, pendentes };
}
