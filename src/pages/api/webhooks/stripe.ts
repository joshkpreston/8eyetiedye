export const prerender = false;

import type { APIRoute } from "astro";
import Stripe from "stripe";
import { getProduct } from "../../../lib/products";
import { createPrintfulOrder } from "../../../lib/pod/printful";
import { createGootenOrder } from "../../../lib/pod/gooten";

export const POST: APIRoute = async ({ request, locals, url }) => {
  const env = locals.runtime.env;
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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          env,
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
          const isFullRefund = charge.amount_captured === charge.amount_refunded;
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
        // Store payment_intent_id on the order for refund/dispute lookups
        if (pi.metadata?.designId) {
          await env.DB.prepare(
            `UPDATE orders
             SET stripe_payment_intent_id = ?, customer_email = ?, updated_at = datetime('now')
             WHERE stripe_session_id IN (
               SELECT id FROM orders WHERE design_id = ? AND stripe_payment_intent_id IS NULL LIMIT 1
             ) OR design_id = ?`,
          )
            .bind(
              pi.id,
              pi.receipt_email || "",
              pi.metadata.designId,
              pi.metadata.designId,
            )
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
  env: App.Locals["runtime"]["env"],
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
      const existing = parseInt(
        (await env.SESSIONS.get(creditKey)) || "0",
        10,
      );
      await env.SESSIONS.put(creditKey, String(existing + rolls));
    }
    return;
  }

  const designId = meta.designId;
  const productId = meta.productId;
  const size = meta.size;
  const rarity = meta.rarity;

  // Get design data
  const designData = await env.SESSIONS.get(`design:${designId}`);
  const design = designData ? JSON.parse(designData) : null;

  // Persist design to D1
  const orderId = crypto.randomUUID();
  const product = getProduct(productId);

  if (!product) {
    console.error(`Product not found: ${productId}`);
    return;
  }

  // Save design permanently
  await env.DB.prepare(
    `INSERT INTO designs (id, session_id, user_id, image_url, prompt, rarity, purchased_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
  )
    .bind(
      designId,
      design?.sessionId || "",
      session.customer_email || "",
      `/api/design/${designId}/image`,
      design?.prompt || "",
      rarity,
      design?.createdAt || new Date().toISOString(),
    )
    .run();

  // Create order record
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  await env.DB.prepare(
    `INSERT INTO orders (id, design_id, stripe_session_id, stripe_customer_id, stripe_payment_intent_id, customer_email, pod_provider, product_type, variant_id, status, amount_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
  )
    .bind(
      orderId,
      designId,
      session.id,
      session.customer || "",
      paymentIntentId,
      session.customer_details?.email || "",
      product.podProvider,
      productId,
      size,
      session.amount_total || product.priceCents,
    )
    .run();

  // Remove KV TTL by re-storing without expiration (design is now permanent)
  if (design) {
    await env.SESSIONS.put(
      `design:${designId}`,
      JSON.stringify({ ...design, purchased: true }),
    );
  }

  // Place POD order
  if (product.podProvider === "printful" && env.PRINTFUL_API_KEY) {
    try {
      const shippingDetails = session.shipping_details;
      const address = shippingDetails?.address;

      if (address && product.printfulVariantIds) {
        const variantId = product.printfulVariantIds[size];
        if (variantId) {
          const origin = url.origin;
          const imageUrl = `${origin}/api/design/${designId}/image`;

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

  // Place Gooten order (neckties)
  if (product.podProvider === "gooten" && env.GOOTEN_API_KEY) {
    try {
      const gootenShipping = session.shipping_details;
      const address = gootenShipping?.address;

      if (address && product.gootenProductId) {
        const nameParts = (gootenShipping?.name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const imageUrl = `${url.origin}/api/design/${designId}/image`;

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
