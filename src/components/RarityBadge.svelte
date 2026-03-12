<script lang="ts">
  const RARITY_STYLES: Record<
    string,
    { bg: string; text: string; border: string; label: string }
  > = {
    common: {
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      border: "border-gray-500/20",
      label: "Common",
    },
    uncommon: {
      bg: "bg-green-500/10",
      text: "text-green-400",
      border: "border-green-500/20",
      label: "Uncommon",
    },
    rare: {
      bg: "bg-purple-500/10",
      text: "text-purple-400",
      border: "border-purple-500/20",
      label: "Rare",
    },
    legendary: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/30",
      label: "Legendary",
    },
    mythic: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/30",
      label: "Mythic",
    },
  };

  interface Props {
    rarity: string;
  }

  let { rarity }: Props = $props();
  let style = $derived(RARITY_STYLES[rarity] || RARITY_STYLES.common);
</script>

<span
  class="inline-flex items-center px-3 py-1 rounded-full text-xs font-display font-semibold border {style.bg} {style.text} {style.border}"
>
  {style.label}
</span>
