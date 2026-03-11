# 8EyeTieDye — AI-Generated Tie-Dye Merch

## Stack
- Frontend: Astro 5 + Svelte 5 islands + Tailwind CSS 4
- Backend: Cloudflare Workers
- Database: D1 (orders, designs, credits) + KV (sessions, rate limits)
- Payments: Stripe
- POD: TBD (need API keys)
- AI: TBD (need to evaluate models for tie-dye pattern quality)
- Hosting: CF Pages
- Package manager: pnpm

## Git
- Branch model: `main` (production) + `develop` (staging)
- Never push directly to main — use feature branches

## Compliance
- Account creation: 13+ (COPPA)
- Purchases: 18+ (Stripe)
- No DMs, no user-generated content
- AI disclosure: label generated designs as AI-created

## CodeRabbit
- Trial ends March 18, 2026
