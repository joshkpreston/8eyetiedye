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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
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
      return new Response("OK", { status: 200 });
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
      return new Response("OK", { status: 200 });
    }

    try {
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
      await env.DB.prepare(
        `INSERT INTO orders (id, design_id, stripe_session_id, stripe_customer_id, pod_provider, product_type, variant_id, status, amount_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?)`,
      )
        .bind(
          orderId,
          designId,
          session.id,
          session.customer || "",
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

      // Place POD order (async — don't block webhook response)
      // In production, this would be a queue/durable object
      if (product.podProvider === "printful" && env.PRINTFUL_API_KEY) {
        try {
          const shippingDetails = session.shipping_details;
          const address = shippingDetails?.address;

          if (address && product.printfulVariantIds) {
            const variantId = product.printfulVariantIds[size];
            if (variantId) {
              // Use the site's API route for a publicly accessible design image URL
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
              );

              // Update order with POD order ID
              await env.DB.prepare(
                `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
              )
                .bind(String(printfulOrder.result.id), orderId)
                .run();
            }
          }
        } catch (podErr) {
          console.error("Printful order placement failed:", podErr);
          // Don't fail the webhook — order is still recorded
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

            // Update order with POD order ID
            await env.DB.prepare(
              `UPDATE orders SET pod_order_id = ?, status = 'processing' WHERE id = ?`,
            )
              .bind(gootenOrder.Id, orderId)
              .run();
          }
        } catch (podErr) {
          console.error("Gooten order placement failed:", podErr);
          // Don't fail the webhook — order is still recorded
        }
      }
    } catch (dbErr) {
      console.error("Database operation failed:", dbErr);
    }
  }

  return new Response("OK", { status: 200 });
};
