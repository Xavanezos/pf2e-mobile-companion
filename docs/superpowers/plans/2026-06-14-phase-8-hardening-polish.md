# Phase 8 — hardening, settings, pinning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coalesce scene/combat re-prep into one render per frame, show a reconnection scrim when the socket drops, add three phone-relevant client settings (default tab / vibration / font size), and record the pf2e tested version in the manifest.

**Architecture:** Established pattern — pure mappers (`fontScalePx`, `coerceTabId`) are unit-tested; thin hooks (`useBatchedRefresh`, `useConnectionStatus`) and small UI (`ReconnectionOverlay`, settings controls) are verified by typecheck + build + manual check, matching the codebase's existing "pure logic tested, hooks manual" stance. Settings are read where they matter (mount / buzz time) and applied directly on change — no reactive settings plumbing.

**Tech Stack:** React 18, Zustand 5, Vite 6 (single-file library build), Vitest 4, Tailwind v4 (no preflight), Foundry v14 / pf2e v8.2 globals.

**Spec:** `docs/superpowers/specs/2026-06-14-phase-8-hardening-polish-design.md`

**Per-task gate (run before every commit):**
```
npm test           # 260 baseline + new pure tests, all green
npm run typecheck  # tsc --noEmit, no errors
npm run build      # vite production build, succeeds
```

**Commit style (this repo):** plain conventional-commit subjects, lowercase. **No `Co-Authored-By` trailer**, no "Generated with" lines. Comment only the non-obvious *why*.

---

### Task 1: Batch scene & combat refreshes

**Files:**
- Create: `src/app/useBatchedRefresh.ts`
- Modify: `src/app/map/useScene.ts`
- Modify: `src/app/combat/useEncounter.ts`

- [ ] **Step 1: Create the coalescing hook**

Create `src/app/useBatchedRefresh.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";

/** Coalesce a burst of refresh requests into a single re-render. `requestRefresh`
 *  schedules one animation frame that bumps the version; further calls before that
 *  frame fires fold into it. Aligns updates to paint and goes quiet when the tab is
 *  hidden — useful when the GM moves many tokens at once. */
export function useBatchedRefresh(): [number, () => void] {
  const [version, setVersion] = useState(0);
  const frame = useRef<number | null>(null);

  const requestRefresh = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setVersion((n) => n + 1);
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return [version, requestRefresh];
}
```

- [ ] **Step 2: Wire `useScene` to it**

In `src/app/map/useScene.ts`, replace the first three lines of imports:

```ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildSceneView } from "../../foundry/scene/view";
```

with:

```ts
import { useMemo } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { useBatchedRefresh } from "../useBatchedRefresh";
import { buildSceneView } from "../../foundry/scene/view";
```

Then replace these two lines inside the function:

```ts
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onChange = useCallback(() => bump(), []);
```

with:

```ts
  const [version, requestRefresh] = useBatchedRefresh();
```

and update every hook registration in that function from `onChange` to `requestRefresh` (12 lines: `updateToken`, `createToken`, `deleteToken`, `updateScene`, `createScene`, `deleteScene`, `updateActor`, `createItem`, `updateItem`, `deleteItem`, `updateCombat`, `targetToken`). The `useMemo(..., [version, actorId])` body is unchanged.

- [ ] **Step 3: Wire `useEncounter` to it**

In `src/app/combat/useEncounter.ts`, replace:

```ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildEncounterView } from "../../foundry/combat/view";
```

with:

```ts
import { useMemo } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { useBatchedRefresh } from "../useBatchedRefresh";
import { buildEncounterView } from "../../foundry/combat/view";
```

Then replace:

```ts
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onCombat = useCallback(() => bump(), []);
```

with:

```ts
  const [version, requestRefresh] = useBatchedRefresh();
```

and update the six hook registrations from `onCombat` to `requestRefresh` (`updateCombat`, `createCombat`, `deleteCombat`, `createCombatant`, `updateCombatant`, `deleteCombatant`). The `useMemo` body is unchanged.

- [ ] **Step 4: Run the gate**

