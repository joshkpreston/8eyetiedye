# 8EyeTieDye — AI-Generated Tie-Dye Merch

## Stack

- **Framework:** Astro 5 + Svelte 5 islands + Tailwind CSS 4
- **Hosting:** Cloudflare Pages
- **API:** Cloudflare Workers (via Astro CF adapter)
- **Database:** Cloudflare D1 (orders, designs, users)
- **Cache:** Cloudflare KV (sessions, rate limits, cart, credits)
- **Storage:** Cloudflare R2 (design images)
- **Payments:** Stripe
- **POD:** Printful (apparel) + Gooten (neckties)
- **AI:** CF Workers AI (FLUX.1 Schnell + SDXL fallback)
- **Email:** Resend (magic link auth)
- **Package manager:** pnpm

## Architecture

```
Customer Browser (Astro 5 + Svelte 5 on CF Pages)
         |
         v
   CF Workers API (Edge Functions)
         |
    +----+----+----+
    |    |    |    |
    v    v    v    v
 Stripe  Printful  Workers AI  Resend
  API     API      (FLUX/SDXL)  (Email)
    |      |         |
    v      v         v
 Payment  Fulfill   Design
 Confirm  + Ship    Generation
    |      |         |
    +----+-+----+----+
         |
         v
   CF D1 (Orders, Designs, Users)
   CF KV (Sessions, Cart, Credits)
   CF R2 (Design Images)
```

## E-Commerce Order Flow

1. Customer generates AI tie-dye design (or browses gallery / buys mystery pack)
2. Adds items to cart (KV-backed, persists across navigation)
3. Checkout → CF Worker creates Stripe Checkout Session (single or multi-item)
4. Stripe handles payment, fires `checkout.session.completed` webhook
5. CF Worker receives webhook → verifies signature → creates order group in D1
6. CF Worker creates Printful/Gooten order(s) via API (design images served from R2)
7. POD provider prints & ships → fires webhook
8. CF Worker updates D1 order status + tracking info
9. Customer tracks order at /order/{id}

### Critical Integration Rules

- **Always verify** Stripe webhook signatures
- **Always hash** IP addresses for rate limiting (SHA-256, never store raw IPs)
- **Pre-store** all design images in R2 — Printful downloads from our image URL at order time
- **Cache** activity feed in KV with 30-second TTL
- **Designs expire** from gallery after 30 days (purchased designs persist permanently)
- **Queue failed orders** — log POD failures but don't block webhook response

## Key Directories

- `src/pages/` — Astro pages + API routes
- `src/components/` — Svelte 5 islands + Astro components
- `src/layouts/` — Astro layout templates
- `src/lib/` — Shared utilities (prompts, rarity, session, stripe, POD, names, email)
- `src/styles/` — Global CSS (Tailwind v4)
- `db/` — D1 schema + migrations
- `public/` — Static assets (templates, sounds, images)

## Development

```bash
pnpm install     # Install dependencies
pnpm dev         # Dev server
pnpm build       # Build to dist/
pnpm preview     # Preview built site
```

## Git

- **Repo:** github.com/joshkpreston/8eyetiedye
- **Identity:** joshkpreston

### Branch Strategy (Three-Branch Model)

```text
develop   → code here, all commits land on develop
staging   → updated via PR from develop (auto)
main      → production, updated via PR from staging (manual)
```

### CI/CD Pipeline

```text
develop push  → CI checks → auto-create PR develop→staging → CodeRabbit reviews
CodeRabbit clean → merge PR → auto-deploy staging + smoke test
manual review on staging → create PR staging→main
merge PR → auto-deploy production + smoke test
```

### Rules

- **NEVER** push directly to `main` or `staging`
- All work happens on `develop` (or feature branches merged into develop)
- Push to develop auto-creates a PR to staging — CodeRabbit reviews it
- Once CodeRabbit approves, merge the PR — staging deploys automatically
- After reviewing staging manually, create a PR staging→main
- Merging to main auto-deploys to production
- Staging uses sandbox/test API keys, production uses live keys

### Workflow

1. User describes features
2. Build on `develop` (or feature branch → PR to develop)
3. Verify build passes (`pnpm build`)
4. Commit, push, create PR to develop if on feature branch
5. **Do not ask permission** for routine git ops — just do it
6. CI/CD handles the rest through to staging for testing

## Compliance

- Account creation: 13+ (COPPA)
- Purchases: 18+ (Stripe)
- No DMs, no user-generated content
- AI disclosure: label generated designs as AI-created
- No raw IP storage — hash all IPs for rate limiting (GDPR/CCPA safe)
