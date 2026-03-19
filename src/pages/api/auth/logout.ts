export const prerender = false;

import type { APIRoute } from "astro";

export const POST: APIRoute = async () => {
  // Clear the session cookie
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie":
        "8etd_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    },
  });
};
