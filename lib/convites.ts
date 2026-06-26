// EMISSÃO + DISPARO + VIEW CEGA + INTERESSE do convite (S4 · convite CEGO / Uber).
// Separado de pedidos.ts (que cuida do pedido+pool) — aqui mora o ciclo do convite.
//
// MODELO DE DOIS CONVITES (decisão Hugo, D-B 25/06):
//   1) PRÉ-CONVITE (S4): no momento da convocação o sistema emite o token de cada
//      apto (pool→enviado) e a Skill dispara a mensagem CEGA no WhatsApp. O diarista
//      clica "Tenho interesse" → enviado→interesse. É uma SONDAGEM de disponibilidade
//      real (mata no-show cedo). O convite NÃO revela empresa/endereço.
//   2) CONVITE FINAL (S5): a empresa escolhe entre os interessados → revela tudo.
//
// GUARD-RAILS INEGOCIÁVEIS (PLANO-DE-VOO §6):
//   - O token carrega APENAS o `conviteId` (auth.ts). Nada de PII na URL.
//   - `conviteView` NUNCA devolve empresa/endereco (projeção cega abaixo é pura/testável).
//   - O telefone (Bloco 2) só sai por `lerConvidadosParaDisparo` (server-only, atrás da
//     torneira com segredo). NUNCA na rota pública /t/convite nem na querystring.
//   - score_a7pro/rating do banco Pipefy NUNCA são tocados aqui.
import crypto from "crypto";
import { sql, ensureTurnosSchema } from "./db-turnos";
import { makeConviteToken, verifyConviteToken } from "./auth";
import { fimDaDiaria, diaSemanaDe } from "./match";
import { pipefyQuery, rawVal, type RawRecord } from "./pipefy";
import { siteUrl } from "./site";

// ---- LINK CURTO: slug aleatório (chave pública amigável do convite). Alfabeto sem
// caracteres ambíguos (0/O, 1/I/l). 55^7 ≈ 1,5 trilhão → colisão desprezível no volume.
const SLUG_ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function gerarSlug(n = 7): string {
  const b = crypto.randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += SLUG_ALFA[b[i] % SLUG_ALFA.length];
  return s;
}

/**
 * Resolve a referência do convite (o que vem na URL) → conviteId.
 * Aceita o TOKEN longo (HMAC, purpose:"convite") OU o SLUG curto (lookup no Neon).
 * Mantém os dois caminhos válidos: o link curto é o que mandamos; o token segue valendo.
 */
export async function resolveConviteId(ref: string | null | undefined): Promise<number | null> {
  if (!ref) return null;
  const p = verifyConviteToken(ref);
  if (p) return p.conviteId;
  // não é token assinado → tenta slug (só formato plausível, evita query à toa)
  if (!/^[A-Za-z0-9]{4,16}$/.test(ref)) return null;
  if (!sql) return null;
  await ensureTurnosSchema();
  const rows = (await sql`select id from convite where slug = ${ref} limit 1`) as Array<{ id: number }>;
  return rows.length ? Number(rows[0].id) : null;
}

// ============================ 1) EMITIR (pool → enviado) ============================
export type ConviteEmitido = { conviteId: number; card: string; token: string; slug: string };

/**
 * Emite os convites de um pedido: para cada `convite status='pool'` (sem token), cunha
 * token + slug curto e marca status='enviado' (carimba enviado_em). Idempotente: quem já
 * saiu de 'pool' não é reemitido. Devolve só os recém-emitidos.
 */
export async function emitirConvites(pedidoId: number): Promise<ConviteEmitido[]> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();
  const pend = (await sql`
    select id, card from convite
    where pedido_id = ${pedidoId} and status = 'pool' and token is null
    order by id asc
  `) as Array<{ id: number; card: string }>;

  const out: ConviteEmitido[] = [];
  for (const c of pend) {
    const conviteId = Number(c.id);
    const token = makeConviteToken(conviteId);
    const slug = gerarSlug();
    // anti-corrida: só vira 'enviado' se ainda estava 'pool'
    await sql`
      update convite set token = ${token}, slug = ${slug}, status = 'enviado', enviado_em = now()
      where id = ${conviteId} and status = 'pool'
    `;
    out.push({ conviteId, card: c.card, token, slug });
  }
  return out;
}

