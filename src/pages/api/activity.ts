export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

const CACHE_TTL_SECONDS = 30;

export const GET: APIRoute = async () => {
  // Check KV cache first
  const cached = await env.SESSIONS.get("activity:feed");
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  }

  const result = await env.DB.prepare(
    `SELECT name, username, rarity, created_at
     FROM designs
     WHERE is_public = 1 AND name IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 20`,
  ).all();

  const events = result.results.map((row: Record<string, unknown>) => ({
    designName: row.name,
    username: row.username || "Anonymous",
    rarity: row.rarity,
    createdAt: row.created_at,
  }));

  const body = JSON.stringify({ events });

  // Cache in KV
  await env.SESSIONS.put("activity:feed", body, {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });
};
