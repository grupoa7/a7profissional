import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return NextResponse.json(
      { error: "Stripe não configurado (faltam STRIPE_SECRET_KEY/STRIPE_PRICE_ID)." },
      { status: 500 }
    );
  }
  try {
    // Checkout Session hospedado, modo assinatura. Apple Pay e Cartão aparecem
    // automaticamente (Stripe cuida da verificação de domínio do Apple Pay).
    // Os meios de pagamento seguem o que está habilitado no Dashboard do Stripe
    // (habilite Pix lá quando o CNPJ estiver ativo).
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${siteUrl}/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancelado`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar a sessão de checkout.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
