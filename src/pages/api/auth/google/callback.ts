export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  parseSession,
  createSession,
  updateSession,
  getIdentityKey,
} from "../../../../lib/session";
import { generateUsername } from "../../../../lib/names";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export const GET: APIRoute = async ({ request, url, redirect }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return redirect("/generate?auth=error");
  }

  // Verify CSRF state
  const stateValid = await env.SESSIONS.get(`oauth_state:${state}`);
  if (!stateValid) {
    return redirect("/generate?auth=error");
  }
  await env.SESSIONS.delete(`oauth_state:${state}`);

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Google token exchange failed:", await tokenRes.text());
    return redirect("/generate?auth=error");
  }

  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  // Fetch user profile
  const profileRes = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    },
  );

  if (!profileRes.ok) {
    console.error("Google profile fetch failed:", await profileRes.text());
    return redirect("/generate?auth=error");
  }

  const profile = (await profileRes.json()) as GoogleUserInfo;

  // Upsert user: check by google_id first, then by email
  let user = await env.DB.prepare(
    "SELECT id, username FROM users WHERE google_id = ? OR email = ? LIMIT 1",
  )
    .bind(profile.sub, profile.email)
    .first<{ id: string; username: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    const username = generateUsername();
    await env.DB.prepare(
      "INSERT INTO users (id, email, username, google_id, avatar_url) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(userId, profile.email, username, profile.sub, profile.picture)
      .run();
    user = { id: userId, username };
  } else {
    // Update google_id and avatar if not set
    await env.DB.prepare(
      "UPDATE users SET google_id = COALESCE(google_id, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
    )
      .bind(profile.sub, profile.picture, user.id)
      .run();
  }

  // Session setup
  const sessionSecret = env.SESSION_SECRET || "dev-secret-change-me";
  let session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  const oldIdentityKey = session ? getIdentityKey(session) : null;

  if (!session) {
    const created = await createSession(sessionSecret);
    session = created.session;
  }

  session.email = profile.email;
  session.userId = user.id;
  session.username = user.username;

  // Migrate anonymous KV data
  if (oldIdentityKey && oldIdentityKey !== user.id) {
    await migrateKvData(oldIdentityKey, user.id);
  }

  const cookie = await updateSession(session, sessionSecret);

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/generate",
      "Set-Cookie": cookie,
    },
  });
};

async function migrateKvData(oldKey: string, newKey: string): Promise<void> {
  // Same migration logic as magic link callback
  const rolls = await env.SESSIONS.get(`rolls:${oldKey}`);
  if (rolls) {
    const existing = parseInt(
      (await env.SESSIONS.get(`rolls:${newKey}`)) || "0",
      10,
    );
    await env.SESSIONS.put(
      `rolls:${newKey}`,
      String(Math.max(existing, parseInt(rolls, 10))),
      { expirationTtl: 30 * 24 * 60 * 60 },
    );
    await env.SESSIONS.delete(`rolls:${oldKey}`);
  }

  const oldDesigns = await env.SESSIONS.get(`designs:${oldKey}`);
  if (oldDesigns) {
    const existingDesigns = JSON.parse(
      (await env.SESSIONS.get(`designs:${newKey}`)) || "[]",
    ) as string[];
    const merged = [
      ...new Set([...existingDesigns, ...JSON.parse(oldDesigns)]),
    ];
    await env.SESSIONS.put(`designs:${newKey}`, JSON.stringify(merged), {
      expirationTtl: 24 * 60 * 60,
    });
    await env.SESSIONS.delete(`designs:${oldKey}`);
  }

  const oldCart = await env.SESSIONS.get(`cart:${oldKey}`);
  if (oldCart) {
    if (!(await env.SESSIONS.get(`cart:${newKey}`))) {
      await env.SESSIONS.put(`cart:${newKey}`, oldCart, {
        expirationTtl: 24 * 60 * 60,
      });
    }
    await env.SESSIONS.delete(`cart:${oldKey}`);
  }

  const oldCredits = await env.SESSIONS.get(`credits:${oldKey}`);
  if (oldCredits) {
    const existing = parseInt(
      (await env.SESSIONS.get(`credits:${newKey}`)) || "0",
      10,
    );
    await env.SESSIONS.put(
      `credits:${newKey}`,
      String(existing + parseInt(oldCredits, 10)),
    );
    await env.SESSIONS.delete(`credits:${oldKey}`);
  }
}
