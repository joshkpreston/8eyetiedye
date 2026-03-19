export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseSession, getIdentityKey } from "../../lib/session";
import { getProduct } from "../../lib/products";

interface CartItem {
  designId: string;
  designName: string;
  productId: string;
  size: string;
  quantity: number;
  priceCents: number;
  rarity: string;
}

const MAX_CART_ITEMS = 10;
const CART_TTL_SECONDS = 24 * 60 * 60;

async function getCart(identityKey: string): Promise<CartItem[]> {
  const data = await env.SESSIONS.get(`cart:${identityKey}`);
  if (!data) return [];
  return JSON.parse(data) as CartItem[];
}

async function saveCart(
  identityKey: string,
  cart: CartItem[],
): Promise<void> {
  if (cart.length === 0) {
    await env.SESSIONS.delete(`cart:${identityKey}`);
    return;
  }
  await env.SESSIONS.put(`cart:${identityKey}`, JSON.stringify(cart), {
    expirationTtl: CART_TTL_SECONDS,
  });
}

function cartResponse(cart: CartItem[]): Response {
  const totalCents = cart.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  return json({ items: cart, totalCents, itemCount }, 200);
}

// GET — fetch cart
export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) return json({ items: [], totalCents: 0, itemCount: 0 }, 200);

  const identityKey = getIdentityKey(session);
  let cart = await getCart(identityKey);

  // Validate designs still exist (prune expired)
  const validated: CartItem[] = [];
  for (const item of cart) {
    const designData = await env.SESSIONS.get(`design:${item.designId}`);
    if (designData) {
      validated.push(item);
    }
  }

  // Save pruned cart if items were removed
  if (validated.length !== cart.length) {
    await saveCart(identityKey, validated);
  }

  return cartResponse(validated);
};

// POST — add item to cart
export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) return json({ error: "No session" }, 401);

  let body: { designId: string; designName: string; productId: string; size: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { designId, designName, productId, size } = body;

  // Validate design exists
  const designData = await env.SESSIONS.get(`design:${designId}`);
  if (!designData) {
    return json({ error: "Design not found or expired" }, 404);
  }

  // Validate product
  const product = getProduct(productId);
  if (!product) return json({ error: "Invalid product" }, 400);
  if (!product.sizes.includes(size)) {
    return json({ error: "Invalid size" }, 400);
  }

  const identityKey = getIdentityKey(session);
  const cart = await getCart(identityKey);

  // Check if same design+product+size already in cart → increment quantity
  const existingIdx = cart.findIndex(
    (item) =>
      item.designId === designId &&
      item.productId === productId &&
      item.size === size,
  );

  if (existingIdx >= 0) {
    cart[existingIdx].quantity += 1;
  } else {
    if (cart.length >= MAX_CART_ITEMS) {
      return json({ error: "Cart is full (max 10 items)" }, 400);
    }

    const design = JSON.parse(designData);
    cart.push({
      designId,
      designName: designName || design.name || "Untitled",
      productId,
      size,
      quantity: 1,
      priceCents: product.priceCents,
      rarity: design.rarity,
    });
  }

  await saveCart(identityKey, cart);
  return cartResponse(cart);
};

// PATCH — update quantity
export const PATCH: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) return json({ error: "No session" }, 401);

  let body: { index: number; quantity: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { index, quantity } = body;
  const identityKey = getIdentityKey(session);
  const cart = await getCart(identityKey);

  if (index < 0 || index >= cart.length) {
    return json({ error: "Invalid index" }, 400);
  }

  if (quantity <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = Math.min(quantity, 10); // max 10 of same item
  }

  await saveCart(identityKey, cart);
  return cartResponse(cart);
};

// DELETE — remove item
export const DELETE: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) return json({ error: "No session" }, 401);

  let body: { index: number };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const identityKey = getIdentityKey(session);
  const cart = await getCart(identityKey);

  if (body.index < 0 || body.index >= cart.length) {
    return json({ error: "Invalid index" }, 400);
  }

  cart.splice(body.index, 1);
  await saveCart(identityKey, cart);
  return cartResponse(cart);
};

async function getSession(request: Request) {
  const sessionSecret = env.SESSION_SECRET || "dev-secret-change-me";
  return parseSession(request.headers.get("cookie"), sessionSecret);
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
