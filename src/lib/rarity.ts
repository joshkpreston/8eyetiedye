export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "legendary"
  | "mythic";

export interface RarityConfig {
  tier: RarityTier;
  weight: number;
  label: string;
  color: string;
  description: string;
}

export const RARITY_TIERS: Record<RarityTier, RarityConfig> = {
  common: {
    tier: "common",
    weight: 0.7,
    label: "Common",
    color: "#9ca3af",
    description: "Classic tie-dye patterns",
  },
  uncommon: {
    tier: "uncommon",
    weight: 0.2,
    label: "Uncommon",
    color: "#22c55e",
    description: "Bold contrast, complex swirls",
  },
  rare: {
    tier: "rare",
    weight: 0.08,
    label: "Rare",
    color: "#7c3aed",
    description: "Iridescent effects, layered patterns",
  },
  legendary: {
    tier: "legendary",
    weight: 0.019,
    label: "Legendary",
    color: "#f59e0b",
    description: "Multi-technique fusion masterpiece",
  },
  mythic: {
    tier: "mythic",
    weight: 0.001,
    label: "Mythic",
    color: "#ef4444",
    description: "Transcendent 1-in-1000 design",
  },
};

export function rollRarity(): RarityTier {
  const roll = Math.random();
  let cumulative = 0;

  for (const config of Object.values(RARITY_TIERS)) {
    cumulative += config.weight;
    if (roll < cumulative) {
      return config.tier;
    }
  }

  return "common";
}
