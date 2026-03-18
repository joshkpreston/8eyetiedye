export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  podProvider: "printful" | "gooten";
  printfulProductId?: number;
  printfulVariantIds?: Record<string, number>;
  gootenProductId?: string;
  sizes: string[];
  image: string;
  /** Printful file placement type (e.g., "default", "back", "preview"). Defaults to "default". */
  printfulFileType?: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "aop-tee",
    name: "All-Over Print Tee",
    description:
      "Premium all-over print crew neck t-shirt with your unique tie-dye design.",
    priceCents: 3999,
    podProvider: "printful",
    printfulProductId: 257, // All-Over Print Men's Crew Neck T-Shirt
    printfulVariantIds: {
      S: 8851,
      M: 8852,
      L: 8853,
      XL: 8854,
      "2XL": 8855,
    },
    sizes: ["S", "M", "L", "XL", "2XL"],
    image: "/products/aop-tee.jpg",
    printfulFileType: "default",
  },
  {
    id: "aop-hoodie",
    name: "All-Over Print Hoodie",
    description:
      "Premium recycled unisex all-over print hoodie with your unique tie-dye design.",
    priceCents: 6499,
    podProvider: "printful",
    printfulProductId: 388, // All-Over Print Recycled Unisex Hoodie
    printfulVariantIds: {
      S: 10870,
      M: 10871,
      L: 10872,
      XL: 10873,
      "2XL": 10874,
    },
    sizes: ["S", "M", "L", "XL", "2XL"],
    image: "/products/aop-hoodie.jpg",
    printfulFileType: "default",
  },
  {
    id: "aop-leggings",
    name: "All-Over Print Leggings",
    description:
      "Premium all-over print leggings with your unique tie-dye design.",
    priceCents: 4499,
    podProvider: "printful",
    printfulProductId: 189, // All-Over Print Leggings
    printfulVariantIds: {
      S: 7677,
      M: 7678,
      L: 7679,
      XL: 7680,
    },
    sizes: ["S", "M", "L", "XL"],
    image: "/products/aop-leggings.jpg",
    printfulFileType: "default",
  },
  {
    id: "necktie",
    name: "Tie-Dye Necktie",
    description: "Custom printed necktie with your unique tie-dye design.",
    priceCents: 2999,
    podProvider: "gooten",
    gootenProductId: "necktie",
    sizes: ["One Size"],
    image: "/products/necktie.jpg",
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
