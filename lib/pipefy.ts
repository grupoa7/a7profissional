// Cliente server-side da API pública do Pipefy.
// NUNCA importar isto em componente client: usa PIPEFY_TOKEN (segredo) e lê dados crus
// que contêm campos do Bloco 2 do Anexo. O corte para o DTO seguro é feito em talent.ts.

export const PIPEFY_API = "https://api.pipefy.com/graphql";
export const BANCO_TID = "ZxbYr_AS"; // Database "A7Pro — Banco de Talentos" (307199283)

type GqlResult<T> = { data?: T; errors?: unknown };

/**
 * Chamada à API do Pipefy com retry exponencial em falha transitória
 * (rede/timeout/429/5xx). Erro de validação do GraphQL não repete.
 * Espelha o contrato provado em ingestao_banco_a7pro.py (gql()).
 */
export async function pipefyQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  tries = 4,
): Promise<T> {
  const token = process.env.PIPEFY_TOKEN;
  if (!token) {
    throw new Error(
      "PIPEFY_TOKEN ausente. Configure nas variáveis de ambiente (Vercel).",
    );
  }
  let last: unknown = null;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const r = await fetch(PIPEFY_API, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        // o cache de leitura fica na camada de cima (unstable_cache em talent.ts)
        cache: "no-store",
      });
      if ([429, 500, 502, 503, 504].includes(r.status) && attempt < tries) {
        await sleep(Math.min(2 ** attempt, 8) * 1000);
        continue;
      }
      const d = (await r.json()) as GqlResult<T>;
      if (d.errors) {
        throw new Error(JSON.stringify(d.errors).slice(0, 400));
      }
      if (!d.data) throw new Error("Resposta sem data do Pipefy.");
      return d.data;
    } catch (e) {
      last = e;
      if (attempt < tries) {
        await sleep(Math.min(2 ** attempt, 8) * 1000);
        continue;
      }
    }
  }
  throw last instanceof Error ? last : new Error("Falha na API do Pipefy.");
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ---- tipos crus do Pipefy (uso interno, server-only) ----
export type RawField = {
  field: { id: string } | null;
  value: string | null;
  array_value: string[] | null;
};
export type RawRecord = { id: string; record_fields: RawField[] };

/** Lê um campo do registro por slug (id). Espelha fval(): array_value tem prioridade. */
export function rawVal(node: RawRecord, slug: string): string | string[] | null {
  const f = node.record_fields.find((x) => x.field?.id === slug);
  if (!f) return null;
  if (f.array_value && f.array_value.length) return f.array_value;
  return f.value;
}
