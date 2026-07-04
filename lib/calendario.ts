// Camada do PERFIL-CALENDÁRIO do trabalhador (S2 · mecânica Spotify).
// O Neon é o DONO VIVO da disponibilidade; o banco Pipefy (ZxbYr_AS) é só a
// SEMENTE inicial (o que o diarista declarou no opt-in). Na 1ª abertura do link
// o calendário vem pré-marcado com a semente; a partir do 1º save, o que vale é
// o Neon. `score_a7pro`/`rating`/identidade do banco NÃO são tocados por aqui.
//
// MODELO (25/06): o trabalhador marca os DIAS DA SEMANA + uma JANELA DE HORÁRIO
// (das X às Y, podendo virar a noite) — não mais "turnos quadrados". FERIADO é um
// opt-in à parte (lógica/valor diferente), fora dos dias da semana. O `turnos`
// antigo do Pipefy só serve de SEMENTE aproximada da janela (mapa abaixo).
//
// Esmaecimento (decisão Hugo 25/06): 45 dias sem renovar → fora do pool até
// reconfirmar. Mesma régua de frescor da vitrine (FRESHNESS_DAYS).
import { sql, ensureTurnosSchema } from "./db-turnos";
import { BANCO_TID, pipefyQuery, rawVal, type RawRecord } from "./pipefy";
import { FRESHNESS_DAYS } from "./talent";

// Dias da semana canônicos (SEM "Feriados" — virou opt-in próprio).
export const DIAS_CANON = [
  "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo",
] as const;

// Mapa de SEMENTE: turno do Pipefy → faixa horária [início,fim] (h 0-24).
// Usos: (a) pré-marcar a janela do calendário na 1ª vez; (b) match com fonte=semente
// (decisão Hugo 04/07/2026): o turno marcado é a janela onde a diária pode COMEÇAR.
export const TURNO_RANGE: Record<string, [number, number]> = {
  "Manhã": [6, 12],
  "Tarde": [12, 18],
  "Noite": [18, 24],
  "Madrugada": [0, 6],
};

// slugs lidos da semente (banco Pipefy) — espelham ESTADO-BANCO §8 / talent.ts.
const SB = {
  nome: "nome",
  cpf: "cpf",
  turnos: "turnos_disponiveis",
  dias: "dias_disponiveis",
  valSegSex: "valor_diaria_seg_sex_r",
  valFds: "valor_diaria_sab_dom_feriado_r",
  // janela EXATA declarada no form de inscrição (03/07/2026) — preferida sobre os
  // turnos quadrados antigos; o form agora pergunta "das X às Y" igual a esta tela.
  horaIni: "hora_inicio_disponivel",
  horaFim: "hora_fim_disponivel",
} as const;

export type DisponibilidadeView = {
  card: string;
  nome: string | null; // primeiro nome — saudação calorosa (dado do próprio titular)
  dias: string[]; // dias da semana (sem feriado)
  horaInicio: string | null; // "HH:MM"
  horaFim: string | null; // "HH:MM" (se <= início, vira a noite)
  feriados: boolean; // topa ser chamado em feriados também
  valorSegSex: number | null;
  valorFds: number | null;
  atualizadoEm: string | null; // ISO; null = nunca salvou (veio só da semente)
  esmaecido: boolean; // computado: >45d sem renovar
  fonte: "neon" | "semente"; // semente = 1ª vez (carregou do Pipefy)
};

