export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseSession, requireSessionSecret } from "../../lib/session";

export const GET: APIRoute = async ({ request }) => {
  const sessionSecret = requireSessionSecret(env.SESSION_SECRET);
  const session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  if (!session?.userId) {
    return json({ error: "Not logged in" }, 401);
  }

  const result = await env.DB.prepare(
    `SELECT d.id, d.name, d.rarity, d.image_url, d.created_at, ud.source
     FROM user_designs ud
     JOIN designs d ON d.id = ud.design_id
     WHERE ud.user_id = ?
     ORDER BY ud.created_at DESC
     LIMIT 100`,
  )
    .bind(session.userId)
    .all();

  return json({ designs: result.results }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
