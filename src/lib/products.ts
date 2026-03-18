export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  podProvider: "printful" | "gooten";
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
      "Premium unisex all-over print t-shirt with your unique tie-dye design.",
    priceCents: 3999,
    podProvider: "printful",
    printfulVariantIds: {
      S: 9867,
      M: 9868,
      L: 9869,
      XL: 9870,
      "2XL": 9871,
    },
    sizes: ["S", "M", "L", "XL", "2XL"],
    image: "/products/aop-tee.jpg",
    printfulFileType: "default",
  },
  {
    id: "aop-hoodie",
    name: "All-Over Print Hoodie",
    description:
      "Premium unisex all-over print hoodie with your unique tie-dye design.",
    priceCents: 6499,
    podProvider: "printful",
    printfulVariantIds: {
      S: 14681,
      M: 14682,
      L: 14683,
      XL: 14684,
      "2XL": 14685,
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
    printfulVariantIds: {
      S: 10930,
      M: 10931,
      L: 10932,
      XL: 10933,
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
