# Phase 8 — hardening, settings, pinning — design

## Goal

Close the actionable part of Phase 8: stop the app re-prepping on every hook fire,
give the player feedback when the socket drops, add the three settings worth having
on a phone, and record what we've actually tested in the manifest. No new feature
surfaces beyond the settings controls; everything routes through the existing
patterns (pure mapper → thin hook → guarded glue → small UI).

## Scope

- **In:** debounce the scene/combat refreshes, a reconnection overlay, three client
  settings (default tab / vibration / font size), and pf2e version pinning in
  `public/module.json`.
- **Out, by decision:**
  - **Code-split tabs** — the Vite build is a single inlined `module.js`
    (`inlineDynamicImports: true`) and the Map tab reuses Foundry's live canvas, so
    the original "heavy map renderer" rationale is gone. Not worth changing the
    build's bundling contract with Foundry.
  - **"Force mobile on/off" setting** — deliberately removed with the device-only
    activation work; a phone must never be strandable. Stays gone.
  - **Profiling on a real Android device** — the user's task; can't be done here.
  - **GitHub release + manifest URL** — outward-facing and optional; the user owns it.

## Non-goals

- No change to what the chat feed does. It is append-driven (one `push` per message),
  not a re-prep storm — debouncing it would risk toast timing and ordering for little
  gain.
- No global "settings are reactive" plumbing. Each setting is read where it matters
  (mount, or at buzz time) and applied directly on change. No new store, no broadcast.
- No hard `maximum` in the manifest — `verified` records the tested level without
  blocking a newer core/system from loading.

## Constraints / safety net

Behavior-preserving for everything except the three new settings. Gate run before
every commit:

```
npm test          # 260 passing baseline + the new pure tests
npm run typecheck # tsc --noEmit
npm run build     # vite production build
```

Land as staged commits on `main` (per-task-commit workflow). Code in the house voice:
concise top-of-function doc comments, no over-commenting, no restating the code.

## Part 1 — Debounce scene & combat refreshes

`useScene` and `useEncounter` both bump a `useReducer` on every relevant hook and
re-prep synchronously via `useMemo`. `useScene` listens to `updateToken` among twelve
hooks — in a combat where the GM moves or ticks many tokens, that's a re-prep per
update.

- **New `src/app/useBatchedRefresh.ts`** — `useBatchedRefresh(): [number, () => void]`.
  The returned `requestRefresh` schedules a single `requestAnimationFrame` that bumps
  the version once; further calls before the frame fires are no-ops (one pending frame
  at a time). Cancels the frame on unmount. rAF over a `setTimeout` debounce: it aligns
  to paint and pauses when the screen is off, which suits a phone and matches the
  existing off-tab ticker pause.
- **Wire into `useScene` and `useEncounter`** — replace the local `useReducer` +
  `useCallback(bump)` with `const [version, requestRefresh] = useBatchedRefresh()` and
  point every `useFoundryHook(..., requestRefresh)` at it. The `useMemo([version, ...])`
  bodies are unchanged.

The hook is thin and has no pure core worth extracting, so — like the other hooks in
this codebase — it's verified manually, not unit-tested.

## Part 2 — Reconnection overlay

Foundry drops the socket on screen-lock, and we hide the stock UI, so today the player
sees a frozen app with no explanation.

- **New `src/app/useConnectionStatus.ts`** — attaches to Foundry's socket.io client
  (`game.socket`), feature-detected: `on("disconnect")` → not connected, `on("connect")`
  → connected (fires on the initial connect and on every auto-reconnect). Returns
  `connected: boolean`, seeded from `game.socket?.connected ?? true`. Cleans up its
  listeners on unmount.
- **New `src/app/ReconnectionOverlay.tsx`** — a full-screen scrim ("Reconnecting…",
  spinner) shown only while disconnected, with a manual **Reload** button as an escape
  hatch. socket.io auto-reconnects, so the overlay only reflects state and clears itself
  on `connect`.
- **Mount in `Shell`** alongside `ChatToast`: `const connected = useConnectionStatus();`
  then `{!connected && <ReconnectionOverlay />}`.

## Part 3 — Settings: default tab, vibration, font size

All three are client settings registered in `settings.ts` next to `mapRenderer`, and
surfaced in the in-app cogwheel `SettingsModal`. They register with `config: false` —
Foundry's own settings menu is unreachable on a phone, and keeping them out of it means
the foundry layer doesn't have to carry app-specific tab labels/choices. The cogwheel is
the single surface.

### Default tab

- Setting `defaultTab` (String, default `"sheet"`). Getter `getDefaultTab(): string`.
- **`store.ts`** gains `TAB_IDS: readonly TabId[]` and `coerceTabId(value): TabId`
  (falls back to `"sheet"` on anything unknown) — tab identity stays in the app layer,
  so the foundry layer never imports it.
