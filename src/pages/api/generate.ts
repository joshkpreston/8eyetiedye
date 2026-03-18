export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
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
  email?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    return await handleGenerate(request);
  } catch (err) {
    console.error("Unhandled error in generate:", err);
    return json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      500,
    );
  }
};

async function handleGenerate(
  request: Request,
): Promise<Response> {
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
  let creditKey = "";
  let currentCredits = 0;
  if (sessionRolls >= MAX_FREE_ROLLS) {
    // Check for paid credits in KV — by session ID first, then by email
    creditKey = `credits:${session.id}`;
    currentCredits = parseInt(
      (await env.SESSIONS.get(creditKey)) || "0",
      10,
    );

    // If no credits by session ID, check by email (credits purchased via Stripe are keyed by email)
    if (currentCredits <= 0 && body.email) {
      creditKey = `credits:${body.email}`;
      currentCredits = parseInt(
        (await env.SESSIONS.get(creditKey)) || "0",
        10,
      );
    }

    if (currentCredits > 0) {
      hasCredits = true;
    } else {
      return json(
        {
          error: "No free rolls remaining",
          rollsUsed: sessionRolls,
          maxFreeRolls: MAX_FREE_ROLLS,
          needsCredits: true,
          credits: 0,
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
    if (!env.AI) {
      // Fallback: return a placeholder for local dev
      return json(
        {
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

    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt,
      width: 1024,
      height: 1024,
      num_steps: 4,
    });

    // Workers AI may return a ReadableStream or an ArrayBuffer
    if (result instanceof ReadableStream) {
      const reader = result.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) chunks.push(value);
        done = d;
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      imageData = merged.buffer as ArrayBuffer;
    } else if (result instanceof ArrayBuffer) {
      imageData = result;
    } else if (result && typeof result === "object" && "image" in result) {
      // Some models return { image: base64string }
      const b64 = (result as { image: string }).image;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      imageData = bytes.buffer as ArrayBuffer;
    } else {
      throw new Error(`Unexpected AI response type: ${typeof result}`);
    }
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

  // Deduct a credit if the user used paid credits
  if (hasCredits && creditKey) {
    const updatedCredits = currentCredits - 1;
    if (updatedCredits > 0) {
      await env.SESSIONS.put(creditKey, String(updatedCredits));
    } else {
      await env.SESSIONS.delete(creditKey);
    }
    currentCredits = updatedCredits;
  }

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
      ...(hasCredits ? { credits: currentCredits } : {}),
    }),
    { status: 200, headers },
  );
}

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
