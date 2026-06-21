import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const h = req.headers;
  return h.get("origin") || (h.get("host") ? `https://${h.get("host")}` : siteUrl);
}

async function createSession(origin: string) {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) return null;
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cancelado`,
  });
}

// GET: navegação direta do botão. Cria a sessão e redireciona (303) pro Stripe.
// Robusto ao redirect apex→www: navegação de topo segue redirects sem CORS.
export async function GET(req: Request) {
  const origin = baseUrl(req);
  try {
    const session = await createSession(origin);
    if (!session?.url) return NextResponse.redirect(`${origin}/cancelado?e=config`, 303);
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(`${origin}/cancelado?e=erro`, 303);
  }
}

// POST: mantido para uso programático (retorna JSON com a url).
export async function POST(req: Request) {
  const origin = baseUrl(req);
  const session = await createSession(origin).catch(() => null);
  if (!session?.url) {
    return NextResponse.json(
      { error: "Checkout indisponível no momento." },
      { status: 500 }
    );
  }
  return NextResponse.json({ url: session.url });
}
