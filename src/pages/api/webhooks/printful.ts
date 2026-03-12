export const prerender = false;

import type { APIRoute } from "astro";

interface PrintfulWebhookEvent {
  type: string;
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

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  let event: PrintfulWebhookEvent;
  try {
    event = await request.json();
  } catch {
    return new Response("Invalid body", { status: 400 });
  }

  const orderId = event.data.order.external_id;

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
