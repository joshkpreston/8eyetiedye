<script lang="ts">
  let itemCount = $state(0);

  $effect(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        itemCount = data.itemCount || 0;
      })
      .catch(() => {});
  });

  function scrollToCart() {
    const cartEl = document.getElementById("inline-cart");
    if (cartEl) {
      cartEl.scrollIntoView({ behavior: "smooth" });
    }
  }
</script>

<button
  onclick={scrollToCart}
  class="relative w-10 h-10 rounded-full bg-white/10 text-gray-400 flex items-center justify-center hover:bg-white/20 hover:text-white transition-colors"
  aria-label="Cart ({itemCount} items)"
>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
    />
  </svg>

  {#if itemCount > 0}
    <span
      class="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
    >
      {itemCount > 9 ? "9+" : itemCount}
    </span>
  {/if}
</button>
