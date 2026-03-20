<script lang="ts">
  import ColorPicker from "./ColorPicker.svelte";
  import Reveal from "./Reveal.svelte";
  import RarityBadge from "./RarityBadge.svelte";
  import ProductList from "./ProductList.svelte";
  import InlineCart from "./InlineCart.svelte";
  import MysteryPackSelector from "./MysteryPackSelector.svelte";

  type Mode = "mystery" | "choose";
  type State = "idle" | "generating" | "revealing" | "result";

  interface Design {
    designId: string;
    designName?: string;
    imageUrl: string;
    rarity: string;
    rollsUsed: number;
    rollsRemaining: number;
    credits?: number;
    devMode?: boolean;
  }

  let mode = $state<Mode>("mystery");
  let state = $state<State>("idle");
  let selectedPalette = $state("classic");
  let error = $state("");
  let currentDesign = $state<Design | null>(null);
  let designs = $state<Design[]>([]);
  let needsCredits = $state(false);
  let credits = $state(0);
  let creditEmail = $state("");
  let cartRefreshTrigger = $state(0);
  let turnstileToken = $state("");
  let turnstileWidgetId = $state<string | null>(null);

  // Load Turnstile widget
  $effect(() => {
    // Check if Turnstile script is already loaded
    if (typeof window !== "undefined" && !(window as any).turnstile) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    (window as any).onTurnstileLoad = () => {
      const container = document.getElementById("turnstile-container");
      if (container && (window as any).turnstile) {
        turnstileWidgetId = (window as any).turnstile.render(container, {
          sitekey:
            (
              document.querySelector(
                'meta[name="turnstile-sitekey"]',
              ) as HTMLMetaElement
            )?.content || "0x4AAAAAAA_test_sitekey",
          callback: (token: string) => {
            turnstileToken = token;
          },
          "expired-callback": () => {
            turnstileToken = "";
          },
          theme: "dark",
          size: "flexible",
        });
      }
    };
    // If already loaded (e.g. navigated back)
    if ((window as any).turnstile) {
      (window as any).onTurnstileLoad();
    }
  });

  function resetTurnstile() {
    if (turnstileWidgetId && (window as any).turnstile) {
      (window as any).turnstile.reset(turnstileWidgetId);
      turnstileToken = "";
    }
  }

  // Load persisted designs on mount
  $effect(() => {
    fetch("/api/my-designs")
      .then((r) => r.json())
      .then((data) => {
        if (data.designs?.length > 0) {
          designs = data.designs.map((d: Record<string, unknown>) => ({
            designId: d.designId,
            designName: d.name,
            imageUrl: d.imageUrl,
            rarity: d.rarity,
            rollsUsed: 0,
            rollsRemaining: 0,
          }));
          // Set the most recent design as current
          currentDesign = designs[designs.length - 1];
          state = "result";
        }
      })
      .catch(() => {});
  });

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
          turnstileToken: turnstileToken || "dev-token",
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
    } finally {
      resetTurnstile();
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
  }

  function selectDesign(design: Design) {
    currentDesign = design;
    state = "result";
  }

  function onCartUpdate() {
    cartRefreshTrigger += 1;
  }
</script>

<!-- Dynamic design background (faint wash of selected design) -->
{#if state === "result" && currentDesign && !currentDesign.devMode}
  <div
    class="fixed inset-0 z-0 pointer-events-none"
    style="top: 4rem; background-image: url('{currentDesign.imageUrl}'); background-size: cover; background-position: center; opacity: 0.04;"
  ></div>
{/if}

<div class="relative z-10 max-w-6xl mx-auto">
  <!-- Pre-roll state: mode selector + generate button -->
  {#if state === "idle" && !needsCredits}
    <div class="max-w-2xl mx-auto">
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

      <!-- Turnstile + Generate button -->
      <div class="text-center">
        <div id="turnstile-container" class="flex justify-center mb-4"></div>
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

      <!-- Mystery Packs section -->
      <MysteryPackSelector />
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
    <div class="max-w-2xl mx-auto">
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

  <!-- Result: 2-column layout -->
  {#if state === "result" && currentDesign}
    <div class="flex flex-col lg:flex-row gap-6 lg:gap-8">
      <!-- Left column: Design -->
      <div class="flex-1 lg:max-w-[55%] space-y-4">
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
              <p class="text-white/60 text-sm font-mono">
                Dev Mode — AI Preview
              </p>
            </div>
          {/if}
        </div>

        <!-- Rarity + design name + info -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <RarityBadge rarity={currentDesign.rarity} />
            {#if currentDesign.designName}
              <span class="text-sm font-display font-semibold text-white">
                {currentDesign.designName}
              </span>
            {/if}
          </div>
          <span class="text-xs text-gray-500">
            {#if currentDesign.credits !== undefined && currentDesign.credits >= 0}
              {currentDesign.credits} credit{currentDesign.credits !== 1
                ? "s"
                : ""} remaining
            {:else if currentDesign.rollsRemaining !== undefined}
              {currentDesign.rollsRemaining} free roll{currentDesign.rollsRemaining !==
              1
                ? "s"
                : ""} remaining
            {/if}
          </span>
        </div>

        <!-- New Roll button -->
        <button
          onclick={reset}
          class="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-display font-semibold rounded-xl transition-all"
        >
          New Roll
        </button>

        <!-- Previous designs grid -->
        {#if designs.length > 1}
          <div class="mt-4">
            <h3 class="font-display font-semibold text-sm text-gray-400 mb-3">
              Your Designs
            </h3>
            <div class="grid grid-cols-4 gap-2">
              {#each designs as design}
                <button
                  onclick={() => selectDesign(design)}
                  class="rounded-xl overflow-hidden border transition-all {currentDesign?.designId ===
                  design.designId
                    ? 'border-purple-500/50 ring-1 ring-purple-500/30'
                    : 'border-white/10 hover:border-white/20'}"
                >
                  {#if !design.devMode}
                    <img
                      src={design.imageUrl}
                      alt={design.designName || "Design"}
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

        <p class="text-xs text-gray-600 text-center">
          Designs expire in 24 hours if not purchased. Gallery visibility: 30
          days.
        </p>
      </div>

      <!-- Right column: Products + Cart (sticky on desktop) -->
      <div class="lg:w-[45%]">
        <div class="lg:sticky lg:top-20 space-y-6">
          <!-- Design name header for right panel -->
          <div>
            <h2 class="font-display font-bold text-lg">
              {currentDesign.designName || "Your Design"}
            </h2>
            <p class="text-gray-500 text-sm">Choose products for this design</p>
          </div>

          <!-- Product list -->
          <ProductList
            designId={currentDesign.designId}
            designName={currentDesign.designName || "Untitled"}
            rarity={currentDesign.rarity}
            oncartupdate={onCartUpdate}
          />

          <!-- Inline cart -->
          <InlineCart refreshTrigger={cartRefreshTrigger} />
        </div>
      </div>
    </div>
  {/if}

  <!-- Error display -->
  {#if error}
    <div
      class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl max-w-2xl mx-auto"
    >
      <p class="text-red-400 text-sm">{error}</p>
      <button
        onclick={() => (error = "")}
        class="text-red-300 text-xs mt-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  {/if}
</div>
