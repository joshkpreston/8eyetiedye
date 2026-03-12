export const prerender = false;

import type { APIRoute } from "astro";
import { getStripe } from "../../lib/stripe";

const CREDIT_PACKS = [
  { id: "pack-1", rolls: 1, priceCents: 50, label: "1 Roll" },
  { id: "pack-5", rolls: 5, priceCents: 300, label: "5 Rolls" },
  { id: "pack-15", rolls: 15, priceCents: 700, label: "15 Rolls" },
] as const;

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = locals.runtime.env;

  let body: { packId: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const pack = CREDIT_PACKS.find((p) => p.id === body.packId);
  if (!pack) {
    return json({ error: "Invalid pack" }, 400);
  }

  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: `${pack.label} — Roll Credits`,
            description: `${pack.rolls} roll credit(s). Credits apply toward your next purchase.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "credits",
      packId: pack.id,
      rolls: String(pack.rolls),
    },
    success_url: `${url.origin}/generate?credits=purchased`,
    cancel_url: `${url.origin}/generate`,
  });

  return json({ checkoutUrl: session.url }, 200);
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
