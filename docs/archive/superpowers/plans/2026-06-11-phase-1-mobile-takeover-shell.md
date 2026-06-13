# Phase 1 — Mobile Takeover Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player opens the world in mobile Chrome, detect mobile, disable the PIXI canvas, hide Foundry's stock UI, and mount a full-screen React app with bottom-tab navigation whose Sheet tab resolves "my character". Desktop/GM clients are unaffected.

**Architecture:** Three layers — a Foundry adapter (`src/foundry/*`, the only code touching `game`/`Hooks`/DOM), a React app (`src/app/*`, reads a Zustand store), and `src/module.ts` (orchestration: register settings at `init`, run takeover + mount at `ready`). Canvas is disabled via the core `noCanvas` client setting with a one-time guarded reload; the prior value is saved and restored on exit.

**Tech Stack:** Vite 6 (library mode), React 18, TypeScript, `fvtt-types`, Zustand, Tailwind CSS v4 (`@tailwindcss/vite`, no preflight), Vitest (node env), Foundry's bundled Font Awesome.

**Spec:** `docs/superpowers/specs/2026-06-11-phase-1-mobile-takeover-shell-design.md`

### Conventions for implementers

- **Foundry globals & fvtt-types:** files under `src/foundry/` and `src/module.ts` touch `game`, `Hooks`, `document`. `fvtt-types` can be strict and these globals are typed as possibly-undefined / heavily generic. **Do not rabbit-hole on global-typing errors** — use a pragmatic cast (`game as any`, `... as SomeType`) and move on. Phase 1's priority is correct runtime behavior. Pure modules (`mobile.ts`'s `detectMobile`, `character.ts`) must stay free of globals so they unit-test cleanly.
- **Commits:** Do **not** run `git commit`. Leave your changes in the working tree and report (a) files created/modified and (b) the exact output of any test/typecheck command you ran. The orchestrator commits after reviewing each wave.
- **Module id** is `pf2e-mobile-companion` everywhere.

---

## Task 1: Project setup (deps, Tailwind, Vitest, configs)

**Files:**
- Modify: `package.json` (deps + scripts)
- Modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Modify: `tsconfig.json`
- Create: `src/styles/tailwind.css`
- Delete: `public/style.css`

- [ ] **Step 1: Install dependencies**

```
npm install zustand
npm install -D tailwindcss @tailwindcss/vite vitest
```

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Wire Tailwind into `vite.config.ts` and force the CSS filename to `style.css`**

Replace the file with:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

const moduleId = "pf2e-mobile-companion";
const foundryPort = 30000;

// Dev: Vite serves on foundryPort + 1 and proxies everything that is NOT our
// module's files through to Foundry. Build: emits dist/ (module.js, module.json,
// style.css) which is junctioned into Foundry's Data/modules/.
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
        // App is lazy-imported in module.ts; inline so prod stays one module.js.
        inlineDynamicImports: true,
        // Foundry's module.json references "style.css"; force that name.
        assetFileNames: (info) => {
          const name = info.name ?? (info.names && info.names[0]) ?? "";
          return name.endsWith(".css") ? "style.css" : "assets/[name][extname]";
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
});
```

- [ ] **Step 4: Create `vitest.config.ts`** (separate from the build config so `root: "src"` and library mode don't interfere with test discovery)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Update `tsconfig.json` `include`** so tests and the vitest config are typechecked. Change the `include` line to:

```json
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
```

- [ ] **Step 6: Create `src/styles/tailwind.css`** — utilities + theme only (no preflight), a reset scoped to our root, and the stock-UI hide rules gated by the body class.

```css
@layer theme, components, utilities;

@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

/* Scoped reset — replaces Tailwind's (disabled) preflight, applies only inside
   our root so desktop Foundry is untouched. */
#pf2e-mobile-companion-root,
#pf2e-mobile-companion-root *,
#pf2e-mobile-companion-root *::before,
#pf2e-mobile-companion-root *::after {
  box-sizing: border-box;
}

#pf2e-mobile-companion-root {
  position: fixed;
  inset: 0;
  z-index: 100000;
  margin: 0;
  background: #0f0f14;
  color: #e8e8ea;
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-text-size-adjust: 100%;
  overflow: hidden;
}

