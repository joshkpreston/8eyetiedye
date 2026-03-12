/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;
type KVNamespace = import("@cloudflare/workers-types").KVNamespace;
type R2Bucket = import("@cloudflare/workers-types").R2Bucket;

type Runtime = import("@astrojs/cloudflare").Runtime<{
  DB: D1Database;
  SESSIONS: KVNamespace;
  DESIGNS: R2Bucket;
  ENVIRONMENT: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  SESSION_SECRET: string;
  FAL_KEY: string;
  PRINTFUL_API_KEY: string;
  GOOTEN_API_KEY: string;
}>;

declare namespace App {
  interface Locals extends Runtime {}
}
