# 8EyeTieDye

AI-generated tie-dye merchandise. Every design is unique, scarce, and generated on the fly.

## Concept

Spider mascot brand. Users roll to generate AI tie-dye patterns, then purchase as print-on-demand merch. Two modes:
- **Mystery Mode**: 1 random roll, take it or leave it
- **Choose Mode**: 3 rolls, pick your favorite

Rarity system (Common 70%, Uncommon 20%, Rare 8%, Legendary 1.9%, Mythic 0.1%) drives engagement and credit pack purchases. Roll credits apply toward purchase price.

## Domains

- **Primary**: 8eyetiedye.com
- **Redirects**: 8eyetyedye.com, 8eyetiedie.com, 8itd.com
- **Tie funnel**: tiedyemytie.com → redirects to tie category

## Stack

| Component | Choice |
|-----------|--------|
| Frontend | Astro 5 + Svelte 5 islands |
| AI Generation | TBD (Stable Diffusion / DALL-E) |
| Backend | Cloudflare Workers |
| POD | TBD (Gooten for ties, Printful/Gelato for apparel) |
| Payments | Stripe (checkout + credit packs) |
| Database | D1 + KV |
| Hosting | CF Pages |

## Entity

Kinchito Commerce (kinchitocommerce.com) — ownership on paper, not in GitHub structure.

## Status

Scaffolded — awaiting POD API keys and AI model selection before development.
