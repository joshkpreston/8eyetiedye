<script lang="ts">
  interface Product {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    sizes: string[];
  }

  interface Props {
    designId: string;
    rarity: string;
  }

  let { designId, rarity }: Props = $props();

  const products: Product[] = [
    {
      id: "aop-tee",
      name: "All-Over Print Tee",
      description: "Premium unisex tee",
      priceCents: 3999,
      sizes: ["S", "M", "L", "XL", "2XL"],
    },
    {
      id: "aop-hoodie",
      name: "All-Over Print Hoodie",
      description: "Premium unisex hoodie",
      priceCents: 6499,
      sizes: ["S", "M", "L", "XL", "2XL"],
    },
    {
      id: "aop-leggings",
      name: "All-Over Print Leggings",
      description: "Premium leggings",
      priceCents: 4499,
      sizes: ["S", "M", "L", "XL"],
    },
    {
      id: "necktie",
      name: "Tie-Dye Necktie",
      description: "Custom printed necktie",
      priceCents: 2999,
      sizes: ["One Size"],
    },
  ];

  let selectedProduct = $state(products[0]);
  let selectedSize = $state(products[0].sizes[1] || products[0].sizes[0]);
  let isCheckingOut = $state(false);
  let error = $state("");

  function selectProduct(product: Product) {
    selectedProduct = product;
    selectedSize = product.sizes[1] || product.sizes[0];
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  async function checkout() {
    isCheckingOut = true;
    error = "";

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designId,
          productId: selectedProduct.id,
          size: selectedSize,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        error = data.error || "Checkout failed";
        return;
      }

      // Redirect to Stripe
      window.location.href = data.checkoutUrl;
    } catch {
      error = "Something went wrong. Please try again.";
    } finally {
      isCheckingOut = false;
    }
  }
</script>

<div class="space-y-4">
  <h3 class="font-display font-semibold text-lg">Choose Your Product</h3>

  <!-- Product grid -->
  <div class="grid grid-cols-2 gap-2">
    {#each products as product}
      <button
        onclick={() => selectProduct(product)}
        class="p-3 rounded-xl border text-left transition-all {selectedProduct.id ===
        product.id
          ? 'border-purple-500/50 bg-purple-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'}"
      >
        <div class="font-semibold text-sm">{product.name}</div>
        <div class="text-purple-400 font-display font-bold mt-1">
          {formatPrice(product.priceCents)}
        </div>
      </button>
    {/each}
  </div>

  <!-- Size selector -->
  <div>
    <label class="text-sm text-gray-400 mb-2 block">Size</label>
    <div class="flex gap-2 flex-wrap">
      {#each selectedProduct.sizes as size}
        <button
          onclick={() => (selectedSize = size)}
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all {selectedSize ===
          size
            ? 'bg-white text-black'
            : 'bg-white/10 text-gray-300 hover:bg-white/20'}"
        >
          {size}
        </button>
      {/each}
    </div>
  </div>

  {#if error}
    <p class="text-red-400 text-sm">{error}</p>
  {/if}

  <!-- Checkout button -->
  <button
    onclick={checkout}
    disabled={isCheckingOut}
    class="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-wait text-white font-display font-bold text-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
  >
    {#if isCheckingOut}
      Processing...
    {:else}
      Buy {selectedProduct.name} — {formatPrice(selectedProduct.priceCents)}
    {/if}
  </button>

  <p class="text-xs text-gray-500 text-center">
    Secure checkout via Stripe. All designs are AI-generated.
  </p>
</div>