- Applied in `module.ts#mountApp` **before first render**:
  `useAppStore.getState().setActiveTab(coerceTabId(getDefaultTab()))`. This keeps the
  store's static default (`activeTab: "sheet"`) untouched, so `store.test.ts` stays
  green and there's no first-paint flash. Changing the setting takes effect on next open
  (it's the *default*, not a live jump).
- `SettingsModal` renders a tab Group from `TAB_IDS`; selecting persists via
  `settings.set`.

### Vibration

- Setting `vibrate` (Boolean, default `true`). Getter `getVibrate(): boolean`.
- **`useTurnAlert`** returns early when `!getVibrate()` before calling
  `navigator.vibrate`. Read at buzz time — no React reactivity needed.
- `SettingsModal` renders an On/Off toggle row.

### Font size

- Type `FontScale = "small" | "medium" | "large"` and pure `fontScalePx(scale): number`
  (14 / 16 / 18) in **`mobile.ts`**, joining `desiredNoCanvas`/`MapRenderer`. Unit-tested.
- Setting `fontScale` (String, default `"medium"`). Getter `getFontScale(): FontScale`.
- **`applyFontScale(scale)`** in `settings.ts` sets
  `document.documentElement.style.fontSize = `${fontScalePx(scale)}px``. The UI is
  rem-based and the stock DOM is hidden, so scaling the root cleanly scales the whole app.
- Applied in `module.ts#mountApp` (`applyFontScale(getFontScale())`) and live in
  `SettingsModal`'s onSelect (apply immediately, then persist).

## Part 4 — Version pinning (`public/module.json`)

Core is already pinned (`compatibility.minimum`/`verified` = `"14"`). The gap is pf2e:
add `compatibility.verified: "8.2.0"` to the pf2e relationship (keeping `minimum: "8.2.0"`).
No `maximum` on either. Module `version` stays `0.0.1` — bumping it implies a release,
which the user owns. (`dist/module.json` is built from `public/`, so only `public/` is edited.)

## File inventory

**New:** `src/app/useBatchedRefresh.ts`, `src/app/useConnectionStatus.ts`,
`src/app/ReconnectionOverlay.tsx`.

**Changed:** `src/app/map/useScene.ts`, `src/app/combat/useEncounter.ts`,
`src/foundry/mobile.ts`, `src/foundry/settings.ts`, `src/app/store.ts`,
`src/app/SettingsModal.tsx`, `src/app/Shell.tsx`, `src/app/combat/useTurnAlert.ts`,
`src/module.ts`, `public/module.json`.

**Tests:** `fontScalePx` (new `tests/fontScale.test.ts` or fold into an existing mobile
test) and `coerceTabId` (extend `tests/store.test.ts`).

## Staging plan

Each is one commit (or a couple), green before landing:

1. **Debounce** — `useBatchedRefresh` + wire into `useScene` and `useEncounter`.
2. **Reconnection** — `useConnectionStatus` + `ReconnectionOverlay` + `Shell`.
3. **Settings** — `mobile.ts` (`fontScalePx`), `store.ts` (`coerceTabId`), `settings.ts`
   registrations/getters/`applyFontScale`, `useTurnAlert`, `module.ts` wiring,
   `SettingsModal` UI, + the two pure tests.
4. **Pinning** — `public/module.json`.

## Risks & mitigations

- **rAF coalescing swallows an update** → only the *scheduling* is batched; the `useMemo`
  body and hook set are unchanged, so the same data is read, just once per frame.
  Manual check: GM moves several tokens, the map settles correctly.
- **Disconnect detection misses across Foundry versions** → use socket.io's own
  `connect`/`disconnect` events (stable) rather than a Foundry hook; feature-detect
  `game.socket` and seed from `.connected` so a missing socket degrades to "connected".
- **Root font-size bleeds into visible Foundry chrome** → in takeover the stock DOM is
  hidden; transient Foundry notifications scaling slightly is acceptable.
- **Default-tab change breaks `store.test.ts`** → the store's static default is left as
  `"sheet"`; the setting is applied at the composition root, not in the store.

## Success criteria

- A burst of `updateToken` hooks causes one re-prep per frame, not one per hook.
- Locking and unlocking the screen shows the reconnection scrim, which clears on its own.
- Default tab, vibration, and font size are settable from the cogwheel and take effect
  (default tab next open; vibration and font size immediately).
- `public/module.json` records pf2e `verified: "8.2.0"`.
- 260 baseline tests + the new pure tests + typecheck + production build green at every
  commit.
