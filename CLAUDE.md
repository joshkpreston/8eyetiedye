# 8EyeTieDye — AI-Generated Tie-Dye Merch

## Stack

- Frontend: Astro 5 + Svelte 5 islands + Tailwind CSS 4
- Backend: Cloudflare Workers (via Astro CF adapter)
- Database: D1 (orders, designs, users) + KV (sessions, rate limits)
- Storage: R2 (design images)
- Payments: Stripe
- POD: Printful (apparel) + Gooten (neckties)
- AI: CF Workers AI (preview) + fal.ai FLUX.2 Dev (production quality)
- Hosting: CF Pages
- Package manager: pnpm

## Git

- Branch model: `main` (production) → `staging` (preview) → `develop` (active dev)
- Never push directly to main — use feature branches off develop
- CI auto-merges develop → staging on check pass

## Key Directories

- `src/pages/` — Astro pages + API routes
- `src/components/` — Svelte 5 islands + Astro components
- `src/layouts/` — Astro layout templates
- `src/lib/` — Shared utilities (prompts, rarity, session, stripe, POD)
- `src/styles/` — Global CSS (Tailwind v4)
- `db/` — D1 schema SQL
- `public/` — Static assets (templates, sounds, images)

## Compliance

- Account creation: 13+ (COPPA)
- Purchases: 18+ (Stripe)
- No DMs, no user-generated content
- AI disclosure: label generated designs as AI-created

## CodeRabbit

- Trial ends March 18, 2026
