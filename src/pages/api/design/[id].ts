export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env;
  const designId = params.id;

  if (!designId) {
    return json({ error: "Design ID required" }, 400);
  }

  // Look up design metadata in KV
  const designData = await env.SESSIONS.get(`design:${designId}`);

  if (!designData) {
    return json({ error: "Design not found or expired" }, 404);
  }

  const design = JSON.parse(designData);

  return json(
    {
      id: design.id,
      imageUrl: `/api/design/${design.id}/image`,
      rarity: design.rarity,
      createdAt: design.createdAt,
    },
    200,
  );
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
