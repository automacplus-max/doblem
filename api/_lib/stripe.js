import Stripe from "stripe";

let stripe = null;

export function getStripe() {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Falta la variable de entorno STRIPE_SECRET_KEY en el servidor.");
  }
  stripe = new Stripe(key, { apiVersion: "2024-06-20" });
  return stripe;
}
