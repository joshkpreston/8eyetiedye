export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ url }) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response("Google OAuth not configured", { status: 501 });
  }

  // CSRF protection: store state in KV
  const state = crypto.randomUUID();
  await env.SESSIONS.put(`oauth_state:${state}`, "1", {
    expirationTtl: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    },
  });
};
