// Projeção de reputação → banco Pipefy (A7Pro — Banco de Talentos, ZxbYr_AS).
// Importado tanto pela rota de produção (/api/reputacao/projetar) quanto pela rota
// de prova da S1. Mantém a escrita no Pipefy num lugar só (server-only: usa PIPEFY_TOKEN).
//
// GUARD-RAIL INEGOCIÁVEL: aqui só se escrevem os 4 campos NOVOS de reputação.
// `score_a7pro`, `rating`, `cpf`, `nome` e qualquer campo de identidade/entrada
// NUNCA entram no payload de escrita. A leitura desses é só pra PROVAR que ficaram intactos.
import { BANCO_TID, pipefyQuery } from "./pipefy";
import {
  ensureTurnosSchema,
  lerLivroRazao,
  projetarReputacao,
  VERSAO_FORMULA_REP,
  type ReputacaoCard,
} from "./db-turnos";

// ---- slugs CANÔNICOS dos 4 campos de reputação no banco (criados 14/06, ver ESTADO-TURNOS §6).
// São os ÚNICOS campos que a projeção escreve.
export const REP_FIELDS = {
  reputacao: "reputacao_turnos",
  nTurnos: "n_turnos",
  ultima: "data_ultima_avaliacao",
  versao: "versao_da_formula_reputacao",
} as const;

// labels canônicos (com acento) — usados SÓ se um campo estiver faltando e precisar ser criado.
const REP_FIELD_SPEC: Array<{ slug: string; label: string; type: string }> = [
  { slug: REP_FIELDS.reputacao, label: "Reputação turnos", type: "number" },
  { slug: REP_FIELDS.nTurnos, label: "Nº de turnos", type: "number" },
  { slug: REP_FIELDS.ultima, label: "Data última avaliação", type: "date" },
  { slug: REP_FIELDS.versao, label: "Versão da fórmula reputação", type: "short_text" },
];

// campos que JAMAIS são escritos — listados aqui só pra documentar a fronteira e pra leitura de prova.
export const CAMPOS_INTOCAVEIS = ["score_a7pro", "rating", "versao_da_formula", "cpf", "nome"] as const;

// ----------------------------------------------------------------------------
// 1) GARANTIR os 4 campos no banco (idempotente — resolve o conflito de existência).
//    Lê os campos atuais do Database; cria SÓ o que faltar; confirma os slugs reais.
// ----------------------------------------------------------------------------
type TableField = { id: string; label: string; type: string };

export async function listarCamposBanco(): Promise<TableField[]> {
  const d = await pipefyQuery<{ table: { table_fields: TableField[] } }>(
    `query($id:ID!){ table(id:$id){ table_fields{ id label type } } }`,
    { id: BANCO_TID },
  );
  return d.table.table_fields;
}

export async function garantirCamposReputacao() {
  const existentes = await listarCamposBanco();
  const porSlug = new Map(existentes.map((f) => [f.id, f]));
  const relatorio: Array<{ slug: string; status: "existe" | "criado" | "ERRO"; detalhe?: string }> = [];

  for (const spec of REP_FIELD_SPEC) {
    if (porSlug.has(spec.slug)) {
      relatorio.push({ slug: spec.slug, status: "existe" });
      continue;
    }
    // Faltando de verdade → cria. Captura o slug REAL devolvido (defesa contra slugify).
    try {
      const d = await pipefyQuery<{ createTableField: { table_field: TableField } }>(
        `mutation($input: CreateTableFieldInput!){
           createTableField(input:$input){ table_field{ id label type } }
         }`,
        { input: { table_id: BANCO_TID, type: spec.type, label: spec.label } },
      );
      const novo = d.createTableField.table_field;
      relatorio.push({
        slug: novo.id,
        status: "criado",
        detalhe: novo.id === spec.slug ? undefined : `slug real "${novo.id}" ≠ canônico "${spec.slug}" — AJUSTAR`,
      });
    } catch (e) {
      relatorio.push({ slug: spec.slug, status: "ERRO", detalhe: String(e).slice(0, 200) });
    }
  }
  return relatorio;
}

