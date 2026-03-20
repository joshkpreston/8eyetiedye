export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { getProduct } from "../../../lib/products";
import { createPrintfulOrder } from "../../../lib/pod/printful";
import { createGootenOrder } from "../../../lib/pod/gooten";
import { rollRarity } from "../../../lib/rarity";
import { buildPrompt } from "../../../lib/prompts";
import { generateDesignName } from "../../../lib/names";

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
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: never process the same event twice
  const eventKey = `stripe_event:${event.id}`;
  const alreadyProcessed = await env.SESSIONS.get(eventKey);
  if (alreadyProcessed) {
    return new Response("Already processed", { status: 200 });
  }
  // Mark as processing immediately (24h TTL)
  await env.SESSIONS.put(eventKey, "1", { expirationTtl: 86400 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          url,
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata;
        if (meta?.designId) {
          console.log(
            `Checkout expired for design ${meta.designId}, product ${meta.productId}`,
          );
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (paymentIntentId) {
          const isFullRefund =
            charge.amount_captured === charge.amount_refunded;
          await env.DB.prepare(
            `UPDATE orders
             SET refund_status = ?,
                 refund_amount_cents = ?,
                 status = CASE WHEN ? = 'full' THEN 'refunded' ELSE status END,
                 updated_at = datetime('now')
             WHERE stripe_payment_intent_id = ?`,
          )
            .bind(
              isFullRefund ? "full" : "partial",
              charge.amount_refunded,
              isFullRefund ? "full" : "partial",
              paymentIntentId,
            )
            .run();
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        if (piId) {
          await env.DB.prepare(
            `UPDATE orders
             SET dispute_status = 'needs_response',
                 status = 'disputed',
                 updated_at = datetime('now')
             WHERE stripe_payment_intent_id = ?`,
          )
            .bind(piId)
            .run();

          console.error(
            `DISPUTE OPENED: payment_intent=${piId}, reason=${dispute.reason}, amount=${dispute.amount}`,
          );
        }
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id;

        if (piId) {
          const won = dispute.status === "won";
          await env.DB.prepare(
            `UPDATE orders
             SET dispute_status = ?,
                 status = CASE WHEN ? = 'won' THEN 'paid' ELSE 'refunded' END,
                 updated_at = datetime('now')
             WHERE stripe_payment_intent_id = ?`,
          )
            .bind(won ? "won" : "lost", won ? "won" : "lost", piId)
            .run();
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.designId) {
          await env.DB.prepare(
            `UPDATE orders
             SET stripe_payment_intent_id = ?, customer_email = ?, updated_at = datetime('now')
             WHERE design_id = ? AND stripe_payment_intent_id IS NULL`,
          )
            .bind(pi.id, pi.receipt_email || "", pi.metadata.designId)
            .run();
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.error(
          `Payment failed: ${pi.id}, last error: ${pi.last_payment_error?.message}`,
        );
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
  }

  return new Response("OK", { status: 200 });
};

// ─── Checkout completed handler ─────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  url: URL,
) {
  const meta = session.metadata!;

  // Handle credit pack purchases
  if (meta.type === "credits") {
    const rolls = parseInt(meta.rolls, 10);
    const email =
      session.customer_email || session.customer_details?.email || "";
    if (email) {
      const creditKey = `credits:${email}`;
      const existing = parseInt((await env.SESSIONS.get(creditKey)) || "0", 10);
      await env.SESSIONS.put(creditKey, String(existing + rolls));
    }
    return;
  }

  // Handle mystery pack purchases
  if (meta.type === "mystery_pack") {
    await handleMysteryPackPurchase(session, meta, url);
    return;
  }

  // Handle cart checkout
  if (meta.type === "cart") {
    await handleCartCheckout(session, meta, url);
    return;
  }

  // Handle single-item checkout (backward compatible)
  await handleSingleItemCheckout(session, meta, url);
}

// ─── Single item checkout (original flow) ───────────────────────────────────

async function handleSingleItemCheckout(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  url: URL,
) {
  const designId = meta.designId;
  const productId = meta.productId;
  const size = meta.size;
  const rarity = meta.rarity;

  const designData = await env.SESSIONS.get(`design:${designId}`);
  const design = designData ? JSON.parse(designData) : null;

  const orderId = crypto.randomUUID();
  const product = getProduct(productId);

  if (!product) {
    console.error(`Product not found: ${productId}`);
    return;
  }

  // Save design permanently
  await upsertDesign(designId, design, rarity, session);

  // Create order group (single item)
  const groupId = crypto.randomUUID();
  const paymentIntentId = extractPaymentIntentId(session);

  await env.DB.prepare(
    `INSERT INTO order_groups (id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id, customer_email, status, total_amount_cents)
     VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
  )
    .bind(
      groupId,
      session.id,
      session.customer || "",
      paymentIntentId,
      session.customer_details?.email || "",
      session.amount_total || product.priceCents,
    )
    .run();

  // Create order record
  await env.DB.prepare(
    `INSERT INTO orders (id, order_group_id, design_id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id, customer_email, pod_provider, product_type, variant_id, size, status, amount_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
  )
    .bind(
      orderId,
      groupId,
      designId,
      session.id,
      session.customer || "",
      paymentIntentId,
      session.customer_details?.email || "",
      product.podProvider,
      productId,
      size,
      size,
      session.amount_total || product.priceCents,
    )
    .run();

  // Remove KV TTL (design is now permanent)
  if (design) {
    await env.SESSIONS.put(
      `design:${designId}`,
      JSON.stringify({ ...design, purchased: true }),
    );
  }

  // Place POD order
  await placePodOrder(product, session, designId, size, orderId, url);
}

// ─── Cart checkout (multi-item) ─────────────────────────────────────────────

async function handleCartCheckout(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  url: URL,
) {
  const cartRef = meta.cartRef;
  const cartData = await env.SESSIONS.get(`checkout-cart:${cartRef}`);
  if (!cartData) {
    console.error("Cart snapshot not found for checkout:", cartRef);
    return;
  }

  const cart: CartItem[] = JSON.parse(cartData);
  const paymentIntentId = extractPaymentIntentId(session);

  // Create order group
  const groupId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO order_groups (id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id, customer_email, status, total_amount_cents)
     VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
  )
    .bind(
      groupId,
      session.id,
      session.customer || "",
      paymentIntentId,
      session.customer_details?.email || "",
      session.amount_total || 0,
    )
    .run();

  // Create individual orders + persist designs
  const orderIds: { orderId: string; item: CartItem }[] = [];
  for (const item of cart) {
    const designData = await env.SESSIONS.get(`design:${item.designId}`);
    const design = designData ? JSON.parse(designData) : null;

    await upsertDesign(item.designId, design, item.rarity, session);

    const orderId = crypto.randomUUID();
    const product = getProduct(item.productId);
    if (!product) continue;

    await env.DB.prepare(
      `INSERT INTO orders (id, order_group_id, design_id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id, customer_email, pod_provider, product_type, variant_id, size, status, amount_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
    )
      .bind(
        orderId,
        groupId,
        item.designId,
        session.id,
        session.customer || "",
        paymentIntentId,
        session.customer_details?.email || "",
        product.podProvider,
        item.productId,
        item.size,
        item.size,
        item.priceCents * item.quantity,
      )
      .run();

    orderIds.push({ orderId, item });

    // Make design permanent in KV
    if (design) {
      await env.SESSIONS.put(
        `design:${item.designId}`,
        JSON.stringify({ ...design, purchased: true }),
      );
    }

    // Save design to user account if logged in
    if (meta.identityKey && meta.identityKey !== session.id) {
      await saveDesignToUser(meta.identityKey, item.designId);
    }
  }

  // Group items by POD provider and place orders
  const printfulItems: { orderId: string; item: CartItem }[] = [];
  const gootenItems: { orderId: string; item: CartItem }[] = [];

  for (const { orderId, item } of orderIds) {
    const product = getProduct(item.productId);
    if (!product) continue;
    if (product.podProvider === "printful") {
      printfulItems.push({ orderId, item });
    } else if (product.podProvider === "gooten") {
      gootenItems.push({ orderId, item });
    }
  }

  // Place ONE Printful order with all Printful items
  if (printfulItems.length > 0 && env.PRINTFUL_API_KEY) {
    try {
      const shippingDetails = (session as any).shipping_details;
      const address = shippingDetails?.address;

      if (address) {
        const pfItems = printfulItems
          .map(({ item }) => {
            const product = getProduct(item.productId);
            if (!product?.printfulVariantIds) return null;
            const variantId = product.printfulVariantIds[item.size];
            if (!variantId) return null;
            return {
              variant_id: variantId,
              quantity: item.quantity,
              files: [
                {
                  type: product.printfulFileType || "default",
                  url: `${url.origin}/api/design/${item.designId}/image`,
                },
              ],
            };
          })
          .filter(Boolean) as Array<{
          variant_id: number;
          quantity: number;
          files: { type: string; url: string }[];
        }>;

        if (pfItems.length > 0) {
          const printfulOrder = await createPrintfulOrder(
            env.PRINTFUL_API_KEY,
            {
              name: shippingDetails?.name || "",
              address1: address.line1 || "",
              city: address.city || "",
              state_code: address.state || "",
              country_code: address.country || "",
              zip: address.postal_code || "",
              email: session.customer_details?.email || "",
            },
            pfItems,
            groupId,
            env.PRINTFUL_STORE_ID,
          );

          // Update all Printful orders with pod_order_id
          for (const { orderId } of printfulItems) {
            await env.DB.prepare(
              `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
            )
              .bind(String(printfulOrder.result.id), orderId)
              .run();
          }
        }
      }
    } catch (podErr) {
      console.error("Printful order placement failed:", podErr);
    }
  }

  // Place ONE Gooten order with all Gooten items
  if (gootenItems.length > 0 && env.GOOTEN_API_KEY) {
    try {
      const gootenShipping = (session as any).shipping_details;
      const address = gootenShipping?.address;

      if (address) {
        const nameParts = (gootenShipping?.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const gtItems = gootenItems
          .map(({ item }) => {
            const product = getProduct(item.productId);
            if (!product?.gootenProductId) return null;
            return {
              SKU: product.gootenProductId,
              ShipCarrierMethodId: 1,
              Quantity: item.quantity,
              Images: [
                {
                  Url: `${url.origin}/api/design/${item.designId}/image`,
                  Index: 0,
                  ManipCommand: "",
                  SpaceId: "0",
                },
              ],
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        if (gtItems.length > 0) {
          const gootenOrder = await createGootenOrder(
            env.GOOTEN_API_KEY,
            {
              FirstName: firstName,
              LastName: lastName,
              Line1: address.line1 || "",
              Line2: address.line2 || undefined,
              City: address.city || "",
              State: address.state || "",
              CountryCode: address.country || "",
              PostalCode: address.postal_code || "",
              Email: session.customer_details?.email || "",
              Phone: session.customer_details?.phone || "",
            },
            gtItems,
            groupId,
          );

          for (const { orderId } of gootenItems) {
            await env.DB.prepare(
              `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
            )
              .bind(gootenOrder.Id, orderId)
              .run();
          }
        }
      }
    } catch (podErr) {
      console.error("Gooten order placement failed:", podErr);
    }
  }

  // Clear cart + checkout snapshot
  await env.SESSIONS.delete(`checkout-cart:${cartRef}`);
  if (meta.identityKey) {
    await env.SESSIONS.delete(`cart:${meta.identityKey}`);
  }
}

// ─── Mystery pack purchase ──────────────────────────────────────────────────

async function handleMysteryPackPurchase(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  url: URL,
) {
  const count = parseInt(meta.count, 10);
  const userId = meta.userId;
  const packId = meta.packId;

  // Record the purchase
  const purchaseId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO mystery_pack_purchases (id, user_id, stripe_session_id, pack_size, amount_cents, status)
     VALUES (?, ?, ?, ?, ?, 'completed')`,
  )
    .bind(purchaseId, userId, session.id, count, session.amount_total || 0)
    .run();

  // Generate N designs
  for (let i = 0; i < count; i++) {
    const rarity = rollRarity();
    const designName = generateDesignName(rarity);
    const designId = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Generate AI image if available
    let imageStored = false;
    if (env.AI) {
      try {
        const prompt = buildPrompt(rarity);
        let result: unknown;
        try {
          result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
            prompt,
            width: 1024,
            height: 1024,
            num_steps: 4,
          });
        } catch {
          result = await env.AI.run(
            "@cf/stabilityai/stable-diffusion-xl-base-1.0",
            { prompt, width: 1024, height: 1024 },
          );
        }

        const imageData = await extractImageData(result);
        if (imageData) {
          const r2Key = `designs/${designId}.png`;
          await env.DESIGNS.put(r2Key, imageData, {
            httpMetadata: { contentType: "image/png" },
            customMetadata: { rarity, prompt, createdAt: now },
          });

          // Store in KV for image serving
          await env.SESSIONS.put(
            `design:${designId}`,
            JSON.stringify({
              id: designId,
              r2Key,
              rarity,
              name: designName,
              prompt,
              purchased: true,
              createdAt: now,
            }),
          );
          imageStored = true;
        }
      } catch (err) {
        console.error(
          `Mystery pack design ${i + 1}/${count} generation failed:`,
          err,
        );
      }
    }

    // Store in D1
    await env.DB.prepare(
      `INSERT INTO designs (id, session_id, user_id, name, image_url, prompt, rarity, is_public, purchased_at, expires_at, created_at)
       VALUES (?, '', ?, ?, ?, '', ?, 1, datetime('now'), ?, ?)`,
    )
      .bind(
        designId,
        userId,
        designName,
        imageStored ? `/api/design/${designId}/image` : "",
        rarity,
        expiresAt,
        now,
      )
      .run();

    // Link to user
    await saveDesignToUser(userId, designId);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function upsertDesign(
  designId: string,
  design: Record<string, unknown> | null,
  rarity: string,
  session: Stripe.Checkout.Session,
) {
  // Check if design already exists in D1
  const existing = await env.DB.prepare("SELECT id FROM designs WHERE id = ?")
    .bind(designId)
    .first();

  if (existing) {
    // Update with purchase info
    await env.DB.prepare(
      `UPDATE designs SET purchased_at = datetime('now'), user_id = COALESCE(user_id, ?) WHERE id = ?`,
    )
      .bind(session.customer_details?.email || "", designId)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO designs (id, session_id, user_id, image_url, prompt, rarity, purchased_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
    )
      .bind(
        designId,
        (design?.sessionId as string) || "",
        session.customer_details?.email || "",
        `/api/design/${designId}/image`,
        (design?.prompt as string) || "",
        rarity,
        (design?.createdAt as string) || new Date().toISOString(),
      )
      .run();
  }
}

async function saveDesignToUser(
  userId: string,
  designId: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_designs (id, user_id, design_id, source) VALUES (?, ?, ?, 'purchase')`,
    )
      .bind(crypto.randomUUID(), userId, designId)
      .run();
  } catch {
    // Ignore duplicate key errors
  }
}

function extractPaymentIntentId(
  session: Stripe.Checkout.Session,
): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

async function extractImageData(result: unknown): Promise<ArrayBuffer | null> {
  if (result instanceof ReadableStream) {
    const reader = result.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged.buffer as ArrayBuffer;
  } else if (result instanceof ArrayBuffer) {
    return result;
  } else if (result && typeof result === "object" && "image" in result) {
    const b64 = (result as { image: string }).image;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }
  return null;
}

async function placePodOrder(
  product: NonNullable<ReturnType<typeof getProduct>>,
  session: Stripe.Checkout.Session,
  designId: string,
  size: string,
  orderId: string,
  url: URL,
) {
  if (product.podProvider === "printful" && env.PRINTFUL_API_KEY) {
    try {
      const shippingDetails = (session as any).shipping_details;
      const address = shippingDetails?.address;

      if (address && product.printfulVariantIds) {
        const variantId = product.printfulVariantIds[size];
        if (variantId) {
          const imageUrl = `${url.origin}/api/design/${designId}/image`;
          const printfulOrder = await createPrintfulOrder(
            env.PRINTFUL_API_KEY,
            {
              name: shippingDetails?.name || "",
              address1: address.line1 || "",
              city: address.city || "",
              state_code: address.state || "",
              country_code: address.country || "",
              zip: address.postal_code || "",
              email: session.customer_details?.email || "",
            },
            [
              {
                variant_id: variantId,
                quantity: 1,
                files: [
                  {
                    type: product.printfulFileType || "default",
                    url: imageUrl,
                  },
                ],
              },
            ],
            orderId,
            env.PRINTFUL_STORE_ID,
          );

          await env.DB.prepare(
            `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
          )
            .bind(String(printfulOrder.result.id), orderId)
            .run();
        }
      }
    } catch (podErr) {
      console.error("Printful order placement failed:", podErr);
    }
  }

  if (product.podProvider === "gooten" && env.GOOTEN_API_KEY) {
    try {
      const gootenShipping = (session as any).shipping_details;
      const address = gootenShipping?.address;

      if (address && product.gootenProductId) {
        const nameParts = (gootenShipping?.name || "").split(" ");
        const imageUrl = `${url.origin}/api/design/${designId}/image`;

        const gootenOrder = await createGootenOrder(
          env.GOOTEN_API_KEY,
          {
            FirstName: nameParts[0] || "",
            LastName: nameParts.slice(1).join(" ") || "",
            Line1: address.line1 || "",
            Line2: address.line2 || undefined,
            City: address.city || "",
            State: address.state || "",
            CountryCode: address.country || "",
            PostalCode: address.postal_code || "",
            Email: session.customer_details?.email || "",
            Phone: session.customer_details?.phone || "",
          },
          [
            {
              SKU: product.gootenProductId,
              ShipCarrierMethodId: 1,
              Quantity: 1,
              Images: [
                {
                  Url: imageUrl,
                  Index: 0,
                  ManipCommand: "",
                  SpaceId: "0",
                },
              ],
            },
          ],
          orderId,
        );

        await env.DB.prepare(
          `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
        )
          .bind(gootenOrder.Id, orderId)
          .run();
      }
    } catch (podErr) {
      console.error("Gooten order placement failed:", podErr);
    }
  }
}
