const ENCODER = new TextEncoder();

async function getKey(secret: string): Promise<CryptoKey> {
  const keyData = ENCODER.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

async function verify(token: string, secret: string): Promise<string | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = token.substring(0, lastDot);
  const sigHex = token.substring(lastDot + 1);

  const key = await getKey(secret);
  const sigBytes = new Uint8Array(
    sigHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    ENCODER.encode(payload),
  );

  return valid ? payload : null;
}

export interface SessionData {
  id: string;
  rolls: number;
  createdAt: number;
  email?: string;
  userId?: string;
  username?: string;
}

/** Returns the stable identity key for KV lookups (userId if logged in, sessionId otherwise) */
export function getIdentityKey(session: SessionData): string {
  return session.userId || session.id;
}

export async function createSession(secret: string): Promise<{
  session: SessionData;
  cookie: string;
}> {
  const session: SessionData = {
    id: crypto.randomUUID(),
    rolls: 0,
    createdAt: Date.now(),
  };

  const cookie = await sign(JSON.stringify(session), secret);
  return { session, cookie };
}

export async function parseSession(
  cookieHeader: string | null,
  secret: string,
): Promise<SessionData | null> {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies
    .find((c) => c.startsWith("8etd_session="))
    ?.substring("8etd_session=".length);

  if (!sessionCookie) return null;

  const payload = await verify(decodeURIComponent(sessionCookie), secret);
  if (!payload) return null;

  try {
    return JSON.parse(payload) as SessionData;
  } catch {
    return null;
  }
}

export function sessionCookieString(signedValue: string): string {
  return `8etd_session=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`;
}

export async function updateSession(
  session: SessionData,
  secret: string,
): Promise<string> {
  const cookie = await sign(JSON.stringify(session), secret);
  return sessionCookieString(cookie);
}
