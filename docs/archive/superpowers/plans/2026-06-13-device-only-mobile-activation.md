# Device-only Mobile Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile UI take over purely from the device (phone/tablet, including modern iPadOS), remove the `uiMode` override and the inaccessible left-toolbar settings, and delete the now-dead off-switch machinery — so a phone can never be stranded in desktop mode.

**Architecture:** A new pure predicate `isMobileDevice({ ua, maxTouchPoints })` replaces `detectMobile`; `isMobileActive()` calls it with live `navigator` signals. The `uiMode` client setting, the `getSceneControlButtons` toolbar category, and the `removeTakeover` / `priorNoCanvas` plumbing are removed. The `mapRenderer` (Canvas/Lite) setting and the in-app cogwheel popup stay. Tasks are ordered so every commit leaves typecheck + tests + build green.

**Tech Stack:** TypeScript (strict, no `noUnusedLocals`), React 18, Vitest 4, Vite 6, Foundry VTT v14 module APIs.

**Spec:** `docs/superpowers/specs/2026-06-13-device-only-mobile-activation-design.md`

**Verification commands (used in every task):**
- Typecheck: `npm run typecheck`  → expected: no errors
- Tests: `npm test`  → expected: all files pass
- Build: `npm run build`  → expected: built successfully

**Commit convention:** commit directly to `main`; messages `device-only-mobile (Task N): …` ending with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Do **not** stage unrelated working-tree files (there is in-progress canvas work in `src/app/map/`, `src/foundry/canvas/`, `src/foundry/scene/`, and their tests); stage only the files each task names.

---

## File Structure

- `src/foundry/mobile.ts` — pure detection + map-renderer helpers. After: `isMobileUA`, new `isMobileDevice`/`DeviceSignals`, `MapRenderer`, `desiredNoCanvas`. Removed: `UiMode`, `DetectMobileInput`, `detectMobile`, `WIDTH_BREAKPOINT`.
- `src/foundry/settings.ts` — Foundry-bound settings + `isMobileActive`. After: registers only `mapRenderer`; `isMobileActive` is device-only. Removed: `uiMode` + `priorNoCanvas` registration and their get/set helpers, `getUiMode`/`setUiMode`.
- `src/foundry/takeover.ts` — apply takeover + reconcile renderer. Removed: `removeTakeover`, the `priorNoCanvas` save.
- `src/module.ts` — Foundry hook glue. Removed: `getSceneControlButtons` toolbar hook, `onUiModeChange`.
- `src/app/SettingsModal.tsx` — in-app cogwheel popup. After: only the "Battle map renderer" group.
- `src/foundry/controls/moduleControl.ts` — **deleted** (toolbar category).
- `tests/deviceDetection.test.ts` — **created** (covers `isMobileUA` + `isMobileDevice`).
- `tests/moduleControl.test.ts` — **deleted**.
- `tests/detectMobile.test.ts` — **deleted** (replaced by `deviceDetection.test.ts`).

---

## Task 1: Add `isMobileDevice` device detection (TDD, additive)

**Files:**
- Create: `tests/deviceDetection.test.ts`
- Modify: `src/foundry/mobile.ts`

This task is purely additive — `detectMobile`/`UiMode` stay in place so nothing breaks yet.

- [ ] **Step 1: Write the failing test**

