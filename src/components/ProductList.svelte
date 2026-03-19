<script lang="ts">
  import { PRODUCTS } from "../lib/products";

  interface Props {
    designId: string;
    designName: string;
    rarity: string;
    oncartupdate?: () => void;
  }

  let { designId, designName, rarity, oncartupdate }: Props = $props();

  let selectedSizes: Record<string, string> = $state({});
  let addingProduct: string | null = $state(null);
  let addedProduct: string | null = $state(null);

  function getSize(productId: string, sizes: string[]): string {
    return selectedSizes[productId] || sizes[1] || sizes[0];
  }

  function setSize(productId: string, size: string) {
    selectedSizes = { ...selectedSizes, [productId]: size };
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function addToCart(productId: string, size: string) {
    addingProduct = productId;
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, designName, productId, size }),
      });

      if (res.ok) {
        addedProduct = productId;
        setTimeout(() => {
          addedProduct = null;
        }, 1500);
        oncartupdate?.();
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      addingProduct = null;
    }
  }
</script>

<div class="space-y-2">
  {#each PRODUCTS as product}
    {@const size = getSize(product.id, product.sizes)}
    <div
      class="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
    >
      <!-- Product image placeholder -->
      <div
        class="w-14 h-14 rounded-lg bg-white/5 shrink-0 flex items-center justify-center text-gray-600 text-xs"
      >
        {#if product.image}
          <img
            src={product.image}
            alt={product.name}
            class="w-full h-full object-cover rounded-lg"
          />
        {:else}
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        {/if}
      </div>

      <div class="flex-1 min-w-0">
        <!-- Product name + price -->
        <div class="flex items-baseline justify-between mb-1.5">
          <span class="text-sm font-semibold text-white truncate">
            {product.name}
          </span>
          <span class="text-sm font-display font-bold text-purple-400 ml-2 shrink-0">
            {formatPrice(product.priceCents)}
          </span>
        </div>

        <!-- Size selector -->
        <div class="flex items-center gap-1 mb-2">
          {#each product.sizes as s}
            <button
              onclick={() => setSize(product.id, s)}
              class="px-2 py-0.5 text-xs rounded-md transition-all {size === s
                ? 'bg-white text-black font-medium'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'}"
            >
              {s}
            </button>
          {/each}
        </div>

        <!-- Add to cart button -->
        <button
          onclick={() => addToCart(product.id, size)}
          disabled={addingProduct === product.id}
          class="w-full py-1.5 text-xs font-semibold rounded-lg transition-all
            {addedProduct === product.id
            ? 'bg-green-600 text-white'
            : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/20'}"
        >
          {#if addedProduct === product.id}
            Added!
          {:else if addingProduct === product.id}
            Adding...
          {:else}
            + Add to Cart
          {/if}
        </button>
      </div>
    </div>
  {/each}
</div>
