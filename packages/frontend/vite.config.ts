import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [tailwindcss(), react(), wasm()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "../../core/packages/npm/src"),
      "occt-import-js": resolve(__dirname, "node_modules/occt-import-js"),
      "manifold-3d": resolve(__dirname, "node_modules/manifold-3d"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
});
