export const prerender = false;

import type { APIRoute } from "astro";
import { getStripe } from "../../lib/stripe";
import { getProduct, formatPrice } from "../../lib/products";
import { RARITY_TIERS } from "../../lib/rarity";

interface CheckoutRequest {
  designId: string;
  productId: string;
  size: string;
}

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = locals.runtime.env;

  let body: CheckoutRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { designId, productId, size } = body;

  // Validate design exists
  const designData = await env.SESSIONS.get(`design:${designId}`);
  if (!designData) {
    return json({ error: "Design not found or expired" }, 404);
  }

  const design = JSON.parse(designData);

  // Validate product
  const product = getProduct(productId);
  if (!product) {
    return json({ error: "Invalid product" }, 400);
  }

  if (!product.sizes.includes(size)) {
    return json({ error: "Invalid size" }, 400);
  }

  const rarity = RARITY_TIERS[design.rarity as keyof typeof RARITY_TIERS];

  // Create Stripe Checkout Session
  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    shipping_address_collection: {
      allowed_countries: [
        "US", "CA", "GB", "AU", "DE", "FR", "JP", "NL",
        "SE", "NO", "DK", "FI", "IT", "ES", "PT", "BE",
        "AT", "CH", "IE", "NZ",
      ],
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: product.priceCents,
          product_data: {
            name: `${product.name} — ${rarity.label} Tie-Dye`,
            description: `${product.description} Size: ${size}. Rarity: ${rarity.label}.`,
            images: [`${url.origin}/api/design/${designId}/image`],
            metadata: {
              designId,
              rarity: design.rarity,
            },
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      designId,
      productId,
      size,
      rarity: design.rarity,
      podProvider: product.podProvider,
    },
    success_url: `${url.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${url.origin}/order/cancel?design_id=${designId}`,
  });

  return json({ checkoutUrl: session.url }, 200);
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
