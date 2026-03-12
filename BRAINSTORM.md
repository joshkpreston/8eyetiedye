# 8EyeTieDye — AI-Generated Tie-Dye Merch

_Date: 2026-03-10_
_Status: Brainstorming_
_Primary: 8eyetiedye.com (main brand) + tiedyemytie.com (tie category / funnel)_
_Redirects: 8eyetyedye.com, 8eyetiedie.com, 8itd.com, tyedyemytie.com, tydymyty.com_
_Entity: Kinchito Commerce (kinchitocommerce.com)_

## Concept

Spider mascot brand selling AI-generated tie-dye merchandise (shirts, hoodies, etc.) via print-on-demand. Every design is **truly unique and scarce** — generated on the fly, never repeated.

## Key Mechanic: Generate-to-Order

Two modes for getting a design:

### 1. Mystery Mode (Default)

- Customer hits "Spin the Web" (or similar spider-themed CTA)
- AI generates a completely random tie-dye pattern
- One shot — you get what you get
- Emphasizes scarcity: "This design will never exist again"

### 2. Choose Mode (3 Rolls)

- Customer gets **3 rolls** — each generates a unique tie-dye pattern
- Can influence with preferences (color palette, intensity, pattern style)
- All 3 designs are shown side by side — **pick any one of the 3**
- After 3 rolls, that's it — pick your favorite or walk away
- Unpurchased designs vanish forever — true scarcity
- Creates urgency + FOMO — "you only get 3 chances"

## Why This Works

- **True scarcity** — every item is 1-of-1, verifiably unique
- **No inventory risk** — POD fulfillment (Printful/Gooten/Gelato)
- **Engagement** — the generation process IS the shopping experience
- **Shareability** — "look what I got" social content
- **Low competition** — AI-generated + POD + tie-dye is an uncrowded niche
- **Spider brand** — 8 eyes = 8EyeTieDye, memorable + quirky mascot potential

## Brand Identity

- **Name**: 8EyeTieDye (eight-eye-tie-dye)
- **Mascot**: Friendly/cool spider character — 8 eyes seeing infinite patterns
- **Vibe**: Fun, psychedelic, slightly weird, Gen Z / millennial appeal
- **Tagline ideas**: "Spun Just For You", "No Two Webs Alike", "8 Eyes. Infinite Patterns."
- **Logo idea**: Backwards Y in "tye" as brand mark on shirts

## Product Line (Start Small)

1. T-shirts (unisex) — anchor product
2. Hoodies
3. Neckties / bowties (via tiedyemytie.com funnel)
4. Phone cases
5. Tote bags
6. Stickers (low cost impulse buy)

## Technical Stack

| Component     | Choice                          | Notes                                       |
| ------------- | ------------------------------- | ------------------------------------------- |
| Frontend      | Astro 5 + Svelte 5 islands      | Interactive generation UI                   |
| AI Generation | TBD (Stable Diffusion / DALL-E) | Tie-dye pattern generation                  |
| Backend       | CF Workers                      | Generation requests, rate limiting, credits |
| POD — Apparel | Printful or Gelato              | T-shirts, hoodies (US-based, API)           |
| POD — Ties    | Gooten ($11.90 base, REST API)  | Only US-based POD with ties + API           |
| Payments      | Stripe                          | Checkout + credit pack microtransactions    |
| Hosting       | CF Pages                        | Static shell + dynamic Svelte islands       |
| Database      | D1 + KV                         | Orders, designs, credits, sessions          |

### POD Research Notes

- **Gooten**: Only US-based POD with neckties + API. $11.90 base, REST/JSON API. Mixed reviews (80% print accuracy, slow support). Good for ties.
- **Printful**: No ties, but best quality for apparel. Great API.
- **Gelato**: No ties, rated highest overall for quality/speed/support. 100+ print partners in 32 countries.
- **Recommendation**: Gooten for ties, Printful or Gelato for everything else.
- **Sublimation printing** is ideal for tie-dye — ink penetrates fibers, won't crack/peel/fade, full all-over coverage.

## Revenue Model

- Markup on POD base cost (typical 40-60% margin on apparel)
- Limited drops / collabs — curated AI collections

### Roll Economics (Anti-Abuse + Cost Recovery)

**Problem**: AI image generation costs ~$0.04-0.10 per call. Without limits, people will roll endlessly and never buy.

**Solution**: 3 free rolls → paid rolls after that

| Tier        | Rolls    | Cost       | Notes                                           |
| ----------- | -------- | ---------- | ----------------------------------------------- |
| Free        | 3        | $0         | Baked into product margin. Enough to hook them. |
| Extra rolls | Per roll | $0.50-1.00 | Stripe microtransaction                         |
| Roll pack   | 5 rolls  | $3         | Bulk discount, stored as credits in account     |
| Roll pack   | 15 rolls | $7         | Power users / collectors                        |

**Key rule: Roll credits apply to purchase price.** If someone spends $3 on extra rolls and then buys a $28 shirt, they pay $25. No one feels ripped off — they're pre-paying toward their purchase, not wasting money.

**Abuse prevention**:

- 3 free rolls per session (fingerprint + IP, no account required)
- Extra rolls require account + payment method on file
- Rate limit: max 30 rolls/day even with credits
- Generated designs expire after 24 hours if not purchased

## Rarity System

Every roll has a rarity tier — determined randomly on generation. Rarer tiers use more complex/exotic AI prompts.

| Tier      | Drop Rate | Visual               | What Makes It Special                                                      |
| --------- | --------- | -------------------- | -------------------------------------------------------------------------- |
| Common    | 70%       | Standard reveal      | Classic tie-dye patterns, solid color combos                               |
| Uncommon  | 20%       | Green glow           | Bolder colors, more complex swirls, higher contrast                        |
| Rare      | 8%        | Purple flash         | Metallic/iridescent effects, unusual color combos, layered patterns        |
| Legendary | 1.9%      | Gold explosion       | Animated-looking patterns, spider web overlays, multi-technique fusion     |
| Mythic    | 0.1%      | Full-screen takeover | Insane 1-in-1000 design + ships with numbered holographic authenticity tag |

### Reveal Experience

- Each roll gets a "web spin" animation — spider spins, colors swirl in
- Rarity tier flashes AFTER the design loads (builds anticipation)
- Brief color tease before full reveal — they _almost_ know what tier before it drops
- Sound effects scale with rarity (subtle → epic)
- Legendary+ rolls get confetti / screen shake

### Why Rarity Drives Revenue

- People burn through credit packs chasing Legendaries
- Rare+ drops get screenshotted and shared — free marketing
- "I got a Mythic" is instant social proof / flex
- 24-hour expiry + rare drop = panic buy ("I HAVE to buy this Legendary")
- Mythic holographic tag makes it a physical collectible, not just a shirt
- Creates a reason to keep rolling beyond "I want a nice pattern"

### Gallery / Social

- Public gallery of purchased Rare+ designs (with buyer permission)
- "Rarest drops this week" leaderboard
- Share button on reveal screen — pre-formatted for Instagram/TikTok

## Open Questions

- Which AI model produces the best tie-dye patterns?
- How to ensure designs print well on fabric (color gamut, resolution)?
- Session-based roll tracking vs account-based?
- Should generated-but-not-purchased designs be shown in a "gallery" or lost forever?
- Legal: any IP concerns with AI-generated designs on merchandise?

## Compliance

- Standard e-commerce: 18+ for purchases (Stripe)
- No user accounts needed for browsing/generating
- Account creation for order tracking: 13+
- FTC disclosure if any affiliate/referral component
