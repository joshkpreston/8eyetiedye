export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseSession } from "../../../lib/session";

export const GET: APIRoute = async ({ request }) => {
  const sessionSecret = env.SESSION_SECRET || "dev-secret-change-me";
  const session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  if (!session?.userId) {
    return json({ loggedIn: false }, 200);
  }

  return json(
    {
      loggedIn: true,
      email: session.email,
      username: session.username,
      userId: session.userId,
    },
    200,
  );
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
