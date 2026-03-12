export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env;
  const designId = params.id;

  if (!designId) {
    return new Response("Design ID required", { status: 400 });
  }

  // Verify design exists in KV (respects TTL)
  const designData = await env.SESSIONS.get(`design:${designId}`);
  if (!designData) {
    return new Response("Design not found or expired", { status: 404 });
  }

  const design = JSON.parse(designData);

  // Fetch image from R2
  const object = await env.DESIGNS.get(design.r2Key);
  if (!object) {
    return new Response("Image not found", { status: 404 });
  }

  return new Response(object.body as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
