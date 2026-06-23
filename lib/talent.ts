// Camada de talentos do Portal da Empresa.
// Lê o Banco A7Pro (Pipefy), filtra para EXIBÍVEL (regra de compliance do Anexo) e
// devolve um DTO seguro com SÓ os campos do Bloco 1. Os campos do Bloco 2 (CPF,
// telefone, score, fórmula, etc.) são cortados AQUI, no servidor, e nunca trafegam
// para o cliente. Toda página do portal consome este módulo, nunca o pipefy cru.
import { unstable_cache } from "next/cache";
import { BANCO_TID, pipefyQuery, rawVal, type RawRecord } from "./pipefy";

// ---- slugs do banco (ESTADO-BANCO-A7PRO.md, seção 8) ----
const S = {
  nome: "nome",
  rating: "rating",
  turnos: "turnos_disponiveis",
  dias: "dias_disponiveis",
  valSegSex: "valor_diaria_seg_sex_r",
  valFds: "valor_diaria_sab_dom_feriado_r",
  dataPrefs: "data_da_declaracao_de_prefs",
  consentimento: "status_do_consentimento",
  funcao: "funcao", // ainda não existe no banco — lido como opcional (ver nota abaixo)
} as const;

// Selos exibíveis (classificação positiva). B/C/NOVATA nunca aparecem.
const SELOS_EXIBIVEIS = new Set(["A", "AA", "AAA"]);
// Valor interno do banco: função ainda não classificada. NUNCA vira filtro na vitrine
// nem aparece pra empresa — o card carrega como se a função fosse null até o Hugo conferir.
const FUNCAO_A_CONFERIR = "A CONFERIR";
// Frescor (CX 4): começa folgado e aperta com dado real. Calibrável.
export const FRESHNESS_DAYS = 45;

// DTO SEGURO — exatamente o Bloco 1 do Anexo. Nada além disto sai do servidor.
export type TalentCard = {
  id: string; // id opaco do registro (não é PII)
  nomeParcial: string; // "João S."
  funcao: string | null; // classificada por nós; null enquanto não populada
  selo: "A" | "AA" | "AAA";
  dias: string[];
  turnos: string[];
  valorSegSex: number | null;
  valorFds: number | null;
  trabalhosConcluidos: number; // 0 no MVP → "Primeira oportunidade via A7Pro"
  atualizadoEm: string | null; // ISO date (carimbo dos campos 3–6)
};

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

function asMoney(v: string | string[] | null): number | null {
  if (!v || Array.isArray(v)) return null;
  // normaliza "120,00" / "R$ 120.00" / "120" → number
  const cleaned = v.replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function nomeParcial(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Profissional";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

// Datas do banco vêm em DD/MM/YYYY. Converte para ISO (YYYY-MM-DD).
function parseISO(s: string | null): string | null {
  if (!s) return null;
  const t = s.trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return null;
}
function diasDesde(s: string | null): number {
  const iso = parseISO(s);
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}
// Dias vêm por extenso no banco ("Segunda"…"Domingo"); a UI usa abreviado.
const DIA_MAP: Record<string, string> = {
  Domingo: "Dom", Segunda: "Seg", "Terça": "Ter", Quarta: "Qua",
  Quinta: "Qui", Sexta: "Sex", "Sábado": "Sáb",
};
function normDias(arr: string[]): string[] {
  return arr.map((d) => DIA_MAP[d] ?? d);
}

/** Regra de EXIBÍVEL — o filtro de compliance que NUNCA relaxa (mesmo no cold-start). */
function exibivel(node: RawRecord): boolean {
  const selo = (rawVal(node, S.rating) as string | null)?.trim();
  if (!selo || !SELOS_EXIBIVEIS.has(selo)) return false;

  const consent = (rawVal(node, S.consentimento) as string | null)?.trim();
  if (consent && consent !== "Ativo") return false; // revogado sai de tudo

  const dias = asArray(rawVal(node, S.dias));
  const turnos = asArray(rawVal(node, S.turnos));
  if (!dias.length || !turnos.length) return false; // sem disponibilidade declarada

  const data = rawVal(node, S.dataPrefs) as string | null;
  if (!data || diasDesde(data) > FRESHNESS_DAYS) return false; // frescor (CX 4)

  return true;
}

function toCard(node: RawRecord): TalentCard {
  const selo = (rawVal(node, S.rating) as string).trim() as TalentCard["selo"];
  const nome = (rawVal(node, S.nome) as string | null) ?? "";
  const funcaoRaw = (rawVal(node, S.funcao) as string | null)?.trim() || null;
  // 'A CONFERIR' é interno: trata como não-classificada (null) — não exibe nem filtra.
  const funcao = funcaoRaw && funcaoRaw !== FUNCAO_A_CONFERIR ? funcaoRaw : null;
  return {
    id: node.id,
    nomeParcial: nomeParcial(nome),
    funcao,
    selo,
    dias: normDias(asArray(rawVal(node, S.dias))),
    turnos: asArray(rawVal(node, S.turnos)),
    valorSegSex: asMoney(rawVal(node, S.valSegSex)),
    valorFds: asMoney(rawVal(node, S.valFds)),
    trabalhosConcluidos: 0, // Fase 2: virá do motor de reputação
    atualizadoEm: parseISO(rawVal(node, S.dataPrefs) as string | null),
  };
}

const PAGE_QUERY = `query($id:ID!,$after:String){
  table(id:$id){ table_records(first:50, after:$after){
    pageInfo{ hasNextPage endCursor }
    edges{ node{ id record_fields{ field{id} value array_value } } }
  } }
}`;

async function fetchAllRecords(): Promise<RawRecord[]> {
  const out: RawRecord[] = [];
  let after: string | null = null;
  // guarda de segurança contra loop (até 2000 registros no MVP)
  for (let i = 0; i < 40; i++) {
    const d: any = await pipefyQuery(PAGE_QUERY, { id: BANCO_TID, after });
    const tr = d.table.table_records;
    for (const e of tr.edges) out.push(e.node as RawRecord);
    if (tr.pageInfo.hasNextPage) after = tr.pageInfo.endCursor;
    else break;
  }
  return out;
}

/**
 * Lista de talentos EXIBÍVEIS (DTO seguro). Cacheado por 120s para não estourar o
 * Pipefy e dar resposta rápida. A busca/filtro do portal opera sobre este array.
 */
export const getTalentCards = unstable_cache(
  async (): Promise<TalentCard[]> => {
    const records = await fetchAllRecords();
    return records.filter(exibivel).map(toCard);
  },
  ["talent-cards-v1"],
  { revalidate: 120, tags: ["talent"] },
);

/** Contagens agregadas (sem identidade) para o preview cego do não-assinante. */
export async function getAggregateCounts() {
  const cards = await getTalentCards();
  const porSelo = { AAA: 0, AA: 0, A: 0 } as Record<string, number>;
  for (const c of cards) porSelo[c.selo] = (porSelo[c.selo] ?? 0) + 1;
  return { total: cards.length, porSelo };
}
