# Device-only mobile activation (remove the off-switch)

**Date:** 2026-06-13
**Status:** Approved — ready for implementation plan

## Problem

The mobile UI takeover is gated by a `uiMode` client setting (`auto` / `on` / `off`).
When a user is on a phone but `uiMode === "off"` (the old "exit to desktop" /
"Always off"), the takeover is hard-disabled and the *only* way back is the left
scene-controls toolbar (`getSceneControlButtons`) — which is effectively
unreachable on a phone-sized screen. The user gets **stranded in desktop mode on
their phone**.

## Goal

Make the mobile UI activate **purely from the device**: a real phone or tablet
always takes over; a real desktop never does, regardless of window size. Remove
the override entirely so there is no off-switch that can strand a phone, and
remove the inaccessible toolbar settings. Keep the in-app Canvas/Lite renderer
choice (it can't strand anyone).

Decisions taken during brainstorming:

- **Detection:** device-only. A desktop never takes over (no width/breakpoint
  signal), so it can never get trapped now that the off-switch is gone.
- **Settings UI:** remove the left-toolbar "PF2e Mobile" category entirely; keep
  the in-app cogwheel Settings popup but with only the "Battle map renderer"
  (Canvas/Lite) choice.

## Detection

"Device only" cannot be a plain user-agent check: **modern iPadOS Safari reports a
desktop "Macintosh" user-agent**, so a naive UA test would fail the "tablet"
requirement on every current iPad. Detection is therefore:

```
isMobileDevice(ua, maxTouchPoints) =
      isMobileUA(ua)                              // phones, Android tablets, old iPads
   OR ( /Macintosh/i.test(ua) AND maxTouchPoints > 1 )   // modern iPadOS
```

This correctly:

- **includes** phones (Android/iPhone UA), Android tablets ("Android" token),
  legacy iPads ("iPad" token), and modern iPads (Macintosh UA + multi-touch);
- **excludes** a desktop with a narrow window (no mobile signal), a touchscreen
  Windows laptop (Windows UA, no Mac/mobile token, so the touch clause never
  applies), and a MacBook (Macintosh UA but `maxTouchPoints === 0`).

It is a pure function over `{ ua, maxTouchPoints }` and is fully unit-tested.

Testing the mobile UI on a desktop is still possible via Chrome DevTools device
emulation, which spoofs both the UA and `maxTouchPoints`. This replaces the old
"Always on" toggle as the desktop testing path.

### `mobile.ts` shape after the change

- **Removed:** `UiMode` type, `DetectMobileInput`, `detectMobile`, the
  `WIDTH_BREAKPOINT` constant.
- **Kept:** `isMobileUA(ua)` (the existing UA regex predicate), `MapRenderer`,
  `desiredNoCanvas`.
- **Added:** `isMobileDevice({ ua, maxTouchPoints })` — pure, as above.

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

## Removals

- **`uiMode` setting** entirely:
  - `settings.ts`: drop the `uiMode` registration, `getUiMode`/`setUiMode`, the
    `UiMode` import, and the `onUiModeChange` parameter of `registerSettings`.
  - `module.ts`: drop the `onUiModeChange` function and its wiring; `registerSettings`
    is called with only the map-renderer change callback.
- **Left-toolbar "PF2e Mobile" category:**
  - Delete `src/foundry/controls/moduleControl.ts` and `tests/moduleControl.test.ts`.
  - `module.ts`: remove the `getSceneControlButtons` hook and the `buildModuleControl`
    import.
- **Off-switch machinery** (dead once nothing can exit takeover):
  - `takeover.ts`: remove `removeTakeover()` and the `setPriorNoCanvas(getNoCanvas())`
    save line inside `applyTakeover`; drop the `getPriorNoCanvas`/`setPriorNoCanvas`
    imports.
  - `settings.ts`: remove the hidden `priorNoCanvas` setting registration plus
    `getPriorNoCanvas`/`setPriorNoCanvas`.
  - `module.ts`: remove the `removeTakeover` import.

## What stays

- `takeover.ts`: `applyTakeover` (still reconciles `core.noCanvas` to the chosen
  renderer, reloads once if it had to flip, then mounts), `reconcileMapRenderer`,
  `isTakeoverActive`.
- `mobile.ts`: `desiredNoCanvas`, `MapRenderer`, `isMobileUA`.
- The **`mapRenderer`** client setting (`config: true`, with its `onChange →
  reconcileMapRenderer`) and the in-app cogwheel.
- `SettingsModal.tsx`: keeps only the "Battle map renderer" (Canvas/Lite) group;
  the "Mobile UI mode" group, `UI_MODE_CHOICES`, `UiMode` import, and
  `getUiMode`/`setUiMode` imports are removed.
- `Shell.tsx`: unchanged — the cogwheel button already just opens `SettingsModal`.

## `isMobileActive`

```ts
export function isMobileActive(): boolean {
  return isMobileDevice({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}
```

The `ready` hook in `module.ts` keeps calling `isMobileActive()` once and applying
the takeover when true. There is no longer any runtime re-evaluation path (the
only trigger, `onUiModeChange`, is removed).

## Testing

- Delete `tests/detectMobile.test.ts`; add `tests/deviceDetection.test.ts` covering
  `isMobileUA` and `isMobileDevice`:
  - Android phone UA → mobile.
  - iPhone UA → mobile.
  - Wide desktop Windows UA, `maxTouchPoints: 0` → not mobile.
  - **Touchscreen Windows laptop** (Windows UA, `maxTouchPoints: 10`) → not mobile.
  - **Modern iPad** (Macintosh UA, `maxTouchPoints: 5`) → mobile.
  - **MacBook** (Macintosh UA, `maxTouchPoints: 0`) → not mobile.
- Delete `tests/moduleControl.test.ts` (the builder it tests is removed).
- Full suite + `tsc` + build must stay green after the type/import removals.

## Out of scope

- No change to the in-app tab layout, the canvas/lite map behaviour, or the
  cogwheel's position/label.
- No new desktop affordance to force mobile mode (DevTools emulation covers
  testing).
