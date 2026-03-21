export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  parseSession,
  getIdentityKey,
  requireSessionSecret,
} from "../../lib/session";

export const GET: APIRoute = async ({ request }) => {
  const sessionSecret = requireSessionSecret(env.SESSION_SECRET);
  const session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  if (!session) {
    return json({ designs: [] }, 200);
  }

  const identityKey = getIdentityKey(session);
  const designsListKey = `designs:${identityKey}`;
  const designIds: string[] = JSON.parse(
    (await env.SESSIONS.get(designsListKey)) || "[]",
  );

  if (designIds.length === 0) {
    return json({ designs: [] }, 200);
  }

  // Fetch each design's metadata from KV (filters out expired ones)
  const designs = (
    await Promise.all(
      designIds.map(async (id) => {
        const data = await env.SESSIONS.get(`design:${id}`);
        if (!data) return null;
        const parsed = JSON.parse(data);
        return {
          designId: parsed.id,
          imageUrl: `/api/design/${parsed.id}/image`,
          rarity: parsed.rarity,
          name: parsed.name || null,
          createdAt: parsed.createdAt,
        };
      }),
    )
  ).filter(Boolean);

  return json({ designs }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
