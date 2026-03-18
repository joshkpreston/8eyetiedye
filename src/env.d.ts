/// <reference types="astro/client" />

declare module "cloudflare:workers" {
  interface Env {
    DB: import("@cloudflare/workers-types").D1Database;
    SESSIONS: import("@cloudflare/workers-types").KVNamespace;
    DESIGNS: import("@cloudflare/workers-types").R2Bucket;
    AI: import("@cloudflare/workers-types").Ai;
    ENVIRONMENT: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    TURNSTILE_SECRET_KEY: string;
    SESSION_SECRET: string;
    FAL_KEY: string;
    PRINTFUL_API_KEY: string;
    PRINTFUL_STORE_ID: string;
    GOOTEN_API_KEY: string;
  }
}