#pf2e-mobile-companion-root button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}

#pf2e-mobile-companion-root img {
  display: block;
  max-width: 100%;
}

/* Hide stock Foundry chrome — gated by the body class, so clients without it
   (desktop/GM) render normally. */
body.pf2e-mobile-active #interface,
body.pf2e-mobile-active #ui-top,
body.pf2e-mobile-active #ui-left,
body.pf2e-mobile-active #ui-right,
body.pf2e-mobile-active #ui-bottom,
body.pf2e-mobile-active #ui-middle,
body.pf2e-mobile-active #board,
body.pf2e-mobile-active #hotbar,
body.pf2e-mobile-active #navigation,
body.pf2e-mobile-active #players,
body.pf2e-mobile-active #sidebar,
body.pf2e-mobile-active #controls,
body.pf2e-mobile-active #notifications {
  display: none !important;
}

body.pf2e-mobile-active {
  overflow: hidden;
}
```

- [ ] **Step 7: Delete `public/style.css`** (Tailwind now generates `dist/style.css`). Use: `git rm public/style.css` or delete the file.

- [ ] **Step 8: Verify the build still produces `dist/style.css` and `dist/module.js`**

Run: `npm run build`
Expected: build succeeds; `dist/style.css` and `dist/module.js` exist. (Note: `src/styles/tailwind.css` is imported by `App.tsx` in Task 6; until then the build still succeeds and emits a small/empty `style.css`. The build is re-verified in Task 8.)

---

## Task 2: Mobile detection (pure, TDD)

**Files:**
- Create: `src/foundry/mobile.ts`
- Test: `tests/detectMobile.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/detectMobile.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { detectMobile, isMobileUA } from "../src/foundry/mobile";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("isMobileUA", () => {
  it("detects Android phones", () => expect(isMobileUA(ANDROID_UA)).toBe(true));
  it("rejects desktop", () => expect(isMobileUA(DESKTOP_UA)).toBe(false));
});

describe("detectMobile override", () => {
  it("forces on regardless of device", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 1920, override: "on" })).toBe(true));
  it("forces off regardless of device", () =>
    expect(detectMobile({ ua: ANDROID_UA, width: 360, override: "off" })).toBe(false));
});

describe("detectMobile auto", () => {
  it("true for a mobile UA even on a wide viewport", () =>
    expect(detectMobile({ ua: ANDROID_UA, width: 1200, override: "auto" })).toBe(true));
  it("true for a narrow viewport (DevTools emulation) even with desktop UA", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 800, override: "auto" })).toBe(true));
  it("false for a wide desktop", () =>
    expect(detectMobile({ ua: DESKTOP_UA, width: 1920, override: "auto" })).toBe(false));
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/detectMobile.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/mobile`.

- [ ] **Step 3: Implement `src/foundry/mobile.ts`** — kept **pure** (no Foundry globals, no `settings` import) so it unit-tests standalone. The live wiring (`isMobileActive`) lives in `settings.ts` (Task 5).

```ts
export type UiMode = "auto" | "on" | "off";

export interface DetectMobileInput {
  ua: string;
  width: number;
  override: UiMode;
}

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
const WIDTH_BREAKPOINT = 900;

export function isMobileUA(ua: string): boolean {
  return MOBILE_UA.test(ua);
}

/** Pure decision: should the mobile UI be active given device + override? */
export function detectMobile({ ua, width, override }: DetectMobileInput): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return isMobileUA(ua) || width <= WIDTH_BREAKPOINT;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/detectMobile.test.ts`
Expected: PASS (7 tests).

---

## Task 3: Character resolution (pure, TDD)

**Files:**
- Create: `src/foundry/character.ts`
- Test: `tests/character.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/character.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { resolveCharacter, type MinimalGame, type MinimalActor } from "../src/foundry/character";

function makeGame(characterId: string | null, actors: MinimalActor[]): MinimalGame {
  return {
    user: { character: characterId ? { id: characterId } : null },
    actors: { filter: (p) => actors.filter(p) },
  };
}
const actor = (id: string, over: Partial<MinimalActor> = {}): MinimalActor => ({
  id,
  name: `Actor ${id}`,
  type: "character",
  isOwner: true,
  ...over,
});

