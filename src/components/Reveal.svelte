<script lang="ts">
  interface Props {
    imageUrl: string;
    rarity: string;
    onComplete: () => void;
  }

  let { imageUrl, rarity, onComplete }: Props = $props();

  const RARITY_CONFIG: Record<string, { glow: string; label: string }> = {
    common: { glow: "shadow-gray-500/30", label: "Common" },
    uncommon: { glow: "shadow-green-500/30", label: "Uncommon" },
    rare: { glow: "shadow-purple-500/50", label: "Rare" },
    legendary: { glow: "shadow-amber-500/50", label: "Legendary" },
    mythic: { glow: "shadow-red-500/60", label: "Mythic" },
  };

  let phase = $state<"anticipation" | "burst" | "reveal" | "done">(
    "anticipation",
  );
  let config = $derived(RARITY_CONFIG[rarity] || RARITY_CONFIG.common);

  $effect(() => {
    // Phase 1: Anticipation (0.8s)
    const t1 = setTimeout(() => (phase = "burst"), 800);

    // Phase 2: Color burst (0.6s)
    const t2 = setTimeout(() => (phase = "reveal"), 1400);

    // Phase 3: Reveal settles (1s)
    const t3 = setTimeout(() => {
      phase = "done";
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  });
</script>

<div class="relative w-full max-w-md mx-auto">
  <!-- Backdrop glow -->
  {#if phase === "burst" || phase === "reveal" || phase === "done"}
    <div
      class="absolute inset-0 rounded-2xl blur-3xl opacity-40 transition-opacity duration-1000 {config.glow}"
      style="box-shadow: 0 0 80px currentColor;"
    ></div>
  {/if}

  <!-- Main reveal container -->
  <div
    class="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl {config.glow}"
  >
    {#if phase === "anticipation"}
      <!-- Anticipation: spinning web pattern -->
      <div
        class="aspect-square bg-surface-700 flex items-center justify-center animate-pulse"
      >
        <div class="text-center">
          <div class="animate-spin" style="animation-duration: 2s;">
            <img
              src="/spider.svg"
              alt="Doobie spinning"
              class="w-16 h-16 mx-auto"
            />
          </div>
          <p class="text-gray-500 text-sm mt-4 font-display">
            Spinning the web...
          </p>
        </div>
      </div>
    {:else if phase === "burst"}
      <!-- Color burst -->
      <div class="aspect-square relative overflow-hidden">
        <div class="absolute inset-0 dye-gradient-hero animate-pulse"></div>
        <div
          class="absolute inset-0 bg-surface-900/80 flex items-center justify-center"
        >
          <div class="text-6xl">✨</div>
        </div>
      </div>
    {:else}
      <!-- Reveal: show image -->
      <div class="aspect-square relative">
        <img
          src={imageUrl}
          alt="Your unique tie-dye design"
          class="w-full h-full object-cover transition-transform duration-500 {phase ===
          'reveal'
            ? 'scale-110'
            : 'scale-100'}"
        />
        <!-- Rarity badge overlay -->
        <div
          class="absolute bottom-4 left-4 right-4 flex justify-center transition-all duration-500 {phase ===
          'done'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'}"
        >
          <span
            class="px-6 py-2 rounded-full font-display font-bold text-sm backdrop-blur-md bg-black/60 border {rarity ===
            'mythic'
              ? 'border-red-500/50 text-red-400'
              : rarity === 'legendary'
                ? 'border-amber-500/50 text-amber-400'
                : rarity === 'rare'
                  ? 'border-purple-500/50 text-purple-400'
                  : rarity === 'uncommon'
                    ? 'border-green-500/50 text-green-400'
                    : 'border-gray-500/30 text-gray-400'}"
          >
            {config.label}
          </span>
        </div>
      </div>
    {/if}
  </div>
</div>