Create `tests/deviceDetection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isMobileUA, isMobileDevice } from "../src/foundry/mobile";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
// iPadOS 13+ Safari masquerades as desktop macOS — no "iPad" token.
const IPAD_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("isMobileUA", () => {
  it("detects Android phones", () => expect(isMobileUA(ANDROID_UA)).toBe(true));
  it("detects iPhones", () => expect(isMobileUA(IPHONE_UA)).toBe(true));
  it("rejects desktop", () => expect(isMobileUA(DESKTOP_UA)).toBe(false));
  it("does not match a modern iPad / Mac UA on its own", () =>
    expect(isMobileUA(IPAD_UA)).toBe(false));
});

describe("isMobileDevice", () => {
  it("true for an Android phone", () =>
    expect(isMobileDevice({ ua: ANDROID_UA, maxTouchPoints: 5 })).toBe(true));
  it("true for an iPhone", () =>
    expect(isMobileDevice({ ua: IPHONE_UA, maxTouchPoints: 5 })).toBe(true));
  it("true for a modern iPad (Macintosh UA + multi-touch)", () =>
    expect(isMobileDevice({ ua: IPAD_UA, maxTouchPoints: 5 })).toBe(true));
  it("false for a MacBook (Macintosh UA, no touchscreen)", () =>
    expect(isMobileDevice({ ua: IPAD_UA, maxTouchPoints: 0 })).toBe(false));
  it("false for a wide desktop", () =>
    expect(isMobileDevice({ ua: DESKTOP_UA, maxTouchPoints: 0 })).toBe(false));
  it("false for a touchscreen Windows laptop (Windows UA + multi-touch)", () =>
    expect(isMobileDevice({ ua: DESKTOP_UA, maxTouchPoints: 10 })).toBe(false));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/deviceDetection.test.ts`
Expected: FAIL — `isMobileDevice` is not exported / `not a function`.

- [ ] **Step 3: Add the implementation to `src/foundry/mobile.ts`**

Insert this block immediately **after** the existing `isMobileUA` function (keep everything else in the file unchanged for now):

```ts
export interface DeviceSignals {
  ua: string;
  maxTouchPoints: number;
}

/** True when the client is a phone or tablet. iPadOS 13+ Safari reports a
 *  desktop "Macintosh" UA, so an iPad is distinguished from a real Mac (which
 *  has no touchscreen) by multi-touch support. */
export function isMobileDevice({ ua, maxTouchPoints }: DeviceSignals): boolean {
  if (isMobileUA(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/deviceDetection.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean, all test files pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/foundry/mobile.ts tests/deviceDetection.test.ts
git commit -m "device-only-mobile (Task 1): add isMobileDevice (UA + iPad multi-touch)

Pure predicate detecting phones/tablets, including modern iPadOS which
reports a desktop Macintosh UA but exposes multi-touch.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Remove the left-toolbar settings category

**Files:**
- Delete: `src/foundry/controls/moduleControl.ts`
- Delete: `tests/moduleControl.test.ts`
- Modify: `src/module.ts`

The toolbar category is unreachable on a phone and its only purpose was flipping `uiMode`/`mapRenderer` from desktop. Remove it. (`getUiMode`/`setUiMode` are only used by this hook and by `SettingsModal`; this task removes the hook's use of them.)

- [ ] **Step 1: Delete the two files**

```bash
git rm src/foundry/controls/moduleControl.ts tests/moduleControl.test.ts
```

(If `git rm` reports the path is not tracked, delete with the Bash `rm` instead.)

- [ ] **Step 2: Edit `src/module.ts` — trim the settings import**

Replace:

```ts
import {
  registerSettings, isMobileActive,
  getUiMode, setUiMode, getMapRenderer, setMapRenderer,
} from "./foundry/settings";
```

with:

```ts
import { registerSettings, isMobileActive } from "./foundry/settings";
```

- [ ] **Step 3: Edit `src/module.ts` — remove the `buildModuleControl` import**

Delete this line:

```ts
import { buildModuleControl } from "./foundry/controls/moduleControl";
```

- [ ] **Step 4: Edit `src/module.ts` — remove the toolbar hook**

Delete this entire block (the comment and the `Hooks.on("getSceneControlButtons", …)` call):

```ts
// Add a module category to the left scene-controls toolbar mirroring the two
// client settings as radio-style toggle buttons. The stock toolbar is hidden
// while mobile takeover is active, so these are used from a desktop session.
Hooks.on("getSceneControlButtons", (controls: Record<string, unknown>) => {
  controls[MODULE_ID] = buildModuleControl({
    uiMode: getUiMode(),
    mapRenderer: getMapRenderer(),
    onSelectUiMode: (mode) => {
      void setUiMode(mode).then(() => (ui as any).controls?.render());
    },
    onSelectMapRenderer: (value) => {
      void setMapRenderer(value).then(() => (ui as any).controls?.render());
    },
  });
});
```

The `init` hook, `ready` hook, `onUiModeChange`, `mountApp`, and `installReactRefreshPreamble` stay unchanged in this task.

- [ ] **Step 5: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean (no remaining reference to `buildModuleControl`/`moduleControl`), all test files pass (`moduleControl.test.ts` is gone), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/module.ts src/foundry/controls/moduleControl.ts tests/moduleControl.test.ts
git commit -m "device-only-mobile (Task 2): remove the left-toolbar settings category

The PF2e Mobile scene-controls category was unreachable on a phone; delete
the builder, its test, and the getSceneControlButtons hook.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Trim the in-app Settings popup to renderer-only

**Files:**
- Modify: `src/app/SettingsModal.tsx`

Remove the "Mobile UI mode" group; keep only "Battle map renderer". After this, `getUiMode`/`setUiMode` have no remaining consumers.

- [ ] **Step 1: Replace the full contents of `src/app/SettingsModal.tsx`**

```tsx
import { useState } from "react";
import { Modal } from "./sheet/parts/Modal";
import { getMapRenderer, setMapRenderer } from "../foundry/settings";
import type { MapRenderer } from "../foundry/mobile";