Run: `npm test` → Expected: 260 passing (no regression). Then `npm run typecheck` → no errors (confirms no unused `useReducer`/`useCallback` imports remain). Then `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```
git add src/app/useBatchedRefresh.ts src/app/map/useScene.ts src/app/combat/useEncounter.ts
git commit -m "perf: coalesce scene and combat refreshes into one frame"
```

Manual check (later, on device): in combat, the GM moves several tokens at once — the map settles to the correct positions; no missed updates.

---

### Task 2: Reconnection overlay

**Files:**
- Create: `src/app/useConnectionStatus.ts`
- Create: `src/app/ReconnectionOverlay.tsx`
- Modify: `src/app/Shell.tsx`

- [ ] **Step 1: Create the connection hook**

Create `src/app/useConnectionStatus.ts`:

```ts
import { useEffect, useState } from "react";

/** Reflect Foundry's socket connection. `game.socket` is a socket.io client that
 *  drops on screen-lock and reconnects on its own; we only mirror its state so the
 *  UI can show a scrim instead of freezing. Degrades to "connected" if no socket. */
export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState<boolean>(
    () => (game as any)?.socket?.connected ?? true,
  );

  useEffect(() => {
    const socket = (game as any)?.socket;
    if (!socket?.on) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected ?? true);
    return () => {
      socket.off?.("connect", onConnect);
      socket.off?.("disconnect", onDisconnect);
    };
  }, []);

  return connected;
}
```

- [ ] **Step 2: Create the overlay**

Create `src/app/ReconnectionOverlay.tsx`:

```tsx
/** Full-screen scrim shown while the Foundry socket is down (see
 *  useConnectionStatus). socket.io reconnects on its own; Reload is a manual
 *  escape hatch for the rare case it doesn't. */
export function ReconnectionOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 px-8 text-center"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <i className="fas fa-circle-notch fa-spin text-3xl text-amber-400" aria-hidden="true" />
      <div className="text-lg font-semibold">Reconnecting…</div>
      <div className="text-sm text-zinc-400">
        Lost the connection to Foundry. This usually clears on its own.
      </div>
      <button
        onClick={() => location.reload()}
        className="mt-2 min-h-12 rounded-md bg-zinc-800 px-6 text-sm font-medium ring-1 ring-zinc-700"
      >
        Reload
      </button>
    </div>
  );
}
```

(Bordered buttons lose their border under Tailwind v4 no-preflight — use `bg`/`ring`, which this does.)

- [ ] **Step 3: Mount in `Shell`**

In `src/app/Shell.tsx`, add the imports after the existing `SettingsModal` import:

```ts
import { useConnectionStatus } from "./useConnectionStatus";
import { ReconnectionOverlay } from "./ReconnectionOverlay";
```

Add the hook call alongside the other hooks (after `useTurnAlert(actorId);`):

```ts
  const connected = useConnectionStatus();
```

Render the overlay — replace:

```tsx
      <ChatToast />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
