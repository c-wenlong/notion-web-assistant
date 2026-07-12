// Vite config for the UI preview app. Imports the popup's React components
// directly from the parent's `src/` and aliases `wxt/utils/storage` to a local
// shim so `useStorageItem` plus the popup's `~/storage/items` work without a
// real Chrome runtime.
//
// Why aliases matter:
// - `~`  → the parent's `src/`, so popup imports resolve exactly as they do in
//   the WXT build.
// - `wxt/utils/storage` → our local shim that mimics the API surface (defineItem +
//   getValue/setValue/removeValue/watch/fallback) backed by an in-memory Map.

import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parentSrc = path.resolve(__dirname, "..", "..", "src");

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "~": parentSrc,
      "~/": `${parentSrc}/`,
      "wxt/utils/storage": path.resolve(__dirname, "src", "shims", "wxt-storage.ts"),
    },
  },
});