const MAP_RENDERER_CHOICES: { value: MapRenderer; label: string }[] = [
  { value: "canvas", label: "Foundry canvas (full)" },
  { value: "lite", label: "Lite (fast)" },
];

function Group<T extends string>({ heading, choices, selected, onSelect }: {
  heading: string;
  choices: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {heading}
      </div>
      <div className="grid gap-1">
        {choices.map((c) => {
          const active = c.value === selected;
          return (
            <button
              key={c.value}
              onClick={() => onSelect(c.value)}
              className={`flex min-h-12 items-center justify-start gap-2 rounded-md px-3 text-left text-sm font-medium ${
                active ? "bg-zinc-700 ring-2 ring-amber-500" : "bg-zinc-800"
              }`}
            >
              <i
                className={`fas fa-check w-4 ${active ? "text-amber-400" : "invisible"}`}
                aria-hidden="true"
              />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [mapRenderer, setMapRendererState] = useState<MapRenderer>(getMapRenderer());

  return (
    <Modal title="Settings" onClose={onClose}>
      <Group
        heading="Battle map renderer"
        choices={MAP_RENDERER_CHOICES}
        selected={mapRenderer}
        onSelect={(value) => { setMapRendererState(value); void setMapRenderer(value); }}
      />
    </Modal>
  );
}
```

- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: all clean. (`getUiMode`/`setUiMode`/`UiMode` still exist in `settings.ts`/`mobile.ts`; they are simply unused now and removed in Task 4.)

- [ ] **Step 3: Manual sanity (note for the reviewer, not a blocker)**

The cogwheel popup should now show a single "Battle map renderer" group with Foundry canvas / Lite. (Confirmed live in a later play-test.)

- [ ] **Step 4: Commit**

```bash
git add src/app/SettingsModal.tsx
git commit -m "device-only-mobile (Task 3): trim Settings popup to the renderer choice

Drop the Mobile UI mode group from the in-app cogwheel; only Canvas/Lite
remains (it can't strand the user).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Device-only detection + remove `uiMode` setting and off-switch plumbing

**Files:**
- Modify: `src/foundry/settings.ts`
- Modify: `src/foundry/mobile.ts`
- Modify: `src/foundry/takeover.ts`
- Modify: `src/module.ts`
- Delete: `tests/detectMobile.test.ts`

This task removes the now-orphaned `uiMode`/`detectMobile`/`removeTakeover`/`priorNoCanvas` code in one coherent commit, and points `isMobileActive` at `isMobileDevice`.

- [ ] **Step 1: Replace the full contents of `src/foundry/settings.ts`**

```ts
import { isMobileDevice, type MapRenderer } from "./mobile";

export const MODULE_ID = "pf2e-mobile-companion";

/** Register client settings at `init`. `onMapRendererChange` runs when the user
 *  flips the map renderer (from Foundry's settings menu or the in-app cogwheel). */
export function registerSettings(onMapRendererChange: () => void): void {
  (game as any).settings.register(MODULE_ID, "mapRenderer", {
    name: "Battle map renderer",
    hint: "Canvas mirrors Foundry's real map — walls, dynamic lighting, fog of war — on the Map tab only (paused elsewhere). Lite is a faster image-and-tokens map for low-power devices.",
    scope: "client",
    config: true,
    type: String,
    choices: { canvas: "Foundry canvas (full)", lite: "Lite (fast)" },
    default: "canvas",
    onChange: () => onMapRendererChange(),
  });
}

export function getMapRenderer(): MapRenderer {
  return ((game as any).settings.get(MODULE_ID, "mapRenderer") as MapRenderer) ?? "canvas";
}
export async function setMapRenderer(value: MapRenderer): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "mapRenderer", value);
}

/** True when the mobile UI should take over: a real phone or tablet (incl.
 *  modern iPadOS, which reports a desktop UA but exposes multi-touch). */
export function isMobileActive(): boolean {
  return isMobileDevice({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function getNoCanvas(): boolean {
  return Boolean((game as any).settings.get("core", "noCanvas"));
}
export async function setNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set("core", "noCanvas", value);
}

export { desiredNoCanvas } from "./mobile";
export type { MapRenderer } from "./mobile";
```

- [ ] **Step 2: Replace the full contents of `src/foundry/mobile.ts`**

```ts
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

export function isMobileUA(ua: string): boolean {
  return MOBILE_UA.test(ua);
}

export interface DeviceSignals {
  ua: string;
  maxTouchPoints: number;
}

/** True when the client is a phone or tablet. iPadOS 13+ Safari reports a
 *  desktop "Macintosh" UA, so an iPad is distinguished from a real Mac (which
 *  has no touchscreen) by multi-touch support. */
export function isMobileDevice({ ua, maxTouchPoints }: DeviceSignals): boolean {
  if (isMobileUA(ua)) return true;
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export type MapRenderer = "canvas" | "lite";

/** Pure: the `core.noCanvas` value a given Map renderer needs. The canvas map
 *  needs the canvas ON (noCanvas false); the lite DOM map needs it OFF (true). */
export function desiredNoCanvas(renderer: MapRenderer): boolean {
  return renderer === "lite";
}
```

- [ ] **Step 3: Replace the full contents of `src/foundry/takeover.ts`**

```ts
import {
  getNoCanvas, setNoCanvas, getMapRenderer, desiredNoCanvas,
} from "./settings";

const MODULE_ID = "pf2e-mobile-companion";
const ROOT_ID = `${MODULE_ID}-root`;
const BODY_CLASS = "pf2e-mobile-active";
const RELOAD_SENTINEL = "pf2e-mc-canvas-reload";

export function isTakeoverActive(): boolean {
  return document.body.classList.contains(BODY_CLASS);
}

/**
 * Ensure `core.noCanvas` matches the chosen map renderer (false for canvas,
 * true for lite), then hide stock UI and mount the app. If it had to be flipped,
 * persist the new value and reload once (guarded against a loop); `mountFn` then
 * runs after the reload, on the next `ready`.
 */
export async function applyTakeover(
  mountFn: (container: HTMLElement) => void | Promise<void>,
): Promise<void> {
  // The canvas requirement depends on the chosen Map renderer: canvas mode wants
  // it ON (noCanvas false), lite mode OFF (true). Flip + reload once if needed.
  const want = desiredNoCanvas(getMapRenderer());
  if (getNoCanvas() !== want) {
    if (sessionStorage.getItem(RELOAD_SENTINEL)) {
      console.error(`${MODULE_ID} | noCanvas did not settle; aborting reload to avoid a loop`);
      return;
    }
    sessionStorage.setItem(RELOAD_SENTINEL, "1");
    await setNoCanvas(want);
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

/** Re-evaluate the canvas on/off requirement when the map-renderer setting
 *  changes at runtime (only while the mobile UI is up). Flips `core.noCanvas`
 *  and reloads so Foundry (re)initializes — or skips — the canvas. */
export async function reconcileMapRenderer(): Promise<void> {
  if (!isTakeoverActive()) return;
  const want = desiredNoCanvas(getMapRenderer());
  if (getNoCanvas() !== want) {
    await setNoCanvas(want);
    location.reload();
  }
}
```

- [ ] **Step 4: Replace the full contents of `src/module.ts`**

```ts
import { registerSettings, isMobileActive } from "./foundry/settings";
import { applyTakeover, reconcileMapRenderer } from "./foundry/takeover";
import { installStrikeRollDialogHook } from "./foundry/actor/strikeActions";

const MODULE_ID = "pf2e-mobile-companion";

// Hooks are registered synchronously at module-eval time so they exist before
// Foundry fires `init`.
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerSettings(() => { void reconcileMapRenderer(); });
});

Hooks.once("ready", async () => {
  if (!isMobileActive()) {
    console.log(`${MODULE_ID} | desktop mode — leaving Foundry UI intact`);
    return;
  }
  console.log(`${MODULE_ID} | mobile mode — taking over`);
  installStrikeRollDialogHook();
  await installReactRefreshPreamble();
  await applyTakeover(mountApp);
});

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

- [ ] **Step 5: Delete the obsolete detection test**

```bash
git rm tests/detectMobile.test.ts
```

(`detectMobile` no longer exists; `isMobileDevice` is covered by `tests/deviceDetection.test.ts`.)

- [ ] **Step 6: Full verification**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean (no references to `UiMode`, `detectMobile`, `getUiMode`, `setUiMode`, `removeTakeover`, `getPriorNoCanvas`, `setPriorNoCanvas`, `isTakeoverActive` in `module.ts`), all test files pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/foundry/settings.ts src/foundry/mobile.ts src/foundry/takeover.ts src/module.ts tests/detectMobile.test.ts
git commit -m "device-only-mobile (Task 4): device-only activation; drop uiMode + off-switch

isMobileActive now uses isMobileDevice (navigator UA + maxTouchPoints). Remove
the uiMode setting, detectMobile/UiMode, removeTakeover, and the priorNoCanvas
plumbing — a phone always takes over and can no longer be stranded.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Device-only detection incl. iPad → Task 1 (function + tests) and Task 4 (`isMobileActive` wiring). ✓
- Remove `uiMode` setting + `getUiMode`/`setUiMode` + `onUiModeChange` → Task 4 (settings.ts, module.ts). ✓
- Remove left-toolbar category (`moduleControl.ts`, hook, test) → Task 2. ✓
- Remove off-switch machinery (`removeTakeover`, `priorNoCanvas` save/registration/getters) → Task 4. ✓
- Keep `mapRenderer` setting + cogwheel; trim modal to renderer-only → Task 3 (modal), Task 4 (settings keeps `mapRenderer`). ✓
- Tests: add `deviceDetection.test.ts` (Task 1), delete `moduleControl.test.ts` (Task 2), delete `detectMobile.test.ts` (Task 4). ✓

**Placeholder scan:** none — every step shows full code or an exact command.

**Type consistency:** `isMobileDevice({ ua, maxTouchPoints })` / `DeviceSignals` identical in `mobile.ts` (Tasks 1, 4), the test (Task 1), and `settings.ts` (Task 4). `registerSettings(onMapRendererChange: () => void)` matches the single-arg call `registerSettings(() => { void reconcileMapRenderer(); })` in `module.ts` (Task 4). `MapRenderer` re-exported from `settings.ts` and imported by `SettingsModal.tsx` (Task 3) and `MapTab.tsx` (unchanged). `getMapRenderer`/`setMapRenderer`/`getNoCanvas`/`setNoCanvas`/`desiredNoCanvas` retained and consumed by `takeover.ts` (Task 4). ✓

**Ordering safety:** each task leaves typecheck + tests + build green — consumers are removed before/with definitions (toolbar hook → Task 2; modal `getUiMode`/`setUiMode` use → Task 3; the definitions themselves → Task 4). `tsconfig` has no `noUnusedLocals`, so any transient unused export between tasks is not a compile error regardless. ✓
