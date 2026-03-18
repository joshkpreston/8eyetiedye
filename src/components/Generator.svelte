<script lang="ts">
  import ColorPicker from "./ColorPicker.svelte";
  import Reveal from "./Reveal.svelte";
  import RarityBadge from "./RarityBadge.svelte";
  import ProductSelector from "./ProductSelector.svelte";

  type Mode = "mystery" | "choose";
  type State = "idle" | "generating" | "revealing" | "result";

  interface Design {
    designId: string;
    imageUrl: string;
    rarity: string;
    rollsUsed: number;
    rollsRemaining: number;
    credits?: number;
  }

  let mode = $state<Mode>("mystery");
  let state = $state<State>("idle");
  let selectedPalette = $state("classic");
  let error = $state("");
  let currentDesign = $state<Design | null>(null);
  let designs = $state<Design[]>([]);
  let showProducts = $state(false);
  let needsCredits = $state(false);
  let credits = $state(0);
  let creditEmail = $state("");

  async function buyCredits(packId: string) {
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      // Silently fail — user can retry
    }
  }

  async function generate() {
    state = "generating";
    error = "";
    needsCredits = false;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          preferences:
            mode === "choose" ? { colors: selectedPalette } : undefined,
          turnstileToken: "dev-token", // TODO: integrate Turnstile widget
          ...(creditEmail ? { email: creditEmail } : {}),
        }),
      });

      const data = await res.json();

      // Track credit balance from API response
      if (typeof data.credits === "number") {
        credits = data.credits;
      }

      if (!res.ok) {
        if (data.needsCredits) {
          needsCredits = true;
          state = "idle";
          return;
        }
        error = data.error || "Generation failed";
        state = "idle";
        return;
      }

      currentDesign = data;

      // In dev mode (no image), skip reveal
      if (data.devMode) {
        state = "result";
        designs = [...designs, data];
      } else {
        state = "revealing";
      }
    } catch {
      error = "Something went wrong. Please try again.";
      state = "idle";
    }
  }

  function onRevealComplete() {
    state = "result";
    if (currentDesign) {
      designs = [...designs, currentDesign];
    }
  }

  function reset() {
    state = "idle";
    currentDesign = null;
    showProducts = false;
  }

  function buyDesign(design: Design) {
    currentDesign = design;
    showProducts = true;
  }
</script>

