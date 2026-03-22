<script lang="ts">
  interface GalleryDesign {
    id: string;
    name: string;
    username: string;
    rarity: string;
    image_url: string;
    created_at: string;
  }

  let designs = $state<GalleryDesign[]>([]);
  let loading = $state(true);
  let page = $state(1);
  let hasMore = $state(false);
  let loadingMore = $state(false);
  let activeFilter = $state("all");
  let hoveredId = $state<string | null>(null);

  const RARITY_FILTERS = [
    "all",
    "common",
    "uncommon",
    "rare",
    "legendary",
    "mythic",
  ];

  const RARITY_COLORS: Record<string, string> = {
    common: "bg-gray-500",
    uncommon: "bg-green-500",
    rare: "bg-blue-500",
    legendary: "bg-amber-500",
    mythic: "bg-red-500",
  };

  $effect(() => {
    loadDesigns(true);
  });

  async function loadDesigns(reset = false) {
    if (reset) {
      page = 1;
      loading = true;
    } else {
      loadingMore = true;
    }

    try {
      const res = await fetch(
        `/api/gallery?page=${page}&limit=60&rarity=${activeFilter}`,
      );
      const data = await res.json();

      if (reset) {
        designs = data.designs;
      } else {
        designs = [...designs, ...data.designs];
      }
      hasMore = data.hasMore;
    } catch {
      // Silent fail
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  function loadNext() {
    page += 1;
    loadDesigns(false);
  }

  function setFilter(filter: string) {
    activeFilter = filter;
    loadDesigns(true);
  }

  // Infinite scroll
  function handleScroll() {
    if (loadingMore || !hasMore) return;
    const scrollBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (scrollBottom) {
      loadNext();
    }
  }
</script>

<svelte:window onscroll={handleScroll} />

<!-- Rarity filter tabs -->
<div class="flex gap-2 mb-6 overflow-x-auto pb-2">
  {#each RARITY_FILTERS as filter}
    <button
      onclick={() => setFilter(filter)}
      class="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
        {activeFilter === filter
        ? 'bg-white text-black'
        : 'bg-white/5 text-gray-400 hover:bg-white/10'}"
    >
      {filter === "all"
        ? "All"
        : filter.charAt(0).toUpperCase() + filter.slice(1)}
    </button>
  {/each}
</div>

{#if loading}
  <div class="text-center py-20">
    <p class="text-gray-400">Loading designs...</p>
  </div>
{:else if designs.length === 0}
  <div class="text-center py-20">
    <p class="text-gray-400">No designs found. Start rolling!</p>
  </div>
{:else}
  <!-- Tile grid -->
  <div
    class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1"
  >
    {#each designs as design}
      <a
        href="/design/{design.id}"
        class="relative aspect-square group block"
        onmouseenter={() => (hoveredId = design.id)}
        onmouseleave={() => (hoveredId = null)}
        onfocus={() => (hoveredId = design.id)}
        onblur={() => (hoveredId = null)}
        aria-label="{design.name || 'Untitled'} by {design.username || 'Anonymous'}, {design.rarity} rarity"
      >
        <img
          src={design.image_url || `/api/design/${design.id}/image`}
          alt="{design.name || 'Design'} — {design.rarity} rarity by {design.username || 'Anonymous'}"
          class="w-full h-full object-cover"
          loading="lazy"
        />

        <!-- Hover overlay -->
        <span
          class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-2 transition-opacity
            {hoveredId === design.id ? 'opacity-100' : 'opacity-0'}"
          aria-hidden="true"
        >
          <span
            class="w-2 h-2 rounded-full mb-1 {RARITY_COLORS[design.rarity] ||
              'bg-gray-500'}"
          ></span>
          <span
            class="text-white text-xs font-semibold text-center leading-tight mb-0.5"
          >
            {design.name || "Untitled"}
          </span>
          <span class="text-gray-400 text-[10px] mb-2">
            by {design.username || "Anonymous"}
          </span>
          <span
            class="px-3 py-1 bg-purple-600 text-white text-[10px] font-semibold rounded-lg"
          >
            View Design
          </span>
        </span>
      </a>
    {/each}
  </div>

  {#if loadingMore}
    <div class="text-center py-8">
      <p class="text-gray-400 text-sm">Loading more...</p>
    </div>
  {/if}
{/if}
