// MOTOR DO POOL (S3 · mecânica Uber) — puro/testável.
// A empresa cria um PEDIDO de diária (função, data, início, valor, N vagas) e este
// motor monta o POOL de aptos: quem casa por função (exata + relacionadas), está
// disponível no dia, tem janela que cobre as 9h da diária a partir do início, aceita
// o valor ofertado, está exibível e NÃO esmaeceu.
//
// GUARD-RAIL INEGOCIÁVEL (PLANO-DE-VOO §6): a disponibilidade do match vem do NEON
// (lerDisponibilidade, com semente Pipefy) — NÃO do dado cru do Pipefy. O esmaecido
// (>45d) sai do pool. A regra de EXIBÍVEL (talent.ts) nunca relaxa.
//
// Decisões travadas com Hugo (25/06, AskUserQuestion S3):
//   - Horário: a empresa informa só o INÍCIO; a diária ocupa 9h (8h+1h) a partir dali.
//   - Valor: FILTRO — só entra quem aceita <= o valor ofertado (por dia útil/fds).
//   - Função: EXATA + RELACIONADAS (mapa de afinidade abaixo).
//   - Tamanho do pool: SEM teto (todos os aptos). O N só dimensiona a META MÍNIMA
//     da lista inicial = 2x N (a empresa quer ver pelo menos o dobro do que convoca).
import { getTalentCards } from "./talent";
import { lerDisponibilidade, TURNO_RANGE } from "./calendario";

// Diária = 9h (8h trabalho + 1h intervalo), regra de produto selada na S2.
export const DIARIA_MIN = 9 * 60;

// JS getDay() (0=Dom..6=Sáb) → dia canônico por extenso (como o calendário grava).
const DOW_EXT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
// Ranking de selo (mesmo da vitrine).
const RANK: Record<string, number> = { AAA: 5, AA: 4, A: 3, B: 2, NOVATA: 1 };

export type PedidoInput = {
  funcao: string; // função pedida (uma das taxonomias do banco)
  data: string; // "YYYY-MM-DD"
  inicio: string; // "HH:MM" — a diária ocupa 9h a partir daqui
  valor: number; // teto que a empresa paga (transporte incluso)
  vagas: number; // N (quantas pessoas)
};

export type Apto = {
  card: string;
  nomeParcial: string;
  funcao: string | null;
  selo: string;
  exato: boolean; // função idêntica (true) ou relacionada (false)
  valorAplicavel: number | null; // o que ELE pede no dia (seg-sex ou fds)
  atualizadoEm: string | null;
  porque: string[]; // transparência: por que entrou no pool
};

export type Descartado = { card: string; nomeParcial: string; motivo: string };

export type PoolResult = {
  pedido: PedidoInput & { fim: string; diaSemana: string; wknd: boolean };
  aptos: Apto[];
  total: number;
  metaMinima: number; // 2 * N
  atingiuMinimo: boolean;
  universoExibivel: number; // quantos cards exibíveis foram avaliados
  descartados: Descartado[]; // motivo do 1º filtro que reprovou (auditoria/checkpoint)
};

// ---- mapa de afinidade de FUNÇÃO (exata + relacionadas) --------------------
// Grupos curados cobrindo hospitalidade (Blue) + varejo (Gran). "Relacionada" =
// compartilha grupo com a função pedida. Conservador de propósito (não poluir o pool).
// Tokens normalizados (sem acento, minúsculo). Função fora de qualquer grupo só casa exata.
const GRUPOS: string[][] = [
  // salão / atendimento
  ["garcom", "garconete", "auxiliar de salao", "atendente", "atendente de salao", "recepcionista", "maitre", "hostess", "cumim", "comis"],
  // cozinha
  ["cozinheiro", "cozinheira", "auxiliar de cozinha", "ajudante de cozinha", "chapeiro", "pizzaiolo", "sushiman"],
  // bar
  ["bartender", "barman", "barista"],
  // limpeza / apoio
  ["auxiliar de limpeza", "auxiliar de servicos gerais", "servicos gerais", "copeiro", "steward", "faxineiro", "zelador"],
  // frente de loja / caixa
  ["operador de caixa", "caixa", "fiscal de caixa", "empacotador", "repositor", "auxiliar de loja", "balconista"],
  // perecíveis / padaria
  ["acougueiro", "auxiliar de acougue", "auxiliar de hortifruti", "hortifruti", "peixeiro", "padeiro", "confeiteiro", "atendente de padaria"],
];

