export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStripe } from "../../../lib/stripe";
import { getMysteryPack } from "../../../lib/mystery-packs";
import { parseSession, requireSessionSecret } from "../../../lib/session";

export const POST: APIRoute = async ({ request, url }) => {
  let body: { packId: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const pack = getMysteryPack(body.packId);
  if (!pack) {
    return json({ error: "Invalid pack" }, 400);
  }

  // Get session to check if user is logged in
  const sessionSecret = requireSessionSecret(env.SESSION_SECRET);
  const session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  // Mystery packs require login (designs must be saved to an account)
  if (!session?.userId) {
    return json(
      {
        error:
          "Please sign in to purchase mystery packs. Designs are saved to your account.",
      },
      401,
    );
  }

  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: `Mystery Design Pack — ${pack.label}`,
            description: `${pack.count} unique AI-generated tie-dye designs delivered to your account.`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "mystery_pack",
      packId: pack.id,
      count: String(pack.count),
      userId: session.userId,
    },
    success_url: `${url.origin}/order/success?session_id={CHECKOUT_SESSION_ID}&type=mystery_pack`,
    cancel_url: `${url.origin}/generate`,
  });

  return json({ checkoutUrl: checkoutSession.url }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
