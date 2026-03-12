<script lang="ts">
  const PALETTES: Record<string, { name: string; colors: string[] }> = {
    classic: {
      name: "Classic",
      colors: ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#7c3aed"],
    },
    ocean: {
      name: "Ocean",
      colors: ["#1e3a5f", "#06b6d4", "#6ee7b7", "#ffffff", "#f87171"],
    },
    sunset: {
      name: "Sunset",
      colors: ["#ec4899", "#f97316", "#facc15", "#db2777", "#7c3aed"],
    },
    forest: {
      name: "Forest",
      colors: ["#059669", "#84cc16", "#78716c", "#eab308", "#92400e"],
    },
    neon: {
      name: "Neon",
      colors: ["#f472b6", "#3b82f6", "#4ade80", "#facc15", "#8b5cf6"],
    },
    pastel: {
      name: "Pastel",
      colors: ["#c4b5fd", "#fbcfe8", "#a7f3d0", "#93c5fd", "#fde68a"],
    },
    fire: {
      name: "Fire",
      colors: ["#dc2626", "#f97316", "#facc15", "#000000", "#ffffff"],
    },
    galaxy: {
      name: "Galaxy",
      colors: ["#581c87", "#1e3a8a", "#c0c0c0", "#db2777", "#000000"],
    },
  };

  interface Props {
    selected: string;
    onselect: (palette: string) => void;
  }

  let { selected, onselect }: Props = $props();
</script>

<div class="grid grid-cols-4 gap-2">
  {#each Object.entries(PALETTES) as [key, palette]}
    <button
      onclick={() => onselect(key)}
      class="p-2 rounded-lg border transition-all text-center {selected === key
        ? 'border-white/40 bg-white/10 scale-105'
        : 'border-white/10 bg-white/5 hover:border-white/20'}"
    >
      <div class="flex justify-center gap-0.5 mb-1">
        {#each palette.colors as color}
          <div
            class="w-3 h-3 rounded-full"
            style="background-color: {color}"
          ></div>
        {/each}
      </div>
      <span class="text-xs text-gray-400">{palette.name}</span>
    </button>
  {/each}
</div>
