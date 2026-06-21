import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe não configurado (faltam STRIPE_SECRET_KEY/STRIPE_PRICE_ID)." },
      { status: 500 }
    );
  }
  // Base de retorno = o domínio de onde o cliente veio (origin/host).
  // Assim o /sucesso e /cancelado funcionam tanto no *.vercel.app quanto no
  // domínio custom, sem depender de DNS já estar propagado. Fallback: siteUrl.
  const h = req.headers;
  const origin =
    h.get("origin") ||
    (h.get("host") ? `https://${h.get("host")}` : siteUrl);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancelado`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar a sessão de checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