```

with:

```tsx
      <ChatToast />
      {!connected && <ReconnectionOverlay />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
```

- [ ] **Step 4: Run the gate**

Run: `npm test` → 260 passing. `npm run typecheck` → no errors. `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```
git add src/app/useConnectionStatus.ts src/app/ReconnectionOverlay.tsx src/app/Shell.tsx
git commit -m "feat: show a reconnecting overlay when the socket drops"
```

Manual check (later, on device): lock the screen, wait, unlock — the scrim appears while disconnected and clears itself on reconnect.

---

### Task 3: `fontScalePx` pure mapper

**Files:**
- Modify: `src/foundry/mobile.ts`
- Test: `tests/fontScale.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/fontScale.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fontScalePx } from "../src/foundry/mobile";

describe("fontScalePx", () => {
  it("maps each scale to a root pixel size", () => {
    expect(fontScalePx("small")).toBe(14);
    expect(fontScalePx("medium")).toBe(16);
    expect(fontScalePx("large")).toBe(18);
  });
  it("falls back to medium for an unknown value", () => {
    expect(fontScalePx("huge" as any)).toBe(16);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/fontScale.test.ts`
Expected: FAIL — `fontScalePx` is not exported from `../src/foundry/mobile`.

- [ ] **Step 3: Implement in `mobile.ts`**

Append to `src/foundry/mobile.ts`:

```ts
export type FontScale = "small" | "medium" | "large";

/** Root font-size in px for a scale. The UI is rem-based, so applying this to the
 *  document root scales the whole app. Unknown values fall back to medium. */
export function fontScalePx(scale: FontScale): number {
  switch (scale) {
    case "small":
      return 14;
    case "large":
      return 18;
    default:
      return 16;
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run tests/fontScale.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full gate and commit**

Run: `npm test` (261+ passing) → `npm run typecheck` → `npm run build`.

```
git add src/foundry/mobile.ts tests/fontScale.test.ts
git commit -m "feat: add fontScalePx scale-to-px mapper"
```

---

### Task 4: `coerceTabId` + `TAB_IDS`

**Files:**
- Modify: `src/app/store.ts`
- Test: `tests/store.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/store.test.ts`, change the import line:

```ts
import { useAppStore } from "../src/app/store";
```

to:

```ts
import { useAppStore, TAB_IDS, coerceTabId } from "../src/app/store";
```

and add this `describe` block after the existing `describe("useAppStore", ...)` block:

```ts
describe("coerceTabId", () => {
  it("passes through every known tab id", () => {
    for (const id of TAB_IDS) expect(coerceTabId(id)).toBe(id);
  });
  it("falls back to the sheet for unknown, null, or undefined", () => {
    expect(coerceTabId("nope")).toBe("sheet");
    expect(coerceTabId(null)).toBe("sheet");
    expect(coerceTabId(undefined)).toBe("sheet");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/store.test.ts`
Expected: FAIL — `TAB_IDS` / `coerceTabId` are not exported.

- [ ] **Step 3: Implement in `store.ts`**

In `src/app/store.ts`, immediately after the `TabId` type declaration line (`export type TabId = ...`), add:

```ts
export const TAB_IDS: readonly TabId[] = [
  "sheet", "actions", "combat", "chat", "journal", "map",
];

/** Narrow an arbitrary stored value to a TabId, defaulting to the sheet. */
export function coerceTabId(value: unknown): TabId {
  return TAB_IDS.includes(value as TabId) ? (value as TabId) : "sheet";
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run tests/store.test.ts`
Expected: PASS (existing tests + 2 new).

- [ ] **Step 5: Run the full gate and commit**

Run: `npm test` → `npm run typecheck` → `npm run build`.

```
git add src/app/store.ts tests/store.test.ts
git commit -m "feat: add coerceTabId for the default-tab setting"
```

---

### Task 5: Register settings, apply at mount, gate the buzz

**Files:**
- Modify: `src/foundry/settings.ts`
- Modify: `src/app/combat/useTurnAlert.ts`
- Modify: `src/module.ts`

- [ ] **Step 1: Register the three settings + getters/setters in `settings.ts`**

In `src/foundry/settings.ts`, change the top import:

```ts
import { isMobileDevice, type MapRenderer } from "./mobile";
```

to:

```ts
import { isMobileDevice, fontScalePx, type MapRenderer, type FontScale } from "./mobile";
```

Inside `registerSettings`, after the `mapRenderer` `register(...)` call (before the closing `}`), add:

```ts
  (game as any).settings.register(MODULE_ID, "defaultTab", {
    name: "Default tab",
    scope: "client",
    config: false,
    type: String,
    default: "sheet",
  });
  (game as any).settings.register(MODULE_ID, "vibrate", {
    name: "Vibrate on your turn",
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  });
  (game as any).settings.register(MODULE_ID, "fontScale", {
    name: "Font size",
    scope: "client",
    config: false,
    type: String,
    default: "medium",
  });
```

After the existing `setMapRenderer` function, add getters/setters and the apply helper:

```ts
export function getDefaultTab(): string {
  return ((game as any).settings.get(MODULE_ID, "defaultTab") as string) ?? "sheet";
}
export async function setDefaultTab(value: string): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "defaultTab", value);
}

export function getVibrate(): boolean {
  return Boolean((game as any).settings.get(MODULE_ID, "vibrate") ?? true);
}
export async function setVibrate(value: boolean): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "vibrate", value);
}

export function getFontScale(): FontScale {
  return ((game as any).settings.get(MODULE_ID, "fontScale") as FontScale) ?? "medium";
}
export async function setFontScale(value: FontScale): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "fontScale", value);
}

