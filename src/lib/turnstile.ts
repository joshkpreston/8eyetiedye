const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string,
  secretKey: string,
  ip?: string,
): Promise<boolean> {
  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (ip) {
    body.set("remoteip", ip);
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    body,
  });

  const data = (await res.json()) as { success: boolean };
  return data.success;
}
