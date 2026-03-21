export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
  parseSession,
  createSession,
  updateSession,
  getIdentityKey,
  requireSessionSecret,
  type SessionData,
} from "../../../lib/session";
import { generateUsername } from "../../../lib/names";

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return redirect("/generate?auth=error");
  }

  // Validate token
  const tokenData = await env.SESSIONS.get(`magic:${token}`);
  if (!tokenData) {
    return redirect("/generate?auth=expired");
  }

  const { email } = JSON.parse(tokenData) as { email: string };

  // Consume the token (one-time use)
  await env.SESSIONS.delete(`magic:${token}`);

  // Upsert user in D1
  let user = await env.DB.prepare(
    "SELECT id, username FROM users WHERE email = ?",
  )
    .bind(email)
    .first<{ id: string; username: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    const username = generateUsername();
    await env.DB.prepare(
      "INSERT INTO users (id, email, username) VALUES (?, ?, ?)",
    )
      .bind(userId, email, username)
      .run();
    user = { id: userId, username };
  }

  // Get or create session
  const sessionSecret = requireSessionSecret(env.SESSION_SECRET);
  let session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  const oldIdentityKey = session ? getIdentityKey(session) : null;

  if (!session) {
    const created = await createSession(sessionSecret);
    session = created.session;
  }

  // Upgrade session with user info
  session.email = email;
  session.userId = user.id;
  session.username = user.username;

  // Migrate anonymous KV data to user-keyed entries
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
  // Migrate rolls
  const rolls = await env.SESSIONS.get(`rolls:${oldKey}`);
  if (rolls) {
    const existing = parseInt(
      (await env.SESSIONS.get(`rolls:${newKey}`)) || "0",
      10,
    );
    const oldRolls = parseInt(rolls, 10);
    // Keep the higher value (user may have rolled on both)
    await env.SESSIONS.put(
      `rolls:${newKey}`,
      String(Math.max(existing, oldRolls)),
      { expirationTtl: 30 * 24 * 60 * 60 },
    );
    await env.SESSIONS.delete(`rolls:${oldKey}`);
  }

  // Migrate designs list
  const oldDesigns = await env.SESSIONS.get(`designs:${oldKey}`);
  if (oldDesigns) {
    const existingDesigns = JSON.parse(
      (await env.SESSIONS.get(`designs:${newKey}`)) || "[]",
    ) as string[];
    const oldList = JSON.parse(oldDesigns) as string[];
    const merged = [...new Set([...existingDesigns, ...oldList])];
    await env.SESSIONS.put(`designs:${newKey}`, JSON.stringify(merged), {
      expirationTtl: 24 * 60 * 60,
    });
    await env.SESSIONS.delete(`designs:${oldKey}`);
  }

  // Migrate cart
  const oldCart = await env.SESSIONS.get(`cart:${oldKey}`);
  if (oldCart) {
    const existingCart = await env.SESSIONS.get(`cart:${newKey}`);
    if (!existingCart) {
      await env.SESSIONS.put(`cart:${newKey}`, oldCart, {
        expirationTtl: 24 * 60 * 60,
      });
    }
    await env.SESSIONS.delete(`cart:${oldKey}`);
  }

  // Migrate credits
  const oldCredits = await env.SESSIONS.get(`credits:${oldKey}`);
  if (oldCredits) {
    const existing = parseInt(
      (await env.SESSIONS.get(`credits:${newKey}`)) || "0",
      10,
    );
    const old = parseInt(oldCredits, 10);
    await env.SESSIONS.put(`credits:${newKey}`, String(existing + old));
    await env.SESSIONS.delete(`credits:${oldKey}`);
  }
}
