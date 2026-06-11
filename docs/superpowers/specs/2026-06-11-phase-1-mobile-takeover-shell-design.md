# Phase 1 — Mobile Takeover Shell (Design)

**Date:** 2026-06-11
**Status:** Approved
**Target:** Foundry VTT v14, PF2e system v8.2+, Chrome on Android
**Builds on:** Phase 0 scaffold (Vite + React 18 + TS + `fvtt-types`; hooks in `src/module.ts`, React mounted on `ready`).

## Goal

When a player opens the world in mobile Chrome, the module detects mobile, disables
the PIXI canvas, hides Foundry's stock UI, and mounts a full-screen React app with
bottom-tab navigation. The Sheet tab resolves "my character"; the other tabs are
labeled placeholders. GM/desktop clients are byte-for-byte unaffected.

**Milestone:** player on mobile sees an empty tabbed app (Sheet shows their character
or an owned-actor picker); GM on desktop is unaffected.

## Decisions (locked during brainstorming)

| Topic | Decision |
|-------|----------|
| Styling | **Tailwind v4** via `@tailwindcss/vite`, **no preflight** (scoped reset instead) |
| Testing | **Vitest** for pure logic (node env); **manual** verification for DOM/hook integration |
| Canvas | **`core.noCanvas`** save/set/restore + **one-time guarded auto-reload** |
| Scope | **Functional shell**: detection + override, takeover, tab nav, character resolution; other tabs are placeholders |
| Extras | **Escape-to-desktop** header control + **fullscreen** toggle button |

## Architecture

Three layers with a clean seam between Foundry and React:

- **Foundry adapter** (`src/foundry/*`) — the only code that touches `game`, `Hooks`,
  `core.noCanvas`, and the stock DOM. Pure functions where possible.
- **React app** (`src/app/*`) — knows nothing about Foundry's boot; reads a Zustand
  store and calls adapter functions.
- **`src/module.ts`** — orchestration only: register settings at `init`; run takeover +
  mount React at `ready`.

**Principle (from the project plan):** read from the Document (`actor.system.*`), mutate
via `document.update()`. The store *mirrors*; it never becomes the source of truth.

### Boot sequence

1. `init` → register the `uiMode` client setting (`auto | on | off`, default `auto`).
2. `ready` → evaluate `isMobileActive()`.
   - **Not mobile:** do nothing. Desktop Foundry is untouched; canvas is normal.
   - **Mobile and `core.noCanvas` is off:** save the user's prior `noCanvas` value into
     our own client setting, set `noCanvas = true`, set a `sessionStorage` sentinel, and
     **reload once** (the sentinel prevents a reload loop). After reload the canvas never
     initializes.
   - **Mobile and `noCanvas` already on:** add the `pf2e-mobile-active` body class, mount
     the React root full-screen.
3. Switching back to desktop (`uiMode → off`) **restores** the saved `noCanvas` value and
   reloads, so we never permanently disable the canvas on that browser profile.

## Components

### Foundry adapter

- **`settings.ts`** — register the `uiMode` client setting and a hidden `priorNoCanvas`
  client setting; typed `getUiMode()` / `setUiMode()` helpers. `onChange` for `uiMode`
  triggers re-evaluation (and the canvas restore + reload when toggled off).
- **`mobile.ts`**
  - `detectMobile({ ua, width, override })` — **pure**. `override === "on"` → true;
    `"off"` → false; `"auto"` → `isMobileUA(ua) || width <= 900`. UA is primary; width
    catches DevTools emulation / narrow windows. Threshold is tunable.
  - `isMobileActive()` — wires the `uiMode` setting + `navigator.userAgent` +
    `window.innerWidth` into `detectMobile`.
- **`takeover.ts`** — `applyTakeover()` / `removeTakeover()`: add/remove the body class,
  the `noCanvas` save/set/restore + reload-guard logic, and create/remove the full-screen
  root container. Mounting the React tree is invoked from here (or from `module.ts`).
- **`character.ts`** — `resolveCharacter(game)` — **pure-ish** against a minimal `game`
  shape. Returns the assigned character if `game.user.character` is set; else the owned
  PF2e `character`-type actors (`game.actors.filter(isOwner && type === "character")`).
  Caller logic: exactly one → auto-select; several → picker; none → empty state.

### React app

- **`store.ts`** (Zustand) — minimal: `activeTab` + `setActiveTab`, `actorId` +
  `setActorId`. Mirrors only.
- **`useFoundryHook(hookName, handler)`** — `Hooks.on` on mount, `Hooks.off` on unmount.
  The backbone for later phases. Used once in Phase 1 (re-resolve character on
  `updateUser`) to prove it works.
- **`useFullscreen()`** — wraps `documentElement.requestFullscreen()` /
  `document.exitFullscreen()`; tracks state via the `fullscreenchange` event. (Browser
  API, lives in the app layer, not the Foundry adapter.)