// ===================== 2) DISPARO (server-only, atrás de segredo) =====================
// Lista que a Skill consome pra mandar no WhatsApp: telefone + nome + link pronto.
// O telefone vem do banco Pipefy (Bloco 2) — lido AQUI, no servidor, nunca exposto ao
// cliente. A torneira /api/t/convite/emitir é guardada por segredo (igual calendario/link).
export type Convidado = {
  conviteId: number;
  card: string;
  primeiroNome: string;
  telefone: string | null;
  link: string;
  status: string;
};

const RECORD_QUERY = `query($id:ID!){
  table_record(id:$id){ id record_fields{ field{id} value array_value } }
}`;

function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return p.length ? p[0] : "tudo bem";
}

/** Lê telefone + nome de UM card no banco Pipefy (server-only). Slug telefone = `telefone`. */
async function lerContatoDoCard(card: string): Promise<{ telefone: string | null; nome: string }> {
  try {
    const d: any = await pipefyQuery(RECORD_QUERY, { id: card });
    const node = d?.table_record as RawRecord | undefined;
    if (!node) return { telefone: null, nome: "" };
    const tel = rawVal(node, "telefone");
    const nome = rawVal(node, "nome");
    const telStr = typeof tel === "string" ? tel : Array.isArray(tel) ? (tel[0] ?? null) : null;
    const nomeStr = typeof nome === "string" ? nome : Array.isArray(nome) ? (nome[0] ?? "") : "";
    return { telefone: telStr, nome: nomeStr };
  } catch {
    return { telefone: null, nome: "" };
  }
}

/**
 * Junta os convites já emitidos (token != null) de um pedido com telefone + nome do
 * banco Pipefy + monta o link público. É o que a Skill dispara. Inclui 'enviado' e
 * 'interesse' (idempotente: reler não reemite; a Skill decide quem ainda não recebeu).
 */
export async function lerConvidadosParaDisparo(pedidoId: number): Promise<Convidado[]> {
  if (!sql) throw new Error("Banco (Neon) indisponível.");
  await ensureTurnosSchema();
  const rows = (await sql`
    select id, card, token, slug, status from convite
    where pedido_id = ${pedidoId} and token is not null and status in ('enviado','interesse')
    order by id asc
  `) as Array<{ id: number; card: string; token: string; slug: string | null; status: string }>;
  const base = siteUrl.replace(/\/$/, "");
  const out: Convidado[] = [];
  for (const r of rows) {
    const { telefone, nome } = await lerContatoDoCard(r.card);
    // link CURTO amigável (/c/<slug>); cai pro token longo só se faltar slug (legado).
    const link = r.slug ? `${base}/c/${r.slug}` : `${base}/t/convite/${r.token}`;
    out.push({
      conviteId: Number(r.id),
      card: r.card,
      primeiroNome: primeiroNome(nome),
      telefone,
      link,
      status: r.status,
    });
  }
  return out;
}

// ===================== 3) VIEW CEGA (rota pública por token) =====================
// O QUE A PESSOA VÊ. Projeção CEGA, pura e testável: recebe os campos do pedido +
// status do convite e devolve SÓ o permitido. NUNCA inclui empresa/endereco — eles
// nem entram na função. O teste do checkpoint inspeciona Object.keys disto.
export type PedidoCego = {
  bairro: string | null;
  funcao: string | null;
  valor: number | null;
  data: string | null; // YYYY-MM-DD
  hora: string | null; // HH:MM (início)
  status: string; // status do PEDIDO (aberto/fechado/cancelado)
  janela_ate: string | null; // ISO
};

export type ConviteCego = {
  ok: true;
  bairro: string | null;
  funcao: string | null;
  valor: number | null;
  data: string | null;
  dataFmt: string; // DD/MM
  diaSemana: string; // "Sexta"
  horaInicio: string | null;
  horaFim: string | null; // início + 9h
  primeiroNome: string; // saudação (nome do próprio dono do link)
  status: string; // status do CONVITE (enviado/interesse/selecionado/...)
  encerrado: boolean; // pedido fechado/cancelado OU janela passou
};

function dataFmtBR(d: string | null): string {
  if (!d) return "—";
  const [, mo, da] = d.split("-").map(Number);
  return `${String(da).padStart(2, "0")}/${String(mo).padStart(2, "0")}`;
}

