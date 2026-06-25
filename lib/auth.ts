// Camada de autenticação do Portal da Empresa — magic-link próprio, sem framework.
// Princípio: ZERO dependência nova. Tokens são assinados com HMAC-SHA256 do `crypto`
// nativo do Node (não há tabela de tokens: o link mágico É um JWT curto, stateless).
// A sessão é um cookie httpOnly JWT de 30 dias. O banco (Neon) só guarda `subscriber`,
// então a allowlist de dogfood funciona mesmo se o banco estiver fora do ar.
import crypto from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.AUTH_SECRET || "";
export const SESSION_COOKIE = "a7pro_sess";
const SESSION_DAYS = 30;
const MAGIC_MINUTES = 20;
export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;

// ---- Allowlist de dogfood (acesso gratuito vitalício — decisão §0-BIS do projeto).
// Override por env CSV `DOGFOOD_EMAILS`; o default já cobre o piloto interno.
const DEFAULT_DOGFOOD = ["hugo@grupoa7.com.br", "rh@grupoa7.com.br"];
export function dogfoodEmails(): string[] {
  const env = process.env.DOGFOOD_EMAILS;
  const list = env ? env.split(",") : DEFAULT_DOGFOOD;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isDogfood(email: string): boolean {
  return dogfoodEmails().includes(email.trim().toLowerCase());
}

// ---- Mini-JWT (HMAC-SHA256), formato compacto base64url(payload).base64url(sig).
type Purpose = "magic" | "session";
type Payload = { email: string; purpose: Purpose; exp: number };

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function makeToken(email: string, purpose: Purpose): string {
  if (!SECRET) throw new Error("AUTH_SECRET ausente");
  const ttl = purpose === "magic" ? MAGIC_MINUTES * 60 : SESSION_DAYS * 86_400;
  const payload: Payload = {
    email: email.trim().toLowerCase(),
    purpose,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined | null, purpose: Purpose): Payload | null {
  if (!token || !SECRET) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p: Payload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (p.purpose !== purpose || !p.email) return null;
  if (!p.exp || p.exp * 1000 < Date.now()) return null;
  return p;
}

/** Sessão do request atual (server component ou route handler). null = não logado. */
export function getSession(): Payload | null {
  const c = cookies().get(SESSION_COOKIE)?.value;
  return verifyToken(c, "session");
}

// ---- Token de CALENDÁRIO do trabalhador (S2 · mecânica Spotify).
// Single-purpose: abre SÓ o calendário do próprio diarista. Carrega o `card`
// (id do table_record do banco ZxbYr_AS = 1:1 com o CPF), NUNCA o email.
// É o "link permanente" do perfil: TTL longo (180d), renovado a cada save.
// Reusa o MESMO HMAC/SECRET, mas com payload e verificação próprios — sem
// cruzar com o cookie de sessão da empresa (purpose diferente ⇒ não trafega).
const CALENDAR_DAYS = 180;
type CalendarPayload = { card: string; purpose: "calendar"; exp: number };

export function makeCalendarToken(card: string, days = CALENDAR_DAYS): string {
  if (!SECRET) throw new Error("AUTH_SECRET ausente");
  if (!card) throw new Error("card ausente");
  const payload: CalendarPayload = {
    card: String(card),
    purpose: "calendar",
    exp: Math.floor(Date.now() / 1000) + days * 86_400,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyCalendarToken(
  token: string | undefined | null,
): CalendarPayload | null {
  if (!token || !SECRET) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p: CalendarPayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (p.purpose !== "calendar" || !p.card) return null;
  if (!p.exp || p.exp * 1000 < Date.now()) return null;
  return p;
}

// ---- Token de CONVITE (S4 · convite CEGO). Single-purpose: abre SÓ a página de
// um convite específico. Carrega o `conviteId` (id da linha `convite` no Neon) —
// NUNCA o card, NUNCA o telefone, NUNCA a empresa/endereço. O isolamento LGPD é total:
// quem tem o link vê só os dados cegos daquele convite, e nada cruza com a sessão da
// empresa nem com o link de calendário (purpose próprio). TTL curto (24h, decisão D-D —
// começa folgado pra amostragem ampla; reduzir depois). Reusa o MESMO HMAC/SECRET.
const CONVITE_HOURS = 24;
type ConvitePayload = { conviteId: number; purpose: "convite"; exp: number };

export function makeConviteToken(conviteId: number, hours = CONVITE_HOURS): string {
  if (!SECRET) throw new Error("AUTH_SECRET ausente");
  if (!conviteId) throw new Error("conviteId ausente");
  const payload: ConvitePayload = {
    conviteId: Number(conviteId),
    purpose: "convite",
    exp: Math.floor(Date.now() / 1000) + hours * 3600,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyConviteToken(
  token: string | undefined | null,
): ConvitePayload | null {
  if (!token || !SECRET) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p: ConvitePayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
  if (p.purpose !== "convite" || !p.conviteId) return null;
  if (!p.exp || p.exp * 1000 < Date.now()) return null;
  return p;
}

// ---- Envio do magic link via Resend (REST por fetch — sem SDK, zero dep).
export async function sendMagicLink(email: string, link: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM || "A7Pro · Banco de Talentos <onboarding@resend.dev>";
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#231F20">
    <div style="font-weight:800;font-size:22px;letter-spacing:-.6px;margin-bottom:6px">
      <span style="background:#231F20;color:#fff;border-radius:6px;padding:3px 9px;font-size:18px">a7</span>pro
    </div>
    <div style="font-size:12px;color:#5e5f63;text-transform:uppercase;letter-spacing:1px;margin-bottom:24px">Banco de Talentos · Portal da Empresa</div>
    <h1 style="font-size:20px;font-weight:800;letter-spacing:-.5px;margin:0 0 12px">Seu acesso ao portal</h1>
    <p style="font-size:15px;line-height:1.5;color:#46474b;margin:0 0 24px">Clique no botão abaixo para entrar. O link vale por 20 minutos e é de uso único para o seu e-mail.</p>
    <a href="${link}" style="display:inline-block;background:#231F20;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px">Entrar no portal →</a>
    <p style="font-size:12.5px;line-height:1.5;color:#9b9c9e;margin:28px 0 0">Se você não pediu este acesso, ignore este e-mail — nada acontece.</p>
  </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Seu acesso ao A7Pro · Banco de Talentos",
        html,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
