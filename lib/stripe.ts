import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
// Instancia preguiçosa: não quebra o build se a chave não estiver presente.
export const stripe = key
  ? new Stripe(key, { apiVersion: "2024-06-20" })
  : (null as unknown as Stripe);
