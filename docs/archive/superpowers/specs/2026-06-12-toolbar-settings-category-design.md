# Module settings as a left-toolbar category

**Date:** 2026-06-12
**Status:** Approved

## Goal

Surface the module's two existing client settings — `uiMode` (Automatic / Always on /
Always off) and `mapRenderer` (Foundry canvas / Lite) — as a dedicated category on
Foundry's left scene-controls toolbar, with radio-style buttons that mirror the
settings' dropdown choices. Currently these only live under Game Settings.

The stock toolbar is hidden by CSS while mobile takeover is active, so in practice
these buttons are used from a **desktop** session — their main value is flipping
*into* mobile mode and switching the map renderer without opening the settings menu.
That is expected and acceptable.

## API

Foundry v14's `getSceneControlButtons` hook receives
`controls: Record<string, SceneControls.Control>`. We add one control keyed
`pf2e-mobile-companion`.

Per the v14 types, `Tool.active` applies to **toggles** (it is "not applicable to
toggles or buttons" only for the `button` momentary form), so each choice is a
`toggle: true` tool whose `active` flag is computed from the current setting value.
Radio semantics within each group are enforced manually: tapping a tool sets the
setting and re-renders the controls (`ui.controls.render()`), which rebuilds every
tool's `active` from the new values. Tapping the already-active tool re-sets the same
value — a harmless no-op that keeps it highlighted.

## The category

Title "PF2e Mobile", icon `fa-solid fa-mobile-screen`.

UI mode group (toggles, `active` = current `uiMode`):

- `Automatic` — `fa-solid fa-wand-magic-sparkles`
- `Always on` — `fa-solid fa-mobile-screen`
- `Always off` — `fa-solid fa-desktop`

Map renderer group (toggles, `active` = current `mapRenderer`):

- `Foundry canvas` — `fa-solid fa-map`
- `Lite` — `fa-solid fa-image`

Tapping a tool calls the existing `setUiMode` / `setMapRenderer`, which already fire
the module's reconciliation `onChange` handlers (entering/leaving takeover, flipping
`core.noCanvas`). No new reconciliation logic is needed here.

## Structure

Follows the repo's "pure mapper + thin glue" convention.

- `src/foundry/controls/moduleControl.ts` — **pure**
  `buildModuleControl({ uiMode, mapRenderer, onSelectUiMode, onSelectMapRenderer })`
  returning the `Control` object. No Foundry globals, fully unit-testable like the
  other mappers. `onSelectUiMode(mode)` / `onSelectMapRenderer(value)` are injected
  callbacks invoked from each tool's `onChange`.
- Thin glue in `module.ts`, registered at eval time:
  `Hooks.on("getSceneControlButtons", (controls) => { ... })` that calls the builder
  with live getters (`getUiMode`, `getMapRenderer`) and select callbacks that call the
  setters and then `ui.controls.render()`.
- `tests/moduleControl.test.ts` — assert control shape: key, tool names/count, each
  tool's `active` reflects the supplied current values, and `onChange` invokes the
  correct injected callback with the correct value.

## Out of scope (YAGNI)

- The hidden `priorNoCanvas` setting (`config: false`, internal bookkeeping) gets no
  button.
- No localization keys — settings already use plain English strings; titles match.
