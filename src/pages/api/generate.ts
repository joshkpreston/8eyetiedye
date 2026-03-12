export const prerender = false;

import type { APIRoute } from "astro";
import { rollRarity } from "../../lib/rarity";
import { buildPrompt, type GenerationPreferences } from "../../lib/prompts";
import {
  parseSession,
  createSession,
  updateSession,
  sessionCookieString,
} from "../../lib/session";
import { verifyTurnstile } from "../../lib/turnstile";

const MAX_FREE_ROLLS = 3;
const RATE_LIMIT_PER_DAY = 15;
const DESIGN_TTL_SECONDS = 24 * 60 * 60; // 24 hours

interface GenerateRequest {
  mode: "mystery" | "choose";
  preferences?: GenerationPreferences;
  turnstileToken: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  // Parse request
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  // Verify Turnstile
  if (env.TURNSTILE_SECRET_KEY) {
    const ip = request.headers.get("cf-connecting-ip") || "";
    const valid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      ip,
    );
    if (!valid) {
      return json({ error: "Verification failed" }, 403);
    }
  }

  // Session management
  const sessionSecret = env.SESSION_SECRET || "dev-secret-change-me";
  let session = await parseSession(
    request.headers.get("cookie"),
    sessionSecret,
  );

  let isNewSession = false;
  if (!session) {
    const created = await createSession(sessionSecret);
    session = created.session;
    isNewSession = true;
  }

  // Rate limiting via KV (IP-based fallback)
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateLimitKey = `ratelimit:${ip}:${new Date().toISOString().slice(0, 10)}`;
  const dailyRolls = parseInt(
    (await env.SESSIONS.get(rateLimitKey)) || "0",
    10,
  );
  if (dailyRolls >= RATE_LIMIT_PER_DAY) {
    return json(
      { error: "Daily rate limit reached. Try again tomorrow." },
      429,
    );
  }

  // Roll limit check (session-based)
  const rollCountKey = `rolls:${session.id}`;
  const sessionRolls = parseInt(
    (await env.SESSIONS.get(rollCountKey)) || "0",
    10,
  );

  // Check if user has credits
  let hasCredits = false;
  if (sessionRolls >= MAX_FREE_ROLLS) {
    // Check for paid credits (would need user auth — for now, just cap at free)
    if (!hasCredits) {
      return json(
        {
          error: "No free rolls remaining",
          rollsUsed: sessionRolls,
          maxFreeRolls: MAX_FREE_ROLLS,
          needsCredits: true,
        },
        402,
      );
    }
  }

  // Roll rarity
  const rarity = rollRarity();
  const prompt = buildPrompt(rarity, body.preferences);

  // Generate image via Workers AI
  let imageData: ArrayBuffer;
  try {
    const ai = (env as Record<string, unknown>).AI as {
      run: (
        model: string,
        input: Record<string, unknown>,
      ) => Promise<ArrayBuffer>;
    };

    if (!ai) {
      // Fallback: return a placeholder for local dev
      return json(
        {
          error: "AI binding not available in dev mode",
          designId: crypto.randomUUID(),
          rarity,
          prompt,
          rollsUsed: sessionRolls + 1,
          rollsRemaining: Math.max(0, MAX_FREE_ROLLS - sessionRolls - 1),
          devMode: true,
        },
        200,
      );
    }

    imageData = (await ai.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      width: 1024,
      height: 1024,
      num_steps: 4,
    })) as ArrayBuffer;
  } catch (err) {
    console.error("AI generation failed:", err);
    return json({ error: "Image generation failed" }, 500);
  }

  // Store in R2
  const designId = crypto.randomUUID();
  const r2Key = `designs/${designId}.png`;

  await env.DESIGNS.put(r2Key, imageData, {
    httpMetadata: { contentType: "image/png" },
    customMetadata: {
      rarity,
      prompt,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
    },
  });

  // Store metadata in KV (with 24h TTL)
  await env.SESSIONS.put(
    `design:${designId}`,
    JSON.stringify({
      id: designId,
      r2Key,
      rarity,
      prompt,
      sessionId: session.id,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: DESIGN_TTL_SECONDS },
  );

  // Update roll counts
  await env.SESSIONS.put(rollCountKey, String(sessionRolls + 1), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
  await env.SESSIONS.put(rateLimitKey, String(dailyRolls + 1), {
    expirationTtl: 24 * 60 * 60,
  });

  // Build response
  const headers = new Headers({ "Content-Type": "application/json" });
  if (isNewSession) {
    const cookie = await updateSession(session, sessionSecret);
    headers.set("Set-Cookie", cookie);
  }

  return new Response(
    JSON.stringify({
      designId,
      imageUrl: `/api/design/${designId}/image`,
      rarity,
      rollsUsed: sessionRolls + 1,
      rollsRemaining: Math.max(0, MAX_FREE_ROLLS - sessionRolls - 1),
    }),
    { status: 200, headers },
  );
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