<div class="max-w-2xl mx-auto">
  <!-- Mode selector -->
  {#if state === "idle" && !needsCredits}
    <div class="flex gap-2 mb-8 justify-center">
      <button
        onclick={() => (mode = "mystery")}
        class="px-6 py-3 rounded-xl font-display font-semibold transition-all {mode ===
        'mystery'
          ? 'bg-purple-600 text-white'
          : 'bg-white/5 text-gray-400 hover:bg-white/10'}"
      >
        Mystery Mode
      </button>
      <button
        onclick={() => (mode = "choose")}
        class="px-6 py-3 rounded-xl font-display font-semibold transition-all {mode ===
        'choose'
          ? 'bg-purple-600 text-white'
          : 'bg-white/5 text-gray-400 hover:bg-white/10'}"
      >
        Choose Mode
      </button>
    </div>

    <!-- Color picker for Choose mode -->
    {#if mode === "choose"}
      <div class="mb-8">
        <h3 class="text-sm text-gray-400 mb-3 text-center">
          Select a color palette
        </h3>
        <ColorPicker
          selected={selectedPalette}
          onselect={(p) => (selectedPalette = p)}
        />
      </div>
    {/if}

    <!-- Roll info -->
    {#if currentDesign}
      <p class="text-center text-sm text-gray-500 mb-4">
        {currentDesign.rollsRemaining} free roll{currentDesign.rollsRemaining !==
        1
          ? "s"
          : ""} remaining
      </p>
    {/if}

    <!-- Generate button -->
    <div class="text-center">
      <button
        onclick={generate}
        class="px-12 py-5 bg-purple-600 hover:bg-purple-700 text-white font-display font-bold text-xl rounded-2xl transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 active:scale-95"
      >
        Spin the Web
      </button>
      <p class="text-xs text-gray-600 mt-3">
        {mode === "mystery"
          ? "A completely random design — you get what you get!"
          : "Influenced by your color palette selection"}
      </p>
    </div>
  {/if}

  <!-- Credit balance display -->
  {#if credits > 0 && state === "idle"}
    <div class="text-center mb-4">
      <span
        class="inline-block px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-display font-semibold"
      >
        Using credits ({credits} remaining)
      </span>
    </div>
  {/if}

  <!-- Needs credits -->
  {#if needsCredits}
    <div
      class="text-center bg-surface-700 rounded-2xl p-8 border border-white/10"
    >
      <h3 class="font-display font-bold text-xl mb-2">
        No Free Rolls Remaining
      </h3>
      <p class="text-gray-400 mb-6">
        Get more rolls to keep creating. Credits apply toward your next
        purchase!
      </p>

      <!-- Email input to link purchased credits -->
      <div class="mb-6">
        <label for="credit-email" class="block text-sm text-gray-400 mb-2">
          Already purchased credits? Enter your checkout email:
        </label>
        <div class="flex gap-2 max-w-sm mx-auto">
          <input
            id="credit-email"
            type="email"
            placeholder="you@example.com"
            bind:value={creditEmail}
            class="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50"
          />
          {#if creditEmail}
            <button
              onclick={generate}
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Use Credits
            </button>
          {/if}
        </div>
      </div>

      <div class="relative mb-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-white/10"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="px-2 bg-surface-700 text-gray-500">or buy more</span>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-6">
        <button
          onclick={() => buyCredits("pack-1")}
          class="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
        >
          <div class="font-display font-bold">1 Roll</div>
          <div class="text-purple-400 text-sm">$0.50</div>
        </button>
        <button
          onclick={() => buyCredits("pack-5")}
          class="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-all"
        >
          <div class="font-display font-bold">5 Rolls</div>
          <div class="text-purple-400 text-sm">$3.00</div>
          <div class="text-green-400 text-xs mt-1">Save 40%</div>
        </button>
        <button
          onclick={() => buyCredits("pack-15")}
          class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
        >
          <div class="font-display font-bold">15 Rolls</div>
          <div class="text-amber-400 text-sm">$7.00</div>
          <div class="text-green-400 text-xs mt-1">Save 53%</div>
        </button>
      </div>
      <button
        onclick={() => (needsCredits = false)}
        class="text-sm text-gray-500 hover:text-gray-400"
      >
        Back to generator
      </button>
    </div>
  {/if}

  <!-- Generating spinner -->
  {#if state === "generating"}
    <div class="text-center py-16">
      <div class="animate-spin mb-4" style="animation-duration: 1.5s;">
        <img src="/spider.svg" alt="Doobie weaving" class="w-16 h-16 mx-auto" />
      </div>
      <p class="text-gray-400 font-display">Weaving your design...</p>
    </div>
  {/if}

  <!-- Reveal animation -->
  {#if state === "revealing" && currentDesign}
    <Reveal
      imageUrl={currentDesign.imageUrl}
      rarity={currentDesign.rarity}
      onComplete={onRevealComplete}
    />
  {/if}

  <!-- Result -->
  {#if state === "result" && currentDesign}
    <div class="space-y-6">
      <!-- Design display -->
      <div
        class="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
      >
        {#if !currentDesign.devMode}
          <img
            src={currentDesign.imageUrl}
            alt="Your unique tie-dye design"
            class="w-full aspect-square object-cover"
          />
        {:else}
          <div
            class="w-full aspect-square bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center"
          >
            <p class="text-white/60 text-sm font-mono">Dev Mode — AI Preview</p>
          </div>
        {/if}
      </div>

      <!-- Rarity + info -->
      <div class="flex items-center justify-between">
        <RarityBadge rarity={currentDesign.rarity} />
        <span class="text-xs text-gray-500">
          {#if currentDesign.credits !== undefined && currentDesign.credits >= 0}
            {currentDesign.credits} credit{currentDesign.credits !== 1 ? "s" : ""} remaining
          {:else}
            {currentDesign.rollsRemaining} free roll{currentDesign.rollsRemaining !== 1
              ? "s"
              : ""} remaining
          {/if}
        </span>
      </div>

      <!-- Actions -->
      {#if !showProducts}
        <div class="flex gap-3">
          <button
            onclick={() => (showProducts = true)}
            class="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white font-display font-bold rounded-xl transition-all hover:scale-[1.02]"
          >
            Buy This Design
          </button>
          <button
            onclick={reset}
            class="px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-display font-semibold rounded-xl transition-all"
          >
            New Roll
          </button>
        </div>
      {:else}
        <ProductSelector
          designId={currentDesign.designId}
          rarity={currentDesign.rarity}
        />
        <button
          onclick={() => (showProducts = false)}
          class="w-full py-3 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Back to design
        </button>
      {/if}

      <p class="text-xs text-gray-600 text-center">
        This design expires in 24 hours if not purchased.
      </p>
    </div>
  {/if}

  <!-- Error display -->
  {#if error}
    <div class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
      <p class="text-red-400 text-sm">{error}</p>
      <button
        onclick={() => (error = "")}
        class="text-red-300 text-xs mt-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  {/if}

  <!-- Previous designs (Choose mode) -->
  {#if designs.length > 1 && !showProducts}
    <div class="mt-8">
      <h3 class="font-display font-semibold text-sm text-gray-400 mb-3">
        Your Designs
      </h3>
      <div class="grid grid-cols-3 gap-2">
        {#each designs as design}
          <button
            onclick={() => buyDesign(design)}
            class="rounded-xl overflow-hidden border transition-all {currentDesign?.designId ===
            design.designId
              ? 'border-purple-500/50'
              : 'border-white/10 hover:border-white/20'}"
          >
            {#if !design.devMode}
              <img
                src={design.imageUrl}
                alt="Design"
                class="w-full aspect-square object-cover"
              />
            {:else}
              <div
                class="w-full aspect-square bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400"
              ></div>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
