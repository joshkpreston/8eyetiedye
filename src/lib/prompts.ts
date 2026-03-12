import type { RarityTier } from "./rarity";

export const COLOR_PALETTES = {
  classic: ["red", "blue", "yellow", "green", "purple"],
  ocean: ["navy blue", "turquoise", "seafoam green", "white", "coral"],
  sunset: ["hot pink", "orange", "golden yellow", "magenta", "purple"],
  forest: ["emerald green", "lime green", "olive", "gold", "brown"],
  neon: [
    "neon pink",
    "electric blue",
    "neon green",
    "hot yellow",
    "ultraviolet",
  ],
  pastel: ["lavender", "baby pink", "mint green", "sky blue", "peach"],
  fire: ["crimson red", "orange", "golden yellow", "black", "white"],
  galaxy: ["deep purple", "midnight blue", "silver", "magenta", "black"],
} as const;

export type PaletteName = keyof typeof COLOR_PALETTES;

export interface GenerationPreferences {
  colors?: PaletteName | string[];
  style?: "spiral" | "bullseye" | "crumple" | "ice" | "geode" | "mandala";
}

function getColorString(prefs?: GenerationPreferences): string {
  if (!prefs?.colors) {
    const keys = Object.keys(COLOR_PALETTES) as PaletteName[];
    const randomPalette = keys[Math.floor(Math.random() * keys.length)];
    return COLOR_PALETTES[randomPalette].join(", ");
  }

  if (typeof prefs.colors === "string") {
    return (
      COLOR_PALETTES[prefs.colors as PaletteName]?.join(", ") || prefs.colors
    );
  }

  return prefs.colors.join(", ");
}

function getStyleString(prefs?: GenerationPreferences): string {
  if (!prefs?.style) {
    const styles = ["spiral", "bullseye", "crumple", "ice", "geode", "mandala"];
    return styles[Math.floor(Math.random() * styles.length)];
  }
  return prefs.style;
}

const RARITY_MODIFIERS: Record<RarityTier, string> = {
  common: "classic tie-dye pattern, clean and simple, traditional technique",
  uncommon:
    "bold contrast, complex swirls, high saturation, vivid colors, professional tie-dye",
  rare: "iridescent shimmer effects, unusual color combinations, layered overlapping patterns, premium quality, intricate details",
  legendary:
    "multi-technique fusion, spider web overlay pattern, metallic thread accents, extraordinary complexity, museum-quality artistry, breathtaking",
  mythic:
    "transcendent psychedelic masterpiece, fractal spirals within spirals, holographic rainbow shimmer, ethereal glow, otherworldly beauty, impossible detail, divine artistry",
};

export function buildPrompt(
  rarity: RarityTier,
  prefs?: GenerationPreferences,
): string {
  const colors = getColorString(prefs);
  const style = getStyleString(prefs);
  const modifier = RARITY_MODIFIERS[rarity];

  return [
    `Photorealistic tie-dye fabric pattern, ${style} technique,`,
    `colors: ${colors},`,
    `${modifier},`,
    `on white cotton fabric, seamless tileable textile pattern,`,
    `high resolution, studio photography, top-down flat lay view,`,
    `no text, no watermark, no objects, pure fabric pattern only`,
  ].join(" ");
}