// ----------------------------------------------------------------------------
// 2) ESCREVER reputação no banco — updateFieldsValues por nodeId (= card/table_record).
//    Mesmo contrato provado em ingestao_banco_a7pro.py. Só os 4 slugs de reputação.
// ----------------------------------------------------------------------------
export async function escreverReputacaoNoBanco(cards: ReputacaoCard[]) {
  const out: Array<ReputacaoCard & { ok: boolean; erro?: string }> = [];
  for (const c of cards) {
    const values = [
      { fieldId: REP_FIELDS.reputacao, value: c.reputacao_turnos },
      { fieldId: REP_FIELDS.nTurnos, value: c.n_turnos },
      { fieldId: REP_FIELDS.ultima, value: c.data_ultima_avaliacao },
      { fieldId: REP_FIELDS.versao, value: VERSAO_FORMULA_REP },
    ];
    try {
      await pipefyQuery(
        `mutation($input: UpdateFieldsValuesInput!){ updateFieldsValues(input:$input){ clientMutationId } }`,
        { input: { nodeId: c.card, values } },
      );
      out.push({ ...c, ok: true });
    } catch (e) {
      out.push({ ...c, ok: false, erro: String(e).slice(0, 200) });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// 3) ORQUESTRADOR — lê livro-razão (Neon), projeta (REPUT v1.0), grava (Pipefy).
//    Idempotente: rerodar = mesmo resultado (a média do mesmo livro-razão não muda).
//    Usado pela rota de produção E pela prova.
// ----------------------------------------------------------------------------
export async function projetarEEscrever() {
  await ensureTurnosSchema();
  const livro = await lerLivroRazao();
  const projecao = projetarReputacao(livro);
  const escrita = await escreverReputacaoNoBanco(projecao);
  return {
    versao: VERSAO_FORMULA_REP,
    linhas_livro: livro.length,
    cards_projetados: projecao.length,
    escrita,
  };
}

// ----------------------------------------------------------------------------
// 4) LEITURA DE PROVA — lê de um card os 4 campos de reputação + os intocáveis
//    (score_a7pro/rating) pra mostrar que a projeção não tocou na entrada.
// ----------------------------------------------------------------------------
export async function lerCardParaProva(cardId: string) {
  const d = await pipefyQuery<{
    table_record: { id: string; title: string; record_fields: Array<{ field: { id: string }; value: string | null; array_value: string[] | null }> };
  }>(
    `query($id:ID!){ table_record(id:$id){ id title record_fields{ field{id} value array_value } } }`,
    { id: cardId },
  );
  const rec = d.table_record;
  const val = (slug: string) => {
    const f = rec.record_fields.find((x) => x.field?.id === slug);
    if (!f) return null;
    return f.array_value && f.array_value.length ? f.array_value : f.value;
  };
  return {
    id: rec.id,
    title: rec.title,
    reputacao: {
      reputacao_turnos: val(REP_FIELDS.reputacao),
      n_turnos: val(REP_FIELDS.nTurnos),
      data_ultima_avaliacao: val(REP_FIELDS.ultima),
      versao_da_formula_reputacao: val(REP_FIELDS.versao),
    },
    intocaveis: {
      score_a7pro: val("score_a7pro"),
      rating: val("rating"),
      versao_da_formula: val("versao_da_formula"),
    },
  };
}

/** Limpa os 4 campos de reputação de um card (volta ao estado pré-prova). */
export async function limparReputacaoDoCard(cardId: string) {
  const values = [
    { fieldId: REP_FIELDS.reputacao, value: null },
    { fieldId: REP_FIELDS.nTurnos, value: null },
    { fieldId: REP_FIELDS.ultima, value: null },
    { fieldId: REP_FIELDS.versao, value: null },
  ];
  await pipefyQuery(
    `mutation($input: UpdateFieldsValuesInput!){ updateFieldsValues(input:$input){ clientMutationId } }`,
    { input: { nodeId: cardId, values } },
  );
}
