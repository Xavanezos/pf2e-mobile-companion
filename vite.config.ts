import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const moduleId = "pf2e-mobile-companion";
const foundryPort = 30000;

// Dev: Vite serves on foundryPort + 1 and proxies everything that is NOT our
// module's files through to Foundry. A request for
// /modules/pf2e-mobile-companion/module.js is intercepted by Vite and served
// from src/module.ts (transformed + HMR), while Foundry handles the rest.
// Build: emits dist/ (module.js, module.json, style.css) which is junctioned
// into Foundry's Data/modules/.
export default defineConfig({
  root: "src",
  base: `/modules/${moduleId}/`,
  publicDir: resolve(import.meta.dirname, "public"),
  server: {
    port: foundryPort + 1,
    proxy: {
      [`^(?!/modules/${moduleId}/)`]: `http://localhost:${foundryPort}`,
      "/socket.io": { target: `ws://localhost:${foundryPort}`, ws: true },
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    lib: {
      name: moduleId,
      entry: resolve(import.meta.dirname, "src/module.ts"),
      formats: ["es"],
      fileName: () => "module.js",
    },
    rollupOptions: {
      // The app is lazy-imported in module.ts (to defer React past the dev
      // Refresh-preamble install). Inline it so production stays a single
      // module.js that Foundry can load directly.
      output: { inlineDynamicImports: true },
    },
  },
  plugins: [react()],
});