/** Apply the font scale to the document root; the rem-based UI scales with it. */
export function applyFontScale(scale: FontScale): void {
  document.documentElement.style.fontSize = `${fontScalePx(scale)}px`;
}
```

Finally, update the type re-export at the bottom of the file from:

```ts
export type { MapRenderer } from "./mobile";
```

to:

```ts
export type { MapRenderer, FontScale } from "./mobile";
```

- [ ] **Step 2: Gate the buzz on the vibration setting**

In `src/app/combat/useTurnAlert.ts`, add this import after the existing `useFoundryHook` import:

```ts
import { getVibrate } from "../../foundry/settings";
```

Then, inside `onCombat`, change:

```ts
    if (currentId === lastCurrentId.current) return; // current combatant unchanged → no buzz
    lastCurrentId.current = currentId;
    if (actorId && current?.actor?.id === actorId) {
      (navigator as any)?.vibrate?.(BUZZ_MS);
    }
```

to:

```ts
    if (currentId === lastCurrentId.current) return; // current combatant unchanged → no buzz
    lastCurrentId.current = currentId;
    if (!getVibrate()) return;
    if (actorId && current?.actor?.id === actorId) {
      (navigator as any)?.vibrate?.(BUZZ_MS);
    }
```

(The `lastCurrentId` ref is updated before the vibrate check, so toggling the setting mid-combat never causes a stale double-buzz.)

- [ ] **Step 3: Apply default tab + font scale at mount in `module.ts`**

In `src/module.ts`, change the top settings import from:

```ts
import { registerSettings, isMobileActive } from "./foundry/settings";
```

to:

```ts
import {
  registerSettings, isMobileActive, getDefaultTab, getFontScale, applyFontScale,
} from "./foundry/settings";
```

Then update `mountApp` from:

```ts
async function mountApp(container: HTMLElement): Promise<void> {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App } = await import("./app/App");
  createRoot(container).render(createElement(App));
}
```

to:

```ts
async function mountApp(container: HTMLElement): Promise<void> {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { App } = await import("./app/App");
  const { useAppStore, coerceTabId } = await import("./app/store");

  useAppStore.getState().setActiveTab(coerceTabId(getDefaultTab()));
  applyFontScale(getFontScale());

  createRoot(container).render(createElement(App));
}
```

(The store is imported dynamically so React stays out of the static module graph — preserving the dev Fast-Refresh-preamble ordering. The settings getters live in `settings.ts`, which has no React dependency, so they can stay in the static import.)

- [ ] **Step 4: Run the gate**

Run: `npm test` → all passing. `npm run typecheck` → no errors. `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```
git add src/foundry/settings.ts src/app/combat/useTurnAlert.ts src/module.ts
git commit -m "feat: add default-tab, vibration, and font-size settings"
```

---

### Task 6: Surface the settings in the cogwheel

**Files:**
- Modify: `src/app/SettingsModal.tsx`

- [ ] **Step 1: Rewrite `SettingsModal` to show all four groups**

Replace the entire contents of `src/app/SettingsModal.tsx` with:

```tsx
import { useState } from "react";
import { Modal } from "./sheet/parts/Modal";
import {
  getMapRenderer, setMapRenderer,
  getDefaultTab, setDefaultTab,
  getFontScale, setFontScale, applyFontScale,
  getVibrate, setVibrate,
} from "../foundry/settings";
import type { MapRenderer, FontScale } from "../foundry/mobile";
import { TAB_IDS, coerceTabId } from "./store";
import type { TabId } from "./store";

const MAP_RENDERER_CHOICES: { value: MapRenderer; label: string }[] = [
  { value: "canvas", label: "Foundry canvas (full)" },
  { value: "lite", label: "Lite (fast)" },
];

const TAB_LABELS: Record<TabId, string> = {
  sheet: "Sheet",
  actions: "Actions",
  combat: "Combat",
  chat: "Chat",
  journal: "Journal",
  map: "Map",
};

const FONT_SCALE_CHOICES: { value: FontScale; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
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
  const [defaultTab, setDefaultTabState] = useState<TabId>(coerceTabId(getDefaultTab()));
  const [fontScale, setFontScaleState] = useState<FontScale>(getFontScale());
  const [vibrate, setVibrateState] = useState<boolean>(getVibrate());

  return (
    <Modal title="Settings" onClose={onClose}>
      <Group
        heading="Battle map renderer"
        choices={MAP_RENDERER_CHOICES}
        selected={mapRenderer}
        onSelect={(value) => { setMapRendererState(value); void setMapRenderer(value); }}
      />
      <Group
        heading="Default tab"
        choices={TAB_IDS.map((id) => ({ value: id, label: TAB_LABELS[id] }))}
        selected={defaultTab}
        onSelect={(value) => { setDefaultTabState(value); void setDefaultTab(value); }}
      />
      <Group
        heading="Font size"
        choices={FONT_SCALE_CHOICES}
        selected={fontScale}
        onSelect={(value) => {
          setFontScaleState(value);
          applyFontScale(value);
          void setFontScale(value);
        }}
      />
      <Group
        heading="Vibrate on your turn"
        choices={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
        selected={vibrate ? "on" : "off"}
        onSelect={(value) => {
          const on = value === "on";
          setVibrateState(on);
          void setVibrate(on);
        }}
      />
    </Modal>
  );
}
```