- **`App`** → renders **`Shell`**.
- **`Shell`** — full-screen flex column: thin **header** (character name + fullscreen
  toggle + escape-to-desktop control) · **`TabContent`** (scrollable, `flex-1`) ·
  **`TabBar`** pinned to bottom with `env(safe-area-inset-bottom)` padding.
- **`TabBar`** — 5 tabs **Sheet / Actions / Combat / Journal / Map**; icon + label,
  ≥44px touch targets, active highlight. Icons reuse **Foundry's already-loaded Font
  Awesome** (`<i className="fas …">`) — no icon dependency.
- **`TabContent`** — switches on `activeTab`. Phase 1: **Sheet** functional; the other
  four render a labeled placeholder (e.g. "Combat — Phase 5").
- **`SheetTab`** — character resolution UI: assigned character → show name/portrait;
  multiple owned → picker; none → empty state. Selection is stored in the Zustand store
  (we do **not** reassign `user.character` in Phase 1).

### Header controls (mobile-critical)

- **Fullscreen toggle** — `fa-expand` / `fa-compress`; enters/exits the Fullscreen API.
  Must be user-gesture-triggered (a button), which is exactly this.
- **Escape-to-desktop** — sets `uiMode → off`, which restores `noCanvas` and reloads.
  Without it, a desktop tester who flips `uiMode: on` (or a player who opts in) is trapped
  once the sidebar is hidden.

## Styling: Tailwind inside Foundry's DOM

The module's `style.css` is loaded on **every** client, including desktop, where we do
**not** take over. Tailwind's preflight is a global reset that would wreck Foundry's UI.
Therefore:

- **Tailwind v4** via `@tailwindcss/vite`. Import **theme + utilities only** (skip the
  `base`/preflight layer). A small reset is scoped under `#pf2e-mobile-companion-root`.
- Generated CSS is emitted as **`style.css`** (via Rollup `assetFileNames`) so
  `module.json`'s `styles: ["style.css"]` stays valid. The static `public/style.css` is
  removed.
- Utilities are generated only for classes we use and only attach to our elements, so
  desktop Foundry is unaffected. Fallback if a class-name collision ever appears: a
  Tailwind prefix.
- Dark theme via Tailwind theme tokens. Stock-UI-hide rules live in the same stylesheet,
  gated by `body.pf2e-mobile-active`.

In **dev**, styles arrive through Vite's HMR CSS injection; the built `dist/style.css` is
only what Foundry reads for the manifest (rebuild once after CSS/manifest changes, per the
existing README workflow).

## Testing

- **Vitest** (node environment, no React Testing Library). TDD these pure units first:
  - `detectMobile` — override on/off/auto across UA strings and widths.
  - `resolveCharacter(game)` — assigned vs. multiple-owned vs. none, against a mocked
    minimal `game`.
  - store actions — `setActiveTab`, `setActorId`.
- **Manual verification checklist** (the integration bits Vitest can't reach without the
  fuller harness we declined):
  1. On mobile/emulated: stock UI (`#interface`, sidebar, hotbar, nav) is hidden.
  2. Canvas is truly off — JS heap and CPU drop in DevTools vs. desktop; no `canvas.*`
     errors in console.
  3. Bottom tabs switch content; touch targets are comfortable; safe-area padding present.
  4. Sheet tab shows the assigned character, or a picker when several actors are owned.
  5. Fullscreen toggle enters/exits fullscreen on Android Chrome.
  6. Escape-to-desktop restores canvas + stock UI after the reload.
  7. A separate desktop (GM) client is visually unchanged throughout.

## Dependencies added

- Runtime: `zustand`, `tailwindcss`, `@tailwindcss/vite`.
- Dev: `vitest`.
- Icons: none — reuse Foundry's bundled Font Awesome.

## Proposed file layout

```
src/
  module.ts                # init: register settings; ready: takeover + mount
  foundry/
    settings.ts            # uiMode + priorNoCanvas settings, get/set helpers
    mobile.ts              # detectMobile() [pure] + isMobileActive()
    takeover.ts            # apply/removeTakeover: body class, noCanvas save/restore+reload, root mount
    character.ts           # resolveCharacter(game) [pure-ish]
  app/
    App.tsx                # root → Shell
    store.ts               # zustand store
    useFoundryHook.ts      # generic Foundry-hook React hook
    useFullscreen.ts       # Fullscreen API hook
    Shell.tsx
    TabBar.tsx
    TabContent.tsx
    tabs/
      SheetTab.tsx         # character resolution / picker
      ActionsTab.tsx       # placeholder
      CombatTab.tsx        # placeholder
      JournalTab.tsx       # placeholder
      MapTab.tsx           # placeholder
  styles/
    tailwind.css           # @import tailwindcss (theme+utilities, no preflight) + scoped reset + stock-UI-hide
tests/
  detectMobile.test.ts
  character.test.ts
  store.test.ts
```

## Out of scope (later phases)

Live sheet data (Phase 2), rolling (Phase 3), macros (Phase 4), combat tracker (Phase 5),
journals (Phase 6), battle map (Phase 7), other-module neutralization (Phase 8b). Phase 1
ships the shell and character resolution only.
