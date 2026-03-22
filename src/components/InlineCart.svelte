<script lang="ts">
  interface CartItem {
    designId: string;
    designName: string;
    productId: string;
    size: string;
    quantity: number;
    priceCents: number;
    rarity: string;
  }

  interface CartData {
    items: CartItem[];
    totalCents: number;
    itemCount: number;
  }

  interface Props {
    refreshTrigger?: number;
  }

  let { refreshTrigger = 0 }: Props = $props();

  let cart = $state<CartData>({ items: [], totalCents: 0, itemCount: 0 });
  let isCheckingOut = $state(false);
  let error = $state("");

  $effect(() => {
    // Re-fetch when refreshTrigger changes
    void refreshTrigger;
    fetchCart();
  });

  async function fetchCart() {
    try {
      const res = await fetch("/api/cart");
      if (res.ok) {
        cart = await res.json();
      }
    } catch {
      // Silent fail
    }
  }

  async function updateQuantity(index: number, quantity: number) {
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, quantity }),
      });
      if (res.ok) {
        cart = await res.json();
      }
    } catch {
      // Silent fail
    }
  }

  async function removeItem(index: number) {
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (res.ok) {
        cart = await res.json();
      }
    } catch {
      // Silent fail
    }
  }

  async function checkout() {
    if (cart.items.length === 0) return;
    isCheckingOut = true;
    error = "";

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromCart: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || "Checkout failed";
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch {
      error = "Something went wrong. Please try again.";
    } finally {
      isCheckingOut = false;
    }
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // Group items by design
  function groupByDesign(items: CartItem[]): {
    designName: string;
    rarity: string;
    items: (CartItem & { globalIndex: number })[];
  }[] {
    const groups: Map<
      string,
      {
        designName: string;
        rarity: string;
        items: (CartItem & { globalIndex: number })[];
      }
    > = new Map();

    items.forEach((item, index) => {
      const key = item.designId;
      if (!groups.has(key)) {
        groups.set(key, {
          designName: item.designName,
          rarity: item.rarity,
          items: [],
        });
      }
      groups.get(key)!.items.push({ ...item, globalIndex: index });
    });

    return Array.from(groups.values());
  }

  const PRODUCT_NAMES: Record<string, string> = {
    "aop-tee": "Tee",
    "aop-hoodie": "Hoodie",
    "aop-leggings": "Leggings",
    necktie: "Necktie",
  };
</script>

<div id="inline-cart" class="border-t border-white/10 pt-4">
  <h3
    class="font-display font-semibold text-sm text-gray-300 mb-3 flex items-center gap-2"
  >
    Your Cart
    {#if cart.itemCount > 0}
      <span
        class="px-1.5 py-0.5 bg-purple-600/30 text-purple-300 text-xs rounded-full"
      >
        {cart.itemCount}
      </span>
    {/if}
  </h3>

  {#if cart.items.length === 0}
    <p class="text-gray-400 text-sm py-4 text-center">
      Your cart is empty — add items above
    </p>
  {:else}
    <div class="space-y-3 mb-4">
      {#each groupByDesign(cart.items) as group}
        <!-- Design group header -->
        <div>
          <p
            class="text-xs font-semibold text-gray-400 mb-1.5 flex items-center gap-1.5"
          >
            <span
              class="w-1.5 h-1.5 rounded-full {group.rarity === 'mythic'
                ? 'bg-red-500'
                : group.rarity === 'legendary'
                  ? 'bg-amber-500'
                  : group.rarity === 'rare'
                    ? 'bg-blue-500'
                    : group.rarity === 'uncommon'
                      ? 'bg-green-500'
                      : 'bg-gray-500'}"
            ></span>
            {group.designName}
          </p>

          <!-- Items under this design -->
          {#each group.items as item}
            <div class="flex items-center gap-2 py-1.5 pl-3 text-sm group/item">
              <div class="flex-1 min-w-0">
                <span class="text-gray-300">
                  {PRODUCT_NAMES[item.productId] || item.productId}
                </span>
                <span class="text-gray-400 text-xs ml-1">({item.size})</span>
              </div>

              <!-- Quantity controls -->
              <div class="flex items-center gap-1">
                <button
                  onclick={() =>
                    updateQuantity(item.globalIndex, item.quantity - 1)}
                  class="w-6 h-6 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white flex items-center justify-center text-xs transition-colors"
                  aria-label="Decrease quantity of {PRODUCT_NAMES[item.productId] || item.productId}"
                >
                  -
                </button>
                <span class="text-xs text-gray-300 w-4 text-center">
                  {item.quantity}
                </span>
                <button
                  onclick={() =>
                    updateQuantity(item.globalIndex, item.quantity + 1)}
                  class="w-6 h-6 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white flex items-center justify-center text-xs transition-colors"
                  aria-label="Increase quantity of {PRODUCT_NAMES[item.productId] || item.productId}"
                >
                  +
                </button>
              </div>

              <!-- Price -->
              <span class="text-xs text-gray-400 w-14 text-right">
                {formatPrice(item.priceCents * item.quantity)}
              </span>

              <!-- Remove -->
              <button
                onclick={() => removeItem(item.globalIndex)}
                class="text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                aria-label="Remove item"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Subtotal -->
    <div
      class="flex items-center justify-between py-3 border-t border-white/10 mb-3"
    >
      <span class="text-sm text-gray-400">Subtotal</span>
      <span class="font-display font-bold text-white">
        {formatPrice(cart.totalCents)}
      </span>
    </div>

    {#if error}
      <p class="text-red-400 text-xs mb-2" role="alert">{error}</p>
    {/if}

    <!-- Checkout button -->
    <button
      onclick={checkout}
      disabled={isCheckingOut}
      class="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-display font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
    >
      {#if isCheckingOut}
        Processing...
      {:else}
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Checkout — {formatPrice(cart.totalCents)}
      {/if}
    </button>
  {/if}
</div>
