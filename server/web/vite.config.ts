import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [tailwindcss(), react(), wasm()],
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