(Default tab and vibration persist and take effect on next open / next turn; font size applies immediately via `applyFontScale`. Vibration reuses `Group` as an On/Off pair to match the existing visual language without a new component.)

- [ ] **Step 2: Run the gate**

Run: `npm test` → all passing. `npm run typecheck` → no errors (confirms `TabId` flows through `Group<T>` and the label map is exhaustive). `npm run build` → succeeds.

- [ ] **Step 3: Commit**

```
git add src/app/SettingsModal.tsx
git commit -m "feat: add default tab, font size, and vibration to settings"
```

Manual check (later, on device): open the cogwheel; pick a font size and watch the app rescale live; set a default tab and reopen the app on that tab; toggle vibration off and confirm no buzz on your turn.

---

### Task 7: Pin the pf2e verified version

**Files:**
- Modify: `public/module.json`

- [ ] **Step 1: Add pf2e `verified`**

In `public/module.json`, change the pf2e relationship from:

```json
      {
        "id": "pf2e",
        "type": "system",
        "compatibility": { "minimum": "8.2.0" }
      }
```

to:

```json
      {
        "id": "pf2e",
        "type": "system",
        "compatibility": { "minimum": "8.2.0", "verified": "8.2.0" }
      }
```

(Core is already pinned: `compatibility.minimum`/`verified` = `"14"`. No `maximum` on either — `verified` records the tested level without blocking a newer core/system. Module `version` stays `0.0.1`.)

- [ ] **Step 2: Run the gate**

Run: `npm run build` → succeeds and copies the manifest to `dist/module.json`. Confirm `dist/module.json` shows the pf2e `verified: "8.2.0"`. Then `npm test` → all passing (unaffected).

- [ ] **Step 3: Commit**

```
git add public/module.json
git commit -m "chore: record pf2e verified version in the manifest"
```

---

## Self-review

**Spec coverage:**
- Debounce scene/combat → Task 1. ✔
- Reconnection overlay → Task 2. ✔
- Default tab → Tasks 4 (`coerceTabId`), 5 (setting + mount apply), 6 (UI). ✔
- Vibration toggle → Tasks 5 (setting + gate in `useTurnAlert`), 6 (UI). ✔
- Font size → Tasks 3 (`fontScalePx`), 5 (setting + `applyFontScale` + mount apply), 6 (UI). ✔
- Version pinning → Task 7. ✔
- Out-of-scope items (code-split, force-mobile, profiling, release, chat debounce) → correctly absent.

**Type consistency:** `FontScale` defined in `mobile.ts` (Task 3), re-exported from `settings.ts` and consumed by `SettingsModal` (Task 6) — same name throughout. `coerceTabId`/`TAB_IDS` defined in `store.ts` (Task 4), consumed in `module.ts` (Task 5) and `SettingsModal` (Task 6). `getVibrate`/`getDefaultTab`/`getFontScale`/`applyFontScale`/`setDefaultTab`/`setVibrate`/`setFontScale` defined in Task 5, consumed in Task 6 — names match. `useBatchedRefresh` returns `[number, () => void]`, used as `[version, requestRefresh]` in Tasks 1's two consumers.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; commands have expected output.

**Order/dependencies:** Tasks 3 and 4 (pure) precede Task 5 (uses `fontScalePx`) and Task 6 (uses `coerceTabId`, getters); Task 5 (module.ts wiring needs `coerceTabId` + `applyFontScale`) follows 3/4. Tasks 1, 2, 7 are independent.
