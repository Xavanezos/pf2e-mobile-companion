# PF2e Mobile Companion

A Foundry VTT module that replaces the desktop UI on phones and tablets with a
fast, purpose-built React app for Pathfinder 2e. When you open your world on a
mobile device, the companion takes over automatically; on desktop, Foundry is
untouched.

**Target:** Foundry VTT v14 · Pathfinder 2e system v8.2+ · mobile Chrome (Android).

## Features

- **Character sheet** — stats, skills, feats, inventory, conditions, bio, and full
  modifier breakdowns.
- **Rolling** — checks, saves, and skill rolls posted to chat.
- **Spells** — spellbook, casting, and damage / save / effect cards.
- **Actions** — strikes, actions, and toggles with target-aware attacks.
- **Combat tracker** — initiative order and turn control.
- **Battle map** — the real Foundry canvas (walls, lighting, fog, vision) with
  touch token selection, drag-to-move, a ruler, and condition icons.
- **Macro bar** — your hotbar, flattened and tappable, on the map.
- **Journals** — a touch-friendly journal reader.
- **Chat** — long-press a message for native PF2e actions (rerolls, Hero Point,
  delete).
- **Settings** — default tab, font size, and haptic feedback.

## Requirements

- Foundry VTT **v14**
- Pathfinder 2e system **v8.2.0** or newer

## Installation

**In Foundry (recommended):**

1. Go to **Add-on Modules → Install Module**.
2. Paste this manifest URL into the bottom field and click **Install**:
   ```
   https://github.com/Xavanezos/pf2e-mobile-companion/releases/latest/download/module.json
   ```
3. Enable **PF2e Mobile Companion** in your world's module settings.

**Manual:** download `module.zip` from the
[latest release](https://github.com/Xavanezos/pf2e-mobile-companion/releases/latest),
extract it into `Data/modules/pf2e-mobile-companion`, and restart Foundry.

Once enabled, open the world on a phone or tablet — the mobile UI activates on its
own.

## Development

The build output (`dist/`) is junctioned into Foundry's modules folder:

```
C:\Users\<you>\AppData\Local\FoundryVTT\Data\modules\pf2e-mobile-companion  ->  .\dist
```

### Workflow

1. `npm install`
2. `npm run build` — produces `dist/` (needed once so Foundry can read `module.json`).
3. Start Foundry (port 30000), enable **PF2e Mobile Companion** in your test world.
4. `npm run dev` — Vite serves on **http://localhost:30001** and proxies everything
   except this module to Foundry. Open `http://localhost:30001` (not :30000) to get HMR.
5. Edit `src/app/App.tsx` — the app hot-updates.

`npm run build` rebuilds `dist/`; `npm run typecheck` runs `tsc --noEmit`; `npm test`
runs the Vitest suite.

### How HMR works

Vite (`:30001`) sits in front of Foundry (`:30000`). A request for
`/modules/pf2e-mobile-companion/module.js` is intercepted by Vite and served live
from `src/module.ts`; all other requests proxy through to Foundry. Because the
manifest is read server-side from `dist/module.json`, run `npm run build` once after
changing `module.json` or `style.css`.

## License

[MIT](LICENSE) © 2026 Xavanezos
