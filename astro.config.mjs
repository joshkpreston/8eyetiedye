import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://8eyetiedye.com",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    svelte(),
    sitemap({
      filter: (page) => !page.includes("/api/") && !page.includes("/order/"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
