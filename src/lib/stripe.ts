import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(secretKey: string): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return stripeInstance;
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = new Stripe(secret);
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