function normFunc(s: string | null | undefined): string {
  if (!s) return "";
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Conjunto de funções (normalizadas) relacionadas à pedida — união dos grupos que a contêm. */
function relacionadasDe(funcao: string): Set<string> {
  const alvo = normFunc(funcao);
  const out = new Set<string>();
  for (const g of GRUPOS) {
    if (g.includes(alvo)) for (const f of g) out.add(f);
  }
  out.delete(alvo); // relacionada ≠ a própria
  return out;
}

// ---- horário: a diária (9h) cabe na janela do trabalhador? -----------------
function toMin(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function fimDaDiaria(inicio: string): string {
  const ini = toMin(inicio) ?? 0;
  const t = (ini + DIARIA_MIN) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * A janela [jIni,jFim] do trabalhador cobre o turno [tIni, tIni+9h]?
 * Trata virada de noite dos dois lados. Janela 00:00–23:59 (semente "dia todo") = 24h.
 */
export function janelaCobre(jIni: string | null, jFim: string | null, inicio: string): boolean {
  const a = toMin(jIni), bRaw = toMin(jFim), t0 = toMin(inicio);
  if (a == null || bRaw == null || t0 == null) return false;
  // semente "dia inteiro" (00:00–23:59) → disponível 24h, cobre qualquer turno.
  if (a === 0 && bRaw >= 1439) return true;
  const b = bRaw === 1439 ? 1440 : bRaw; // trata 23:59 como fim de dia exato
  const tFim = t0 + DIARIA_MIN;
  // gera as janelas absolutas possíveis na linha [0, 2880)
  const janelas: [number, number][] = [];
  if (b > a) {
    janelas.push([a, b]);
    janelas.push([a + 1440, b + 1440]); // turno que começa de dia mas casa no "amanhã"
  } else {
    janelas.push([a, b + 1440]); // janela cruza a meia-noite
  }
  return janelas.some(([x, y]) => t0 >= x && tFim <= y);
}

/**
 * SEMENTE (decisão Hugo 04/07/2026): quando o trabalhador ainda NÃO editou o
 * perfil-calendário (fonte="semente"), o turno marcado no form é interpretado como
 * a janela onde a diária pode COMEÇAR — não como cobertura das 9h. Trava: a diária
 * precisa terminar até 23:59, salvo se marcou "Madrugada" (opt-in de virar a noite).
 * Quem editou o calendário (fonte="neon") declarou janela real → cobertura (janelaCobre).
 */
export function sementeCobre(turnos: string[], inicio: string): boolean {
  const t0 = toMin(inicio);
  if (t0 == null || !turnos.length) return false;
  const podeComecar = turnos.some((t) => {
    const r = TURNO_RANGE[t];
    return !!r && t0 >= r[0] * 60 && t0 < r[1] * 60;
  });
  if (!podeComecar) return false;
  // fim ≤ 23:59 para quem não topa madrugada
  return turnos.includes("Madrugada") || t0 + DIARIA_MIN <= 1440;
}

export function diaSemanaDe(data: string): string {
  const [y, mo, da] = data.split("-").map(Number);
  return DOW_EXT[new Date(y, mo - 1, da).getDay()];
}

function diasDesde(iso: string | null): number {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// concorrência limitada (lerDisponibilidade bate no Pipefy 1x/card → não estourar).
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Monta o pool de aptos para um pedido. NÃO persiste nada — é puro (lê banco, decide).
 * A persistência (pedido + convites status='pool') é responsabilidade de lib/pedidos.ts.
 */
export async function montarPool(pedido: PedidoInput): Promise<PoolResult> {
  const cards = await getTalentCards(); // universo EXIBÍVEL (compliance/selo/frescor já aplicados)
  const dia = diaSemanaDe(pedido.data);
  const wknd = dia === "Sábado" || dia === "Domingo";
  const fim = fimDaDiaria(pedido.inicio);
  const relacionadas = relacionadasDe(pedido.funcao);
  const alvo = normFunc(pedido.funcao);

  // lê disponibilidade VIVA (Neon + semente Pipefy) de cada card exibível.
  const disps = await mapLimit(cards, 6, (c: { id: string }) => lerDisponibilidade(c.id));

  const aptos: Apto[] = [];
  const descartados: Descartado[] = [];

  for (let k = 0; k < cards.length; k++) {
    const c = cards[k];
    const d = disps[k];
    const fnNorm = normFunc(c.funcao);

    // 1) função: exata ou relacionada (sem função classificada = fora)
    const exato = !!c.funcao && fnNorm === alvo;
    const rel = !exato && !!c.funcao && relacionadas.has(fnNorm);
    if (!exato && !rel) {
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: c.funcao ? `função ${c.funcao} não casa` : "função não classificada" });
      continue;
    }

    // 2) esmaecido (>45d sem renovar) → fora do pool
    if (d.esmaecido) {
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: "esmaecido (>45d sem renovar)" });
      continue;
    }

    // 3) disponível no dia da semana do pedido
    if (!d.dias.includes(dia)) {
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: `não disponível ${dia}` });
      continue;
    }

    // 4) horário — regra por fonte (decisão Hugo 04/07/2026):
    //    semente COM turnos = turno marcado é janela de INÍCIO (fim ≤ 23:59 salvo Madrugada);
    //    semente SEM turnos (janela padrão/form 03/07) e neon = janela precisa COBRIR as 9h.
    const usaTurnos = d.fonte === "semente" && c.turnos.length > 0;
    const horarioOk = usaTurnos
      ? sementeCobre(c.turnos, pedido.inicio)
      : janelaCobre(d.horaInicio, d.horaFim, pedido.inicio);
    if (!horarioOk) {
      const j = usaTurnos
        ? `turnos ${c.turnos.join("/")}`
        : (d.horaInicio && d.horaFim ? `janela ${d.horaInicio}–${d.horaFim}` : "sem janela");
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: `${j} não permite ${pedido.inicio}–${fim} (9h)` });
      continue;
    }

    // 5) valor: aceita <= ofertado (por dia útil/fds). Sem valor declarado = fora (consistente com a vitrine).
    const rate = wknd ? d.valorFds : d.valorSegSex;
    if (rate == null) {
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: "valor não declarado" });
      continue;
    }
    if (rate > pedido.valor) {
      descartados.push({ card: c.id, nomeParcial: c.nomeParcial, motivo: `pede R$${rate} > R$${pedido.valor}` });
      continue;
    }

    const atualizadoEm = d.atualizadoEm ?? c.atualizadoEm;
    aptos.push({
      card: c.id,
      nomeParcial: c.nomeParcial,
      funcao: c.funcao,
      selo: c.selo,
      exato,
      valorAplicavel: rate,
      atualizadoEm,
      porque: [
        exato ? `função bate (${c.funcao})` : `função relacionada (${c.funcao})`,
        `disponível ${dia}`,
        usaTurnos
          ? `turnos ${c.turnos.join("/")} permitem começar às ${pedido.inicio}`
          : `janela ${d.horaInicio}–${d.horaFim} cobre ${pedido.inicio}–${fim}`,
        `aceita R$${rate} ≤ R$${pedido.valor}`,
        `selo ${c.selo}`,
      ],
    });
  }

  // ranking: exato antes de relacionado → selo desc → mais recente primeiro
  aptos.sort(
    (a, b) =>
      Number(b.exato) - Number(a.exato) ||
      (RANK[b.selo] ?? 0) - (RANK[a.selo] ?? 0) ||
      diasDesde(a.atualizadoEm) - diasDesde(b.atualizadoEm),
  );

  const metaMinima = 2 * Math.max(1, pedido.vagas);
  return {
    pedido: { ...pedido, fim, diaSemana: dia, wknd },
    aptos,
    total: aptos.length,
    metaMinima,
    atingiuMinimo: aptos.length >= metaMinima,
    universoExibivel: cards.length,
    descartados,
  };
}
