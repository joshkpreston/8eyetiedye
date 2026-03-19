<script lang="ts">
  import { MYSTERY_PACKS } from "../lib/mystery-packs";

  let purchasing = $state<string | null>(null);

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function pricePerDesign(cents: number, count: number): string {
    return `$${(cents / count / 100).toFixed(2)}/ea`;
  }

  async function buyPack(packId: string) {
    purchasing = packId;
    try {
      const res = await fetch("/api/mystery-pack/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      // Silently fail
    } finally {
      purchasing = null;
    }
  }
</script>

<div class="mt-12 pt-8 border-t border-white/5">
  <div class="text-center mb-6">
    <h3 class="font-display font-semibold text-lg text-white mb-1">
      Mystery Design Packs
    </h3>
    <p class="text-gray-500 text-sm">
      Get multiple unique designs at once — the more you buy, the more you save
    </p>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    {#each MYSTERY_PACKS as pack, i}
      <button
        onclick={() => buyPack(pack.id)}
        disabled={purchasing === pack.id}
        class="p-4 rounded-xl border text-center transition-all hover:scale-[1.02]
          {i === 1
          ? 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15'
          : i === MYSTERY_PACKS.length - 1
            ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15'
            : 'border-white/10 bg-white/5 hover:bg-white/10'}"
      >
        <div class="font-display font-bold text-lg">{pack.label}</div>
        <div
          class="font-display font-bold mt-1 {i === MYSTERY_PACKS.length - 1
            ? 'text-amber-400'
            : 'text-purple-400'}"
        >
          {formatPrice(pack.priceCents)}
        </div>
        <div class="text-gray-500 text-xs mt-1">
          {pricePerDesign(pack.priceCents, pack.count)}
        </div>
        {#if pack.savings}
          <div class="text-green-400 text-xs font-semibold mt-1">
            Save {pack.savings}
          </div>
        {/if}
        {#if purchasing === pack.id}
          <div class="text-gray-400 text-xs mt-1">Processing...</div>
        {/if}
      </button>
    {/each}
  </div>
</div>