describe("resolveCharacter", () => {
  it("uses the assigned character when present", () => {
    expect(resolveCharacter(makeGame("hero", [actor("hero")]))).toEqual({
      kind: "resolved",
      actorId: "hero",
    });
  });
  it("auto-selects the single owned character", () => {
    expect(resolveCharacter(makeGame(null, [actor("solo")]))).toEqual({
      kind: "resolved",
      actorId: "solo",
    });
  });
  it("returns a picker for multiple owned characters", () => {
    const r = resolveCharacter(makeGame(null, [actor("a"), actor("b")]));
    expect(r.kind).toBe("picker");
    if (r.kind === "picker") expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("ignores non-owned and non-character actors", () => {
    const r = resolveCharacter(
      makeGame(null, [actor("npc", { isOwner: false }), actor("loot", { type: "loot" })]),
    );
    expect(r).toEqual({ kind: "none" });
  });
  it("returns none when nothing is owned", () => {
    expect(resolveCharacter(makeGame(null, []))).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/character.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/character`.

- [ ] **Step 3: Implement `src/foundry/character.ts`**

```ts
export interface ActorSummary {
  id: string;
  name: string;
  img?: string;
}

export interface MinimalActor {
  id: string;
  name: string;
  type: string;
  isOwner: boolean;
  img?: string;
}

export interface MinimalGame {
  user: { character: { id: string } | null };
  actors: { filter(predicate: (a: MinimalActor) => boolean): MinimalActor[] };
}

export type CharacterResolution =
  | { kind: "resolved"; actorId: string }
  | { kind: "picker"; candidates: ActorSummary[] }
  | { kind: "none" };

/**
 * Decide which character to show:
 *  - the assigned `user.character` if set;
 *  - else owned PF2e `character`-type actors: 0 → none, 1 → auto-select, 2+ → picker.
 */
export function resolveCharacter(game: MinimalGame): CharacterResolution {
  const assigned = game.user.character;
  if (assigned) return { kind: "resolved", actorId: assigned.id };

  const owned = game.actors.filter((a) => a.isOwner && a.type === "character");
  if (owned.length === 0) return { kind: "none" };
  if (owned.length === 1) return { kind: "resolved", actorId: owned[0].id };
  return {
    kind: "picker",
    candidates: owned.map((a) => ({ id: a.id, name: a.name, img: a.img })),
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/character.test.ts`
Expected: PASS (5 tests).

---

## Task 4: Zustand store (TDD)

**Files:**
- Create: `src/app/store.ts`
- Test: `tests/store.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/store.test.ts`

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../src/app/store";

describe("useAppStore", () => {
  beforeEach(() => useAppStore.setState({ activeTab: "sheet", actorId: null }));

  it("defaults to the sheet tab and no actor", () => {
    const s = useAppStore.getState();
    expect(s.activeTab).toBe("sheet");
    expect(s.actorId).toBeNull();
  });
  it("switches tabs", () => {
    useAppStore.getState().setActiveTab("combat");
    expect(useAppStore.getState().activeTab).toBe("combat");
  });
  it("sets and clears the actor id", () => {
    useAppStore.getState().setActorId("hero");
    expect(useAppStore.getState().actorId).toBe("hero");
    useAppStore.getState().setActorId(null);
    expect(useAppStore.getState().actorId).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run tests/store.test.ts`
Expected: FAIL — cannot resolve `../src/app/store`.

- [ ] **Step 3: Implement `src/app/store.ts`**

```ts
import { create } from "zustand";

export type TabId = "sheet" | "actions" | "combat" | "journal" | "map";

export interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  actorId: string | null;
  setActorId: (id: string | null) => void;
}

/** Mirrors UI state only; Foundry Documents remain the source of truth. */
export const useAppStore = create<AppState>((set) => ({
  activeTab: "sheet",
  setActiveTab: (tab) => set({ activeTab: tab }),
  actorId: null,
  setActorId: (id) => set({ actorId: id }),
}));
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run tests/store.test.ts`
Expected: PASS (3 tests).

---

## Task 5: Foundry adapter — settings & takeover

**Files:**
- Create: `src/foundry/settings.ts`
- Create: `src/foundry/takeover.ts`

These touch Foundry globals — use pragmatic casts per the conventions note. No unit tests (verified manually + by typecheck).

- [ ] **Step 1: Create `src/foundry/settings.ts`**

```ts
import { detectMobile, type UiMode } from "./mobile";

export const MODULE_ID = "pf2e-mobile-companion";

/** Register client settings at `init`. `onUiModeChange` runs when the user
 *  flips the mode (e.g. from Foundry's settings menu or our in-app control). */
export function registerSettings(onUiModeChange: () => void): void {
  game.settings.register(MODULE_ID, "uiMode", {
    name: "Mobile UI mode",
    hint: "Automatic uses your device and screen size. 'Always on' forces the mobile UI (handy for testing on desktop). 'Always off' keeps Foundry's normal interface.",
    scope: "client",
    config: true,
    type: String,
    choices: { auto: "Automatic", on: "Always on", off: "Always off" },
    default: "auto",
    onChange: () => onUiModeChange(),
  } as any);

  // Remembers the user's canvas preference before mobile mode forced it off,
  // so exiting mobile mode restores it instead of leaving canvas disabled.
  game.settings.register(MODULE_ID, "priorNoCanvas", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  } as any);
}

export function getUiMode(): UiMode {
  return ((game as any).settings.get(MODULE_ID, "uiMode") as UiMode) ?? "auto";
}
export async function setUiMode(mode: UiMode): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "uiMode", mode);
}

/** Combine the user's override setting with live device signals. */
export function isMobileActive(): boolean {
  return detectMobile({
    ua: navigator.userAgent,
    width: window.innerWidth,
    override: getUiMode(),
  });
}

export function getNoCanvas(): boolean {
  return Boolean((game as any).settings.get("core", "noCanvas"));
}
export async function setNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set("core", "noCanvas", value);
}

export function getPriorNoCanvas(): boolean {
  return Boolean((game as any).settings.get(MODULE_ID, "priorNoCanvas"));
}
export async function setPriorNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "priorNoCanvas", value);
}
```

- [ ] **Step 2: Create `src/foundry/takeover.ts`**

```ts
import { getNoCanvas, setNoCanvas, getPriorNoCanvas, setPriorNoCanvas } from "./settings";

const MODULE_ID = "pf2e-mobile-companion";
const ROOT_ID = `${MODULE_ID}-root`;
const BODY_CLASS = "pf2e-mobile-active";
const RELOAD_SENTINEL = "pf2e-mc-canvas-reload";

export function isTakeoverActive(): boolean {
  return document.body.classList.contains(BODY_CLASS);
}

/**
 * Ensure the canvas is disabled, then hide stock UI and mount the app.
 * If `noCanvas` had to be turned on, persist it and reload once (guarded against
 * a loop); `mountFn` then runs after the reload, on the next `ready`.
 */
export async function applyTakeover(
  mountFn: (container: HTMLElement) => void | Promise<void>,
): Promise<void> {
  if (!getNoCanvas()) {
    if (sessionStorage.getItem(RELOAD_SENTINEL)) {
      console.error(`${MODULE_ID} | noCanvas did not persist; aborting reload to avoid a loop`);
      return;
    }
    sessionStorage.setItem(RELOAD_SENTINEL, "1");
    await setPriorNoCanvas(getNoCanvas());
    await setNoCanvas(true);
    location.reload();
    return;
  }
  sessionStorage.removeItem(RELOAD_SENTINEL);

  document.body.classList.add(BODY_CLASS);

  document.getElementById(ROOT_ID)?.remove();
  const container = document.createElement("div");
  container.id = ROOT_ID;
  document.body.appendChild(container);
  await mountFn(container);
}

/** Remove the takeover, restore the user's prior canvas preference, and reload. */
export async function removeTakeover(): Promise<void> {
  document.body.classList.remove(BODY_CLASS);
  document.getElementById(ROOT_ID)?.remove();
  await setNoCanvas(getPriorNoCanvas());
  location.reload();
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). If `fvtt-types` complains about `game`/settings shapes, widen with `as any` per the conventions note — do not redesign.

---

## Task 6: React app — hooks, shell, tabs

**Files:**
- Create: `src/app/useFoundryHook.ts`
- Create: `src/app/useFullscreen.ts`
- Create: `src/app/tabs/Placeholder.tsx`
- Create: `src/app/SheetTab.tsx`
- Create: `src/app/TabBar.tsx`
- Create: `src/app/TabContent.tsx`
- Create: `src/app/Shell.tsx`
- Modify: `src/app/App.tsx` (replace the Phase 0 placeholder)

Depends on Tasks 3 (`character.ts`), 4 (`store.ts`), 5 (`settings.ts`). Icons use Foundry's bundled Font Awesome (`<i className="fas …">`) — no dependency.

- [ ] **Step 1: `src/app/useFoundryHook.ts`** — register/unregister a Foundry hook with the component lifecycle.

```ts
import { useEffect } from "react";

/** Register a Foundry hook on mount, remove it on unmount. The backbone for
 *  later phases. Pass a stable `handler` (e.g. via useCallback) to avoid
 *  re-subscribing on every render. */
export function useFoundryHook(hookName: string, handler: (...args: any[]) => void): void {
  useEffect(() => {
    const id = Hooks.on(hookName as any, handler as any);
    return () => {
      Hooks.off(hookName as any, id as any);
    };
  }, [hookName, handler]);
}
```

- [ ] **Step 2: `src/app/useFullscreen.ts`** — Fullscreen API toggle driven by the `fullscreenchange` event.

```ts
import { useCallback, useEffect, useState } from "react";

export function useFullscreen(): { isFullscreen: boolean; toggle: () => void } {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => document.fullscreenElement != null);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen().catch((e) => {
        console.warn("pf2e-mobile-companion | fullscreen request rejected", e);
      });
    }
  }, []);

  return { isFullscreen, toggle };
}
```

- [ ] **Step 3: `src/app/tabs/Placeholder.tsx`** — shared "coming later" panel for the not-yet-built tabs.

```tsx
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
      <i className="fas fa-hammer text-3xl" aria-hidden="true" />
      <div className="text-lg font-semibold text-zinc-300">{title}</div>
      <div className="text-sm">{phase}</div>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/SheetTab.tsx`** — character resolution / picker (Phase 1 shows identity only; live sheet is Phase 2).

```tsx
import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "./store";
import { resolveCharacter, type CharacterResolution, type MinimalGame } from "../foundry/character";
import { useFoundryHook } from "./useFoundryHook";

function readGame(): MinimalGame {
  return game as unknown as MinimalGame;
}

export function SheetTab() {
  const actorId = useAppStore((s) => s.actorId);
  const setActorId = useAppStore((s) => s.setActorId);

  const [resolution, setResolution] = useState<CharacterResolution>(() => resolveCharacter(readGame()));
  const recompute = useCallback(() => setResolution(resolveCharacter(readGame())), []);
  useFoundryHook("updateUser", recompute);

  // Auto-select when the system resolves a single/assigned character.
  useEffect(() => {
    if (resolution.kind === "resolved") setActorId(resolution.actorId);
  }, [resolution, setActorId]);

  if (actorId) {
    const actor = (game as any).actors.get(actorId);
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        {actor?.img && (
          <img src={actor.img} alt="" className="h-28 w-28 rounded-lg object-cover" />
        )}
        <div className="text-xl font-semibold">{actor?.name ?? "Unknown actor"}</div>
        <div className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
          Live character sheet arrives in Phase 2.
        </div>
        {resolution.kind === "picker" && (
          <button className="text-sm text-indigo-400 underline" onClick={() => setActorId(null)}>
            Switch character
          </button>
        )}
      </div>
    );
  }

  if (resolution.kind === "picker") {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="text-sm text-zinc-400">Choose your character:</div>
        {resolution.candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => setActorId(c.id)}
            className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3 text-left"
          >
            {c.img && <img src={c.img} alt="" className="h-10 w-10 rounded object-cover" />}
            <span className="font-medium">{c.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-400">
      <i className="fas fa-user-slash text-3xl" aria-hidden="true" />
      <div>No character to show.</div>
      <div className="text-sm">Ask your GM to give you ownership of a character actor.</div>
    </div>
  );
}
```

- [ ] **Step 5: `src/app/TabBar.tsx`** — bottom navigation, ≥44px targets, safe-area padding, FA icons.

```tsx
import type { TabId } from "./store";
import { useAppStore } from "./store";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "sheet", label: "Sheet", icon: "fa-user" },
  { id: "actions", label: "Actions", icon: "fa-bolt" },
  { id: "combat", label: "Combat", icon: "fa-dice-d20" },
  { id: "journal", label: "Journal", icon: "fa-book-open" },
  { id: "map", label: "Map", icon: "fa-map" },
];

export function TabBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex shrink-0 border-t border-zinc-800 bg-zinc-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={active}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
              active ? "text-indigo-400" : "text-zinc-400"
            }`}
            style={{ minHeight: 56 }}
          >
            <i className={`fas ${tab.icon} text-lg`} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: `src/app/TabContent.tsx`** — render the active tab.

```tsx
import { useAppStore } from "./store";
import { SheetTab } from "./SheetTab";
import { Placeholder } from "./tabs/Placeholder";

export function TabContent() {
  const activeTab = useAppStore((s) => s.activeTab);
  switch (activeTab) {
    case "sheet":
      return <SheetTab />;
    case "actions":
      return <Placeholder title="Actions & Macros" phase="Coming in Phase 4" />;
    case "combat":
      return <Placeholder title="Combat Tracker" phase="Coming in Phase 5" />;
    case "journal":
      return <Placeholder title="Journals" phase="Coming in Phase 6" />;
    case "map":
      return <Placeholder title="Battle Map" phase="Coming in Phase 7" />;
    default:
      return null;
  }
}
```

- [ ] **Step 7: `src/app/Shell.tsx`** — header (title + fullscreen + escape-to-desktop), scrollable content, bottom tab bar.

```tsx
import { useAppStore } from "./store";
import { TabBar } from "./TabBar";
import { TabContent } from "./TabContent";
import { useFullscreen } from "./useFullscreen";
import { setUiMode } from "../foundry/settings";

export function Shell() {
  const { isFullscreen, toggle } = useFullscreen();
  const actorId = useAppStore((s) => s.actorId);
  const title = actorId ? ((game as any).actors.get(actorId)?.name ?? "PF2e Mobile") : "PF2e Mobile";

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <span className="truncate font-semibold">{title}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            aria-label="Toggle fullscreen"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i className={`fas ${isFullscreen ? "fa-compress" : "fa-expand"}`} aria-hidden="true" />
          </button>
          <button
            onClick={() => void setUiMode("off")}
            aria-label="Exit to desktop UI"
            className="flex h-10 w-10 items-center justify-center text-zinc-300"
          >
            <i className="fas fa-display" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <TabContent />
      </main>
      <TabBar />
    </div>
  );
}
```

- [ ] **Step 8: Replace `src/app/App.tsx`**

```tsx
import "../styles/tailwind.css";
import { Shell } from "./Shell";

