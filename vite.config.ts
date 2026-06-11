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
  plugins: [
    react(),
    tailwindcss(),
    {
      // Foundry's module.json adds <link href="/modules/<id>/style.css">. In a
      // production build that file is emitted to dist/. In dev there is no static
      // file — Tailwind CSS is injected by Vite through the JS `import
      // "./styles/tailwind.css"` in App.tsx (with HMR) — so serve an empty stub
      // here to stop the <link> from 404ing. Dev-only (apply: "serve").
      name: "pf2e-mc-dev-style-stub",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith(`/modules/${moduleId}/style.css`)) {
            res.setHeader("Content-Type", "text/css");
            res.end("/* dev: real styles are injected by Vite via the JS import in App.tsx */");
            return;
          }
          next();
        });
      },
    },
  ],
});
