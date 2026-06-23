// Camada de banco do Portal — Neon Postgres (driver serverless, HTTP, ideal pra Vercel).
// Única tabela: `subscriber`. Escrita pelo webhook do Stripe; leitura pela trava do /portal.
// Se DATABASE_URL não estiver presente, tudo degrada para "sem assinante" sem quebrar
// (a allowlist de dogfood continua funcionando, pois não depende do banco).
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
export const sql = url ? neon(url) : null;

/** Assinante com acesso liberado? (status pagante E período vigente). */
export async function isActiveSubscriber(email: string): Promise<boolean> {
  if (!sql) return false;
  const e = email.trim().toLowerCase();
  try {
    const rows = (await sql`
      select status, current_period_end
      from subscriber where email = ${e} limit 1
    `) as Array<{ status: string; current_period_end: string | null }>;
    if (!rows.length) return false;
    const s = rows[0];
    if (s.status !== "active" && s.status !== "trialing") return false;
    if (s.current_period_end && new Date(s.current_period_end).getTime() < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Upsert do assinante (chamado pelo webhook do Stripe). */
export async function upsertSubscriber(p: {
  email: string;
  stripeCustomerId?: string | null;
  status: string;
  currentPeriodEnd?: Date | null;
}): Promise<void> {
  if (!sql) throw new Error("DATABASE_URL ausente — não dá para registrar assinante.");
  const e = p.email.trim().toLowerCase();
  const cpe = p.currentPeriodEnd ? p.currentPeriodEnd.toISOString() : null;
  await sql`
    insert into subscriber (email, stripe_customer_id, status, current_period_end, updated_at)
    values (${e}, ${p.stripeCustomerId ?? null}, ${p.status}, ${cpe}, now())
    on conflict (email) do update set
      stripe_customer_id = coalesce(excluded.stripe_customer_id, subscriber.stripe_customer_id),
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = now()
  `;
}