export function App() {
  return <Shell />;
}
```

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Use pragmatic casts for any `game` global friction.

---

## Task 7: Wire it together in `module.ts`

**Files:**
- Modify: `src/module.ts` (replace the Phase 0 body, keep `installReactRefreshPreamble`)

Depends on Tasks 5 and 6.

- [ ] **Step 1: Replace `src/module.ts`**

```ts
import { registerSettings, isMobileActive } from "./foundry/settings";
import { applyTakeover, removeTakeover, isTakeoverActive } from "./foundry/takeover";

const MODULE_ID = "pf2e-mobile-companion";

// Hooks are registered synchronously at module-eval time so they exist before
// Foundry fires `init`.
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerSettings(() => {
    void onUiModeChange();
  });
});

Hooks.once("ready", async () => {
  if (!isMobileActive()) {
    console.log(`${MODULE_ID} | desktop mode — leaving Foundry UI intact`);
    return;
  }
  console.log(`${MODULE_ID} | mobile mode — taking over`);
  await installReactRefreshPreamble();
  await applyTakeover(mountApp);
});

/** Re-evaluate when the user flips the UI-mode setting at runtime. */
async function onUiModeChange(): Promise<void> {
  const shouldBeMobile = isMobileActive();
  const active = isTakeoverActive();
  if (shouldBeMobile && !active) {
    await installReactRefreshPreamble();
    await applyTakeover(mountApp);
  } else if (!shouldBeMobile && active) {
    await removeTakeover();
  }
}

