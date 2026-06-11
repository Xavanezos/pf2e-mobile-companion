# PF2e Mobile Companion

A Foundry VTT module that replaces the Foundry UI on mobile Chrome with a fast,
purpose-built React app. **Target:** Foundry v14, PF2e system v8.2, Chrome on Android.

See `pf2e-mobile-companion-plan.md` for the full roadmap.

## Dev setup

The module's build output (`dist/`) is junctioned into Foundry's modules folder:

```
C:\Users\diomi\AppData\Local\FoundryVTT\Data\modules\pf2e-mobile-companion  ->  .\dist
```

PF2e source (API reference, not a dependency) is cloned at `..\pf2e`.

### Workflow

1. `npm install`
2. `npm run build` — produces `dist/` (needed once so Foundry can read `module.json`).
3. Start Foundry (port 30000), enable **PF2e Mobile Companion** in your test world.
4. `npm run dev` — Vite serves on **http://localhost:30001** and proxies everything
   except this module to Foundry. Open `http://localhost:30001` (not :30000) to get HMR.
5. Edit `src/app/App.tsx` — the card in the bottom-right hot-updates.

`npm run build` rebuilds `dist/`; `npm run typecheck` runs `tsc --noEmit`.

### How HMR works

Vite (`:30001`) sits in front of Foundry (`:30000`). A request for
`/modules/pf2e-mobile-companion/module.js` is intercepted by Vite and served live
from `src/module.ts`; all other requests proxy through to Foundry. Because the
manifest is read server-side from `dist/module.json`, run `npm run build` once after
changing `module.json` or `style.css`.
