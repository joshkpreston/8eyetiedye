export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

interface PrintfulWebhookEvent {
  type: string;
  retries: number;
  data: {
    order: {
      id: number;
      external_id: string;
      status: string;
    };
    shipment?: {
      carrier: string;
      service: string;
      tracking_number: string;
      tracking_url: string;
    };
  };
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();

  // Verify webhook signature if secret is configured
  if (env.PRINTFUL_WEBHOOK_SECRET) {
    const signature = request.headers.get("x-printful-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 401 });
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.PRINTFUL_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expected) {
      console.error("Printful webhook: signature mismatch");
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let event: PrintfulWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const orderId = event.data.order.external_id;

  if (!orderId) {
    console.error("Printful webhook: missing external_id");
    return new Response("Invalid event: missing external_id", { status: 400 });
  }

  // Idempotency: dedup by printful order id + event type
  const eventKey = `printful_event:${event.data.order.id}:${event.type}`;
  const alreadyProcessed = await env.SESSIONS.get(eventKey);
  if (alreadyProcessed) {
    return new Response("Already processed", { status: 200 });
  }
  await env.SESSIONS.put(eventKey, "1", { expirationTtl: 86400 });

  // Verify the referenced order exists in our database
  try {
    const existingOrder = await env.DB.prepare(
      `SELECT id FROM orders WHERE id = ?`,
    )
      .bind(orderId)
      .first();

    if (!existingOrder) {
      console.error(`Printful webhook: order not found in DB: ${orderId}`);
      return new Response("Order not found", { status: 404 });
    }
  } catch (err) {
    console.error("Printful webhook: DB lookup failed:", err);
    return new Response("Internal error", { status: 500 });
  }

  if (event.type === "package_shipped" && event.data.shipment) {
    const shipment = event.data.shipment;

    try {
      await env.DB.prepare(
        `UPDATE orders
         SET status = 'shipped',
             tracking_number = ?,
             tracking_url = ?,
             updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(shipment.tracking_number, shipment.tracking_url, orderId)
        .run();
    } catch (err) {
      console.error("Failed to update order with tracking:", err);
    }
  } else if (event.type === "order_failed") {
    try {
      await env.DB.prepare(
        `UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ?`,
      )
        .bind(orderId)
        .run();
    } catch (err) {
      console.error("Failed to update order status:", err);
    }
  }

  return new Response("OK", { status: 200 });
};
