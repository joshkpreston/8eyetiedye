export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getStripe } from "../../lib/stripe";
import { getProduct, formatPrice } from "../../lib/products";
import { RARITY_TIERS } from "../../lib/rarity";
import {
  parseSession,
  getIdentityKey,
  requireSessionSecret,
} from "../../lib/session";

interface SingleItemRequest {
  designId: string;
  productId: string;
  size: string;
  fromCart?: false;
}

interface CartCheckoutRequest {
  fromCart: true;
}

type CheckoutRequest = SingleItemRequest | CartCheckoutRequest;

interface CartItem {
  designId: string;
  designName: string;
  productId: string;
  size: string;
  quantity: number;
  priceCents: number;
  rarity: string;
}

export const POST: APIRoute = async ({ request, url }) => {
  let body: CheckoutRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const stripe = getStripe(env.STRIPE_SECRET_KEY);

  if ("fromCart" in body && body.fromCart) {
    return handleCartCheckout(request, url, stripe);
  }

  return handleSingleItemCheckout(body as SingleItemRequest, url, stripe);
};

// ─── Single item checkout (backward compatible) ─────────────────────────────

async function handleSingleItemCheckout(
  body: SingleItemRequest,
  url: URL,
  stripe: ReturnType<typeof getStripe>,
): Promise<Response> {
  const { designId, productId, size } = body;

  const designData = await env.SESSIONS.get(`design:${designId}`);
  if (!designData) {
    return json({ error: "Design not found or expired" }, 404);
  }

  const design = JSON.parse(designData);
  const product = getProduct(productId);
  if (!product) return json({ error: "Invalid product" }, 400);
  if (!product.sizes.includes(size))
    return json({ error: "Invalid size" }, 400);

  const rarity = RARITY_TIERS[design.rarity as keyof typeof RARITY_TIERS];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    shipping_address_collection: {
      allowed_countries: ALLOWED_COUNTRIES,
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
            metadata: { designId, rarity: design.rarity },
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
}

// ─── Cart checkout (multi-item) ─────────────────────────────────────────────

async function handleCartCheckout(
  request: Request,
  url: URL,
  stripe: ReturnType<typeof getStripe>,
): Promise<Response> {
  const sessionSecret = requireSessionSecret(env.SESSION_SECRET);
  const userSession = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  if (!userSession) {
    return json({ error: "No session" }, 401);
  }

  const identityKey = getIdentityKey(userSession);
  const cartData = await env.SESSIONS.get(`cart:${identityKey}`);
  if (!cartData) {
    return json({ error: "Cart is empty" }, 400);
  }

  const cart: CartItem[] = JSON.parse(cartData);
  if (cart.length === 0) {
    return json({ error: "Cart is empty" }, 400);
  }

  // Validate all designs still exist
  for (const item of cart) {
    const designData = await env.SESSIONS.get(`design:${item.designId}`);
    if (!designData) {
      return json(
        {
          error: `Design "${item.designName}" has expired. Please remove it from your cart.`,
        },
        400,
      );
    }
  }

  // Build line items
  const lineItems = cart.map((item) => {
    const product = getProduct(item.productId);
    return {
      price_data: {
        currency: "usd" as const,
        unit_amount: item.priceCents,
        product_data: {
          name: `${product?.name || item.productId} — ${item.designName}`,
          description: `Size: ${item.size}. Rarity: ${item.rarity}.`,
          images: [`${url.origin}/api/design/${item.designId}/image`],
        },
      },
      quantity: item.quantity,
    };
  });

  // Store cart snapshot in KV (Stripe metadata has 500-char limit)
  const cartRef = crypto.randomUUID();
  await env.SESSIONS.put(`checkout-cart:${cartRef}`, JSON.stringify(cart), {
    expirationTtl: 3600,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    shipping_address_collection: {
      allowed_countries: ALLOWED_COUNTRIES,
    },
    line_items: lineItems,
    metadata: {
      type: "cart",
      cartRef,
      identityKey,
    },
    success_url: `${url.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${url.origin}/generate`,
  });

  return json({ checkoutUrl: session.url }, 200);
}

const ALLOWED_COUNTRIES: string[] = [
  "US",
  "CA",
  "GB",
  "AU",
  "DE",
  "FR",
  "JP",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "IT",
  "ES",
  "PT",
  "BE",
  "AT",
  "CH",
  "IE",
  "NZ",
];

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
