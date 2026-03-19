export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { sendMagicLink } from "../../../lib/email";

const RATE_LIMIT_PER_HOUR = 3;
const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes

export const POST: APIRoute = async ({ request, url }) => {
  let body: { email: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { email } = body;
  if (!email || !email.includes("@")) {
    return json({ error: "Valid email required" }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit: 3 magic links per email per hour
  const rateLimitKey = `authrate:${normalizedEmail}`;
  const attempts = parseInt((await env.SESSIONS.get(rateLimitKey)) || "0", 10);
  if (attempts >= RATE_LIMIT_PER_HOUR) {
    return json({ error: "Too many attempts. Try again later." }, 429);
  }

  // Generate magic link token
  const token = crypto.randomUUID();
  await env.SESSIONS.put(
    `magic:${token}`,
    JSON.stringify({ email: normalizedEmail }),
    { expirationTtl: TOKEN_TTL_SECONDS },
  );

  // Update rate limit
  await env.SESSIONS.put(rateLimitKey, String(attempts + 1), {
    expirationTtl: 3600,
  });

  // Send magic link email
  const link = `${url.origin}/api/auth/callback?token=${token}`;

  if (env.RESEND_API_KEY) {
    const sent = await sendMagicLink(normalizedEmail, link, env.RESEND_API_KEY);
    if (!sent) {
      return json({ error: "Failed to send email. Please try again." }, 500);
    }
  } else {
    // Dev mode: log the link
    console.log(`[DEV] Magic link for ${normalizedEmail}: ${link}`);
  }

  return json({ ok: true }, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
