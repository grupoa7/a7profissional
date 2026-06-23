// Webhook do Stripe → registra/atualiza o assinante no Neon.
// Princípio de segurança: o e-mail e o status/vigência vêm SEMPRE da assinatura e do
// Customer do Stripe (fonte confiável), nunca do campo livre digitado no checkout.
// Assim ninguém ativa o e-mail de terceiro nem fica "ativo" sem prazo de vigência.
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { upsertSubscriber, setStatusByCustomerId } from "@/lib/db";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function emailForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId || !stripe) return null;
  try {
    const c = await stripe.customers.retrieve(customerId);
    if (c && !(c as Stripe.DeletedCustomer).deleted) {
      return (c as Stripe.Customer).email ?? null;
    }
  } catch {
    /* ignora — cai pro null */
  }
  return null;
}

// Aplica o estado de UMA assinatura ao banco. E-mail só do Customer; status/vigência
// só da própria assinatura. Se o Customer foi deletado (sem e-mail resolvível), ainda
// assim revoga/atualiza pelo stripe_customer_id.
async function aplicarAssinatura(sub: Stripe.Subscription, statusForcado?: string) {
  const customerId = (sub.customer as string) ?? null;
  const status = statusForcado ?? sub.status;
  const cpe = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const email = await emailForCustomer(customerId);
  if (email) {
    await upsertSubscriber({ email, stripeCustomerId: customerId, status, currentPeriodEnd: cpe });
  } else if (customerId) {
    await setStatusByCustomerId(customerId, status);
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig as string, secret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "assinatura inválida";
    return NextResponse.json({ error: `Webhook signature: ${msg}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Não confiamos no e-mail do checkout: buscamos a assinatura e tratamos como
        // os demais eventos (status e vigência reais, e-mail do Customer).
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await aplicarAssinatura(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await aplicarAssinatura(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await aplicarAssinatura(event.data.object as Stripe.Subscription, "canceled");
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // Não devolve 5xx ao Stripe por falha transitória de gravação: loga e confirma
    // recebimento para evitar reentrega infinita. (Upsert é idempotente.)
    console.error("[A7Pro] webhook upsert falhou:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ received: true });
}
