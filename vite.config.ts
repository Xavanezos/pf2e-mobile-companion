import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const moduleId = "pf2e-mobile-companion";
const foundryPort = 30000;

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
      output: {
        inlineDynamicImports: true,
        assetFileNames: (info) => {
          const name = info.name ?? (info.names && info.names[0]) ?? "";
          return name.endsWith(".css") ? "style.css" : "assets/[name][extname]";
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
