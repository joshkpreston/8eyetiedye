<script lang="ts">
  interface TickerEvent {
    designName: string;
    username: string;
    rarity: string;
    createdAt: string;
  }

  let events = $state<TickerEvent[]>([]);
  let paused = $state(false);

  const RARITY_COLORS: Record<string, string> = {
    common: "text-gray-400",
    uncommon: "text-green-400",
    rare: "text-blue-400",
    legendary: "text-amber-400",
    mythic: "text-red-400",
  };

  $effect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 60000);
    return () => clearInterval(interval);
  });

  async function fetchEvents() {
    try {
      const res = await fetch("/api/activity");
      const data = await res.json();
      events = data.events || [];
    } catch {
      // Silent fail
    }
  }
</script>

{#if events.length > 0}
  <div
    class="overflow-hidden bg-surface-800/50 border-y border-white/5 py-2"
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
    role="marquee"
    aria-live="off"
  >
    <div
      class="flex gap-8 whitespace-nowrap animate-ticker"
      class:paused
    >
      <!-- Double the items for seamless loop -->
      {#each [...events, ...events] as event}
        <span class="text-sm shrink-0">
          <span class="text-gray-500">&#x1f3a8;</span>
          <span class="text-gray-300 font-medium">{event.username}</span>
          <span class="text-gray-500">rolled</span>
          <span class="{RARITY_COLORS[event.rarity] || 'text-gray-400'} font-semibold">
            {event.designName}
          </span>
        </span>
      {/each}
    </div>
  </div>
{/if}

<style>
  @keyframes ticker {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .animate-ticker {
    animation: ticker 60s linear infinite;
  }

  .animate-ticker.paused {
    animation-play-state: paused;
  }
</style>