export type SalvarInput = {
  dias: string[];
  horaInicio: string | null;
  horaFim: string | null;
  feriados: boolean;
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

function filtraDias(arr: string[]): string[] {
  const set = new Set<string>(DIAS_CANON);
  return Array.from(new Set(arr)).filter((x) => set.has(x));
}

// normaliza "HH:MM" (0-23:0-59); devolve null se inválido/ausente.
function asHora(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function fmtHora(h24: number): string {
  if (h24 >= 24) return "23:59"; // fim "meia-noite/24h" → aproxima sem estourar
  return `${String(h24).padStart(2, "0")}:00`;
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
  dias: string[]; // só dias da semana
  feriados: boolean; // "Feriados" estava na lista antiga de dias?
  horaInicio: string | null; // derivada dos turnos antigos
  horaFim: string | null;
  valorSegSex: number | null;
  valorFds: number | null;
};

// turnos antigos → janela aproximada [min início, max fim]
function janelaDosTurnos(turnos: string[]): { ini: string | null; fim: string | null } {
  const ranges = turnos.map((t) => TURNO_RANGE[t]).filter(Boolean) as [number, number][];
  if (!ranges.length) return { ini: null, fim: null };
  const min = Math.min(...ranges.map((r) => r[0]));
  const max = Math.max(...ranges.map((r) => r[1]));
  // cobre o dia inteiro (madrugada + noite) → 00:00–23:59
  if (min <= 0 && max >= 24) return { ini: "00:00", fim: "23:59" };
  return { ini: fmtHora(min), fim: fmtHora(max) };
}

async function lerSemente(card: string): Promise<Semente | null> {
  try {
    const d = await pipefyQuery<{ table_record: RawRecord | null }>(
      `query($id:ID!){ table_record(id:$id){ id record_fields{ field{id} value array_value } } }`,
      { id: card },
    );
    const rec = d.table_record;
    if (!rec) return null;
    const diasRaw = asArray(rawVal(rec, SB.dias));
    const turnosRaw = asArray(rawVal(rec, SB.turnos));
    // Semente da janela: 1º a janela EXATA do form novo (hora_inicio/fim_disponivel);
    // fallback = turnos quadrados antigos convertidos (registros pré-03/07/2026).
    const hIni = asHora(rawVal(rec, SB.horaIni) as string | null);
    const hFim = asHora(rawVal(rec, SB.horaFim) as string | null);
    const j = hIni && hFim ? { ini: hIni, fim: hFim } : janelaDosTurnos(turnosRaw);
    return {
      nome: (rawVal(rec, SB.nome) as string | null) ?? null,
      cpf: (rawVal(rec, SB.cpf) as string | null) ?? null,
      dias: filtraDias(diasRaw),
      feriados: diasRaw.includes("Feriados"),
      horaInicio: j.ini,
      horaFim: j.fim,
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
  hora_inicio: string | null;
  hora_fim: string | null;
  feriados: boolean | null;
  valor_seg_sex: string | number | null;
  valor_fds: string | number | null;
  atualizado_em: string | null;
};

async function lerRow(card: string): Promise<DispRow | null> {
  if (!sql) return null;
  await ensureTurnosSchema();
  const rows = (await sql`
    select card, cpf, dias, hora_inicio, hora_fim, feriados, valor_seg_sex, valor_fds,
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
      dias: filtraDias(row.dias ?? []),
      horaInicio: asHora(row.hora_inicio),
      horaFim: asHora(row.hora_fim),
      feriados: !!row.feriados,
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
    horaInicio: semente?.horaInicio ?? null,
    horaFim: semente?.horaFim ?? null,
    feriados: semente?.feriados ?? false,
    valorSegSex: semente?.valorSegSex ?? null,
    valorFds: semente?.valorFds ?? null,
    atualizadoEm: null,
    esmaecido: false, // semente recém-carregada conta como fresca até ele salvar
    fonte: "semente",
  };
}

/**
 * Salva (upsert por card) a disponibilidade viva no Neon, carimba atualizado_em
 * e reseta esmaecido=false (renovou ⇒ volta ao pool). Filtra dias ao canônico e
 * valida as horas. Preserva o cpf já semeado (coalesce). Devolve a view atualizada.
 */
export async function salvarDisponibilidade(
  card: string,
  input: SalvarInput,
): Promise<DisponibilidadeView> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();

  const dias = filtraDias(input.dias ?? []);
  const ini = asHora(input.horaInicio);
  const fim = asHora(input.horaFim);
  const feriados = !!input.feriados;
  const vss = Number.isFinite(input.valorSegSex as number) ? input.valorSegSex : null;
  const vfds = Number.isFinite(input.valorFds as number) ? input.valorFds : null;

  // garante cpf no registro mesmo quando a linha nasce no save (lê da semente).
  const semente = await lerSemente(card);
  const cpf = semente?.cpf ?? null;

  await sql`
    insert into disponibilidade
      (card, cpf, dias, turnos, hora_inicio, hora_fim, feriados, valor_seg_sex, valor_fds, esmaecido, atualizado_em)
    values
      (${card}, ${cpf}, ${dias}::text[], '{}'::text[], ${ini}, ${fim}, ${feriados}, ${vss}, ${vfds}, false, now())
    on conflict (card) do update set
      cpf           = coalesce(excluded.cpf, disponibilidade.cpf),
      dias          = excluded.dias,
      hora_inicio   = excluded.hora_inicio,
      hora_fim      = excluded.hora_fim,
      feriados      = excluded.feriados,
      valor_seg_sex = excluded.valor_seg_sex,
      valor_fds     = excluded.valor_fds,
      esmaecido     = false,
      atualizado_em = now()
  `;

  // WRITE-BACK (decisão Hugo 04/07/2026): espelha a declaração no banco Pipefy —
  // mantém a semente sincronizada, renova o frescor (data_da_declaracao_de_prefs) e
  // destrava o gate de EXIBÍVEL (turnos OU janela declarada) pros resgatados do
  // incidente do form. Falha aqui NÃO derruba o save: o Neon é o dono vivo; o
  // Pipefy é espelho — a próxima gravação re-sincroniza.
  try {
    const diasBanco = feriados && !dias.includes("Feriados") ? [...dias, "Feriados"] : dias;
    const valores = [
      { fieldId: SB.dias, value: diasBanco },
      { fieldId: "data_da_declaracao_de_prefs", value: new Date().toISOString().slice(0, 10) },
      ...(ini ? [{ fieldId: SB.horaIni, value: ini }] : []),
      ...(fim ? [{ fieldId: SB.horaFim, value: fim }] : []),
    ];
    await pipefyQuery(
      `mutation($i:UpdateFieldsValuesInput!){ updateFieldsValues(input:$i){ clientMutationId } }`,
      { i: { nodeId: card, values: valores } },
    );
  } catch (e) {
    console.warn("[calendario] write-back Pipefy falhou (Neon segue como dono):", e);
  }

  return {
    card,
    nome: primeiroNome(semente?.nome ?? null),
    dias,
    horaInicio: ini,
    horaFim: fim,
    feriados,
    valorSegSex: asMoney(vss),
    valorFds: asMoney(vfds),
    atualizadoEm: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    esmaecido: false,
    fonte: "neon",
  };
}