/** Lazily import React + the app (kept out of static imports so the dev Fast
 *  Refresh preamble is installed first). */
async function mountApp(container: HTMLElement): Promise<void> {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App } = await import("./app/App");
  createRoot(container).render(createElement(App));
}

/**
 * Vite injects @vitejs/plugin-react's Fast Refresh preamble into index.html;
 * Foundry serves its own HTML, so we install it ourselves before any React
 * module loads. Dev-only — stripped from production builds.
 */
async function installReactRefreshPreamble(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const win = window as unknown as Record<string, unknown>;
  if (win.__vite_plugin_react_preamble_installed__) return;

  const mod = await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}@react-refresh`);
  const RefreshRuntime = mod.default ?? mod;
  RefreshRuntime.injectIntoGlobalHook(window);
  win.$RefreshReg$ = () => {};
  win.$RefreshSig$ = () => (type: unknown) => type;
  win.__vite_plugin_react_preamble_installed__ = true;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: PASS — 3 test files, 15 tests total (7 + 5 + 3).

- [ ] **Step 2: Typecheck the whole project**

Run: `npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds; `dist/module.js` and `dist/style.css` exist, and `dist/style.css` is non-trivial (contains Tailwind utilities used by the components — e.g. search it for `.flex`).

- [ ] **Step 4: Manual verification checklist** (record results; this is the milestone proof — requires a running Foundry + the dev server per README)

