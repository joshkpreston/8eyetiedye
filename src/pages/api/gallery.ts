export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { RARITY_TIERS } from "../../lib/rarity";

export const GET: APIRoute = async ({ url }) => {
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "60", 10),
    120,
  );
  const rarity = url.searchParams.get("rarity") || "all";
  const offset = (page - 1) * limit;

  let query = `SELECT id, name, username, rarity, image_url, created_at
    FROM designs
    WHERE is_public = 1
      AND expires_at > datetime('now')`;

  const bindings: unknown[] = [];

  const validRarity =
    rarity !== "all" && rarity in RARITY_TIERS ? rarity : null;

  if (validRarity) {
    query += ` AND rarity = ?`;
    bindings.push(validRarity);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const result = await env.DB.prepare(query)
    .bind(...bindings)
    .all();

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) as total FROM designs WHERE is_public = 1 AND expires_at > datetime('now')`;
  const countBindings: unknown[] = [];
  if (validRarity) {
    countQuery += ` AND rarity = ?`;
    countBindings.push(validRarity);
  }
  const countResult = await env.DB.prepare(countQuery)
    .bind(...countBindings)
    .first<{ total: number }>();

  const totalCount = countResult?.total || 0;

  return new Response(
    JSON.stringify({
      designs: result.results,
      totalCount,
      page,
      hasMore: offset + limit < totalCount,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
};