/** PROJEÇÃO CEGA — pura. Monta o payload do trabalhador a partir do pedido + convite.
 *  Por construção, só carrega as chaves cegas (sem empresa/endereco). */
export function projetarCego(
  p: PedidoCego,
  conviteStatus: string,
  primeiro: string,
): ConviteCego {
  const encerrado =
    p.status !== "aberto" ||
    (!!p.janela_ate && new Date(p.janela_ate).getTime() < Date.now());
  return {
    ok: true,
    bairro: p.bairro ?? null,
    funcao: p.funcao ?? null,
    valor: p.valor ?? null,
    data: p.data ?? null,
    dataFmt: dataFmtBR(p.data),
    diaSemana: p.data ? diaSemanaDe(p.data) : "—",
    horaInicio: p.hora ?? null,
    horaFim: p.hora ? fimDaDiaria(p.hora) : null,
    primeiroNome: primeiro,
    status: conviteStatus,
    encerrado,
  };
}

export type ConviteViewResult = ConviteCego | { ok: false; erro: string };

/** Resolve a ref (token OU slug) → lê convite + pedido (SÓ campos cegos) → projeta. */
export async function conviteView(ref: string | null): Promise<ConviteViewResult> {
  const conviteId = await resolveConviteId(ref);
  if (!conviteId) return { ok: false, erro: "link inválido ou expirado" };
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  // Lê só os campos CEGOS do pedido (empresa/endereco NEM são selecionados).
  const rows = (await sql`
    select c.card,
           c.status as cstatus,
           p.bairro, p.funcao, p.valor,
           to_char(p.data, 'YYYY-MM-DD') as data,
           p.hora, p.status as pstatus,
           to_char(p.janela_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as janela_ate
    from convite c join pedido p on p.id = c.pedido_id
    where c.id = ${conviteId} limit 1
  `) as Array<any>;
  if (!rows.length) return { ok: false, erro: "convite não encontrado" };
  const r = rows[0];
  const { nome } = await lerContatoDoCard(r.card);
  const ped: PedidoCego = {
    bairro: r.bairro ?? null,
    funcao: r.funcao ?? null,
    valor: r.valor == null ? null : Number(r.valor),
    data: r.data ?? null,
    hora: r.hora ?? null,
    status: r.pstatus,
    janela_ate: r.janela_ate ?? null,
  };
  return projetarCego(ped, r.cstatus, primeiroNome(nome));
}

// ===================== 4) REGISTRAR INTERESSE (enviado → interesse) =====================
export type InteresseResult =
  | { ok: true; status: string }
  | { ok: false; erro: string };

/**
 * "Tenho interesse": valida token + janela → enviado→interesse (idempotente).
 * Rejeita se expirado/encerrado. Se já passou de 'interesse' (selecionado/confirmado),
 * devolve o status atual sem rebaixar.
 */
export async function registrarInteresse(ref: string | null): Promise<InteresseResult> {
  const conviteId = await resolveConviteId(ref);
  if (!conviteId) return { ok: false, erro: "link inválido ou expirado" };
  if (!sql) return { ok: false, erro: "indisponível" };
  await ensureTurnosSchema();
  const rows = (await sql`
    select c.status as cstatus, p.status as pstatus,
           to_char(p.janela_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as janela_ate
    from convite c join pedido p on p.id = c.pedido_id
    where c.id = ${conviteId} limit 1
  `) as Array<any>;
  if (!rows.length) return { ok: false, erro: "convite não encontrado" };
  const r = rows[0];
  if (r.pstatus !== "aberto") return { ok: false, erro: "encerrado" };
  if (r.janela_ate && new Date(r.janela_ate).getTime() < Date.now())
    return { ok: false, erro: "encerrado" };
  // já avançou no funil (S5) → não rebaixa, devolve o estado atual.
  if (r.cstatus === "selecionado" || r.cstatus === "confirmado")
    return { ok: true, status: r.cstatus };
  // idempotente: enviado→interesse; interesse→interesse (preserva o 1º respondido_em).
  await sql`
    update convite set status = 'interesse', respondido_em = coalesce(respondido_em, now())
    where id = ${conviteId} and status in ('enviado','interesse')
  `;
  return { ok: true, status: "interesse" };
}
