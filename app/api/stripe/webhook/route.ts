// Webhook do Stripe → registra/atualiza o assinante no Neon.
// Resolve o e-mail SEMPRE pelo customer do Stripe, para que os eventos de
// subscription (que vêm com customer, não com e-mail) consigam casar a linha.
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { upsertSubscriber } from "@/lib/db";
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
        const s = event.data.object as Stripe.Checkout.Session;
        const customerId = (s.customer as string) ?? null;
        const email =
          s.customer_details?.email ??
          s.customer_email ??
          (await emailForCustomer(customerId));
        if (email) {
          await upsertSubscriber({
            email,
            stripeCustomerId: customerId,
            status: "active",
            currentPeriodEnd: null, // o evento de subscription preenche o período
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = (sub.customer as string) ?? null;
        const email = await emailForCustomer(customerId);
        if (email) {
          const status =
            event.type === "customer.subscription.deleted" ? "canceled" : sub.status;
          const cpe = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null;
          await upsertSubscriber({
            email,
            stripeCustomerId: customerId,
            status,
            currentPeriodEnd: cpe,
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // Não devolve 5xx ao Stripe por falha de gravação transitória: loga e confirma
    // recebimento para evitar reentrega infinita. (Idempotente no upsert.)
    console.error("[A7Pro] webhook upsert falhou:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ received: true });
}
