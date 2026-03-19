export interface MysteryPack {
  id: string;
  count: number;
  priceCents: number;
  label: string;
  savings?: string;
}

export const MYSTERY_PACKS: MysteryPack[] = [
  { id: "pack-3", count: 3, priceCents: 299, label: "3 Designs" },
  {
    id: "pack-5",
    count: 5,
    priceCents: 399,
    label: "5 Designs",
    savings: "20%",
  },
  {
    id: "pack-10",
    count: 10,
    priceCents: 699,
    label: "10 Designs",
    savings: "30%",
  },
  {
    id: "pack-25",
    count: 25,
    priceCents: 1499,
    label: "25 Designs",
    savings: "40%",
  },
];

export function getMysteryPack(id: string): MysteryPack | undefined {
  return MYSTERY_PACKS.find((p) => p.id === id);
}
