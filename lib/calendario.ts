// Camada do PERFIL-CALENDÁRIO do trabalhador (S2 · mecânica Spotify).
// O Neon é o DONO VIVO da disponibilidade; o banco Pipefy (ZxbYr_AS) é só a
// SEMENTE inicial (o que o diarista declarou no opt-in). Na 1ª abertura do link
// o calendário vem pré-marcado com a semente; a partir do 1º save, o que vale é
// o Neon. `score_a7pro`/`rating`/identidade do banco NÃO são tocados por aqui.
//
// Esmaecimento (decisão Hugo 25/06): 45 dias sem renovar → fora do pool até
// reconfirmar. Mesma régua de frescor da vitrine (FRESHNESS_DAYS).
import { sql, ensureTurnosSchema } from "./db-turnos";
import { BANCO_TID, pipefyQuery, rawVal, type RawRecord } from "./pipefy";
import { FRESHNESS_DAYS } from "./talent";

// Vocabulário canônico — exatamente como o banco Pipefy grava (checklist_vertical).
// A UI exibe abreviado, mas o ESTADO guarda estes valores (alinha com match/S3).
export const DIAS_CANON = [
  "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo", "Feriados",
] as const;
export const TURNOS_CANON = ["Manhã", "Tarde", "Noite", "Madrugada"] as const;

// slugs lidos da semente (banco Pipefy) — espelham ESTADO-BANCO §8 / talent.ts.
const SB = {
  nome: "nome",
  cpf: "cpf",
  turnos: "turnos_disponiveis",
  dias: "dias_disponiveis",
  valSegSex: "valor_diaria_seg_sex_r",
  valFds: "valor_diaria_sab_dom_feriado_r",
} as const;

export type DisponibilidadeView = {
  card: string;
  nome: string | null; // primeiro nome — saudação calorosa (dado do próprio titular)
  dias: string[];
  turnos: string[];
  valorSegSex: number | null;
  valorFds: number | null;
  atualizadoEm: string | null; // ISO; null = nunca salvou (veio só da semente)
  esmaecido: boolean; // computado: >45d sem renovar
  fonte: "neon" | "semente"; // semente = 1ª vez (carregou do Pipefy)
};

export type SalvarInput = {
  dias: string[];
  turnos: string[];
  valorSegSex: number | null;
  valorFds: number | null;
};

// ---- helpers de normalização ----------------------------------------------
function asArray(v: string | string[] | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  const s = v.trim();
  if (s.startsWith("[")) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j)) return j.filter(Boolean);
    } catch {
      /* cai pro split */
    }
  }
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

function asMoney(v: string | string[] | number | null): number | null {
  if (v == null || Array.isArray(v)) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v)
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function primeiroNome(nome: string | null): string | null {
  if (!nome) return null;
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : null;
}

// só deixa passar valores do vocabulário canônico (defesa contra POST adulterado).
function filtraCanon(arr: string[], canon: readonly string[]): string[] {
  const set = new Set(canon);
  return Array.from(new Set(arr)).filter((x) => set.has(x));
}

function diasDesdeISO(iso: string | null): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}

// ---- semente: lê o registro do banco Pipefy (1 record) ---------------------
type Semente = {
  nome: string | null;
  cpf: string | null;
  dias: string[];
  turnos: string[];
  valorSegSex: number | null;
  valorFds: number | null;
};

async function lerSemente(card: string): Promise<Semente | null> {
  try {
    const d = await pipefyQuery<{ table_record: RawRecord | null }>(
      `query($id:ID!){ table_record(id:$id){ id record_fields{ field{id} value array_value } } }`,
      { id: card },
    );
    const rec = d.table_record;
    if (!rec) return null;
    return {
      nome: (rawVal(rec, SB.nome) as string | null) ?? null,
      cpf: (rawVal(rec, SB.cpf) as string | null) ?? null,
      dias: filtraCanon(asArray(rawVal(rec, SB.dias)), DIAS_CANON),
      turnos: filtraCanon(asArray(rawVal(rec, SB.turnos)), TURNOS_CANON),
      valorSegSex: asMoney(rawVal(rec, SB.valSegSex)),
      valorFds: asMoney(rawVal(rec, SB.valFds)),
    };
  } catch {
    return null; // Pipefy fora do ar não derruba o calendário (degrada saudação/semente)
  }
}