1. Desktop Chrome, `uiMode = Automatic`: Foundry looks completely normal (no takeover, canvas present).
2. Chrome DevTools device emulation (or `uiMode = Always on`) + reload: stock UI (`#interface`, sidebar, hotbar, navigation) is hidden; the React shell fills the screen.
3. DevTools Performance/Memory: with mobile active, the canvas is disabled — JS heap and idle CPU are lower than desktop; no `canvas.*` errors in the console.
4. Bottom tabs switch content; Sheet shows the assigned character (or a picker if several actors are owned, or the empty state if none); the other four tabs show their "coming in Phase N" placeholder.
5. Fullscreen button enters/exits fullscreen.
6. Escape-to-desktop button (monitor icon) → page reloads → Foundry's normal UI is back and the canvas is restored.
7. A second client (GM on desktop) is visually unchanged the entire time.

---

## Self-review notes (completed by plan author)

- **Spec coverage:** detection (T2) ✓; override setting (T5) ✓; `core.noCanvas` save/set/restore + one-time reload (T5 `takeover.ts`, T7 wiring) ✓; hide stock UI via body class (T1 CSS) ✓; full-screen root mount (T5/T7) ✓; bottom tab nav (T6) ✓; Zustand store (T4) ✓; `useFoundryHook` (T6) ✓; character resolution + picker (T3 logic, T6 UI) ✓; escape-to-desktop (T6 Shell + T7 onChange) ✓; fullscreen button (T6) ✓; Tailwind no-preflight + scoped reset + style.css filename (T1) ✓; Vitest for pure logic (T2–T4) + manual checklist (T8) ✓.
- **Type consistency:** `UiMode` defined in `mobile.ts`, imported by `settings.ts`; `TabId` in `store.ts`, imported by `TabBar`; `CharacterResolution`/`MinimalGame` in `character.ts`, imported by tests + `SheetTab`. `applyTakeover(mountFn)` signature matches `mountApp` in `module.ts`. `registerSettings(onUiModeChange)` matches the call in `module.ts`.
- **Ordering for the orchestrator:** T1 → (T2, T3, T4 parallel) → T5 → T6 → T7 → T8. `mobile.ts` is pure (no `settings` import), so T2/T3/T4 are fully independent and parallel-safe. `settings.ts` (T5) owns `isMobileActive`, importing the pure `detectMobile` from `mobile.ts` — one-directional, no cycle.