type DispRow = {
  card: string;
  cpf: string | null;
  dias: string[];
  turnos: string[];
  valor_seg_sex: string | number | null;
  valor_fds: string | number | null;
  atualizado_em: string | null;
};

async function lerRow(card: string): Promise<DispRow | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const rows = (await sql`
    select card, cpf, dias, turnos, valor_seg_sex, valor_fds,
           to_char(atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
    from disponibilidade
    where card = ${card}
    limit 1
  `) as DispRow[];
  return rows.length ? rows[0] : null;
}

/**
 * Lê a disponibilidade viva do diarista. Se o Neon ainda não tem linha pra esse
 * card, SEMEIA com o que está no banco Pipefy (não grava ainda — só pré-marca a
 * tela; o 1º save é que materializa no Neon). Sempre busca o nome no banco pra
 * saudação calorosa (dado do próprio titular).
 */
export async function lerDisponibilidade(card: string): Promise<DisponibilidadeView> {
  const [row, semente] = await Promise.all([lerRow(card), lerSemente(card)]);

  if (row) {
    const iso = row.atualizado_em;
    return {
      card,
      nome: primeiroNome(semente?.nome ?? null),
      dias: filtraCanon(row.dias ?? [], DIAS_CANON),
      turnos: filtraCanon(row.turnos ?? [], TURNOS_CANON),
      valorSegSex: asMoney(row.valor_seg_sex),
      valorFds: asMoney(row.valor_fds),
      atualizadoEm: iso,
      esmaecido: diasDesdeISO(iso) > FRESHNESS_DAYS,
      fonte: "neon",
    };
  }

  // sem linha no Neon → 1ª vez: pré-marca pela semente do Pipefy
  return {
    card,
    nome: primeiroNome(semente?.nome ?? null),
    dias: semente?.dias ?? [],
    turnos: semente?.turnos ?? [],
    valorSegSex: semente?.valorSegSex ?? null,
    valorFds: semente?.valorFds ?? null,
    atualizadoEm: null,
    esmaecido: false, // semente recém-carregada conta como fresca até ele salvar
    fonte: "semente",
  };
}

/**
 * Salva (upsert por card) a disponibilidade viva no Neon, carimba atualizado_em
 * e reseta esmaecido=false (renovou ⇒ volta ao pool). Filtra ao vocabulário
 * canônico. Preserva o cpf já semeado (coalesce). Devolve a view atualizada.
 */
export async function salvarDisponibilidade(
  card: string,
  input: SalvarInput,
): Promise<DisponibilidadeView> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();

  const dias = filtraCanon(input.dias ?? [], DIAS_CANON);
  const turnos = filtraCanon(input.turnos ?? [], TURNOS_CANON);
  const vss = Number.isFinite(input.valorSegSex as number) ? input.valorSegSex : null;
  const vfds = Number.isFinite(input.valorFds as number) ? input.valorFds : null;

  // garante cpf no registro mesmo quando a linha nasce no save (lê da semente).
  const semente = await lerSemente(card);
  const cpf = semente?.cpf ?? null;

  await sql`
    insert into disponibilidade
      (card, cpf, dias, turnos, valor_seg_sex, valor_fds, esmaecido, atualizado_em)
    values
      (${card}, ${cpf}, ${dias}::text[], ${turnos}::text[], ${vss}, ${vfds}, false, now())
    on conflict (card) do update set
      cpf           = coalesce(excluded.cpf, disponibilidade.cpf),
      dias          = excluded.dias,
      turnos        = excluded.turnos,
      valor_seg_sex = excluded.valor_seg_sex,
      valor_fds     = excluded.valor_fds,
      esmaecido     = false,
      atualizado_em = now()
  `;

  return {
    card,
    nome: primeiroNome(semente?.nome ?? null),
    dias,
    turnos,
    valorSegSex: asMoney(vss),
    valorFds: asMoney(vfds),
    atualizadoEm: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    esmaecido: false,
    fonte: "neon",
  };
}
