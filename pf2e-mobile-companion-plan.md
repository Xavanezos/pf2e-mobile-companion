# PF2e Mobile Companion — Project Plan

A Foundry VTT module that replaces the Foundry UI on mobile Chrome with a fast, purpose-built React app: character sheet, action bar with macros, journals, initiative tracker, and a lightweight battle map.

**Target:** Foundry v14, PF2e system v8.2, Chrome on Android.

**Architecture in one line:** The player logs into Foundry normally in mobile Chrome; the module detects mobile, suppresses the canvas and stock UI, and mounts a React app that drives everything through the live PF2e system API. No relay server, no reimplemented rules, permissions enforced by Foundry itself.

> **Build order (revised 2026-06-12):** Phase 5 is done. **Journals (Phase 6) is deferred to the end of the roadmap** (lowest priority — its full section now lives at the bottom of this file). The **battle map (Phase 7) is built next**, then Journals. Phase numbers are kept stable as identifiers (historical reports reference "Phase 6 = Journals", "Phase 7 = battle map"); only the *order of work* changed.

## Current status — 2026-06-13

**Core is feature-complete.** Phases 0–7 are code-complete on `main`; 260 tests + typecheck + prod build green. Everything routes through the live PF2e system API, and the Map tab renders the **real Foundry canvas** — so third-party modules (hotbar macros, canvas effects, system automation) work without neutralization (Phase 8b dropped, below).

Remaining work, by bucket:

- **A — In-flight:** land the uncommitted Map bug-fix round (door toggle + `control.ts`, canvas-mode targeting, drag-start origin). Tests green; needs one device pass, then commit.
- **B — Play-test backlog (code-complete, unblessed):** battle map (ruler / hex grid / padded scene / GM-vs-AC), journals (only empty-state seen), map token conditions/effects, chat-roll long-press menu (reroll/delete), device-only activation.
- **C — Deferred features (optional):** common-actions row (`game.pf2e.actions`); damage-apply buttons on chat cards (may already work via rendered HTML — live-check); learn/add spells from the compendium.
- **D — Phase 8 hardening (only to publish):** reconnection overlay on screen-lock, debounce `updateToken` in big combats, `React.lazy` tab split, profile on real Android, settings polish (default tab / vibration / font size), tighten `module.json` pinning, GitHub release + manifest URL.
- **E — Descoped:** Phase 8b module neutralization — unnecessary now the canvas renders.

> Per-phase specs, plans, and reports were archived to `docs/archive/` on 2026-06-13; this file is the living roadmap.

---

## Phase 0 — Dev environment & scaffold

- [x] Install a local Foundry instance for development (separate from your live campaign world). Create a test world with the PF2e system, 2–3 test actors, a scene with tokens, a few macros and journals.
- [x] Create two Foundry users: a GM and a Player (assign the player ownership of one actor). You'll test with GM in desktop Chrome + Player in mobile Chrome (or Chrome DevTools device emulation) simultaneously.
- [x] Scaffold the module: `module.json` manifest + Vite + React + TypeScript. Use an existing Vite-Foundry template as reference (search "foundry vtt vite module template" — the League of Extraordinary FoundryVTT Developers has examples). Key points:
  - Vite dev server with HMR proxied into Foundry (the templates show the proxy config — Foundry serves on :30000, Vite proxies everything except your module path).
  - Build output goes into the module's `dist/`, listed in `module.json` under `esmodules` and `styles`.
- [x] Add types: `fvtt-types` (foundry-vtt-types) + clone the PF2e system repo (github.com/foundryvtt/pf2e) locally as your API reference. The PF2e repo is your real documentation — when in doubt, read how their own sheets call things.
- [x] Symlink or configure the module into your dev Foundry's `Data/modules/` folder. Confirm it loads (a `console.log` in the `init` hook).

**Milestone:** module loads, HMR works, you can edit a React component and see it update inside Foundry.

---

## Phase 1 — Mobile takeover shell ✅ Done (2026-06-11)

> Spec: `docs/superpowers/specs/2026-06-11-phase-1-mobile-takeover-shell-design.md` · Plan: `docs/superpowers/plans/2026-06-11-phase-1-mobile-takeover-shell.md`. Styling: Tailwind v4 (no preflight). Tests: Vitest (15 passing) for the pure logic; DOM/hook integration verified manually.

- [x] Mobile detection: user agent + viewport width check, plus a manual override (client setting "Mobile UI mode": Automatic / Always on / Always off) so you can test on desktop and players can opt out.
- [x] On `ready` hook, when mobile mode is active:
  - [x] Force-disable the game canvas via `core.noCanvas` (saves the prior value, sets it, one-time guarded reload; restored on exit). Verify memory/CPU drop in DevTools.
  - [x] Hide the stock UI (`#interface`, `#ui-left`, etc.) via the `pf2e-mobile-active` class on `<body>`.
  - [x] Mount the React root into a full-screen container.
- [x] App shell: bottom tab navigation — **Sheet / Actions / Combat / Journal / Map**. Mobile-first CSS, large touch targets, dark theme. Plus a header with fullscreen + escape-to-desktop controls.
- [x] State plumbing: a small Zustand store + a generic `useFoundryHook(hookName, handler)` React hook that registers/unregisters Foundry hooks on mount/unmount. This is the backbone of the whole app.
- [x] Resolve "my character": `game.user.character` first, fall back to a picker of owned `character`-type actors (auto-selects when there's exactly one; empty state when none).

**Milestone:** ✅ player on mobile sees an empty tabbed app instead of Foundry's UI; GM on desktop is unaffected.

---

## Phase 2 — Character sheet (read + live) ✅ Done (2026-06-11)

> Spec: `docs/superpowers/specs/2026-06-11-phase-2-character-sheet-design.md` · Plan: `docs/superpowers/plans/2026-06-11-phase-2-character-sheet.md`. Comprehensive live sheet: sticky vitals header + sub-tabs (Vitals / Skills / Items / Feats / Bio). Rolling deferred to Phase 3; build-time edits out of scope by design. Tests green, typecheck + build clean; verified live (GM-on-desktop + player-on-mobile).

- [x] Header: name, portrait, HP / temp HP / max, AC, conditions, hero points, speed, perception.
- [x] HP control: tap to open a +/- numpad → `actor.update({"system.attributes.hp.value": n})` / `actor.applyDamage()` for damage (respects temp HP and resistances).
- [x] Conditions: list active conditions with values; add/remove via `actor.toggleCondition(...)` / `increaseCondition` / `decreaseCondition`.
- [x] Skills list with modifiers (`actor.skills`), saves, ability scores.
- [x] Inventory: read `actor.inventory`, show equipped/carried, bulk. Equip/invest via item updates.
- [x] Feats & features: grouped read-only list (`actor.itemTypes.feat`).
- [x] Live updates: subscribe to `updateActor`, `updateItem`, `createItem`, `deleteItem` hooks filtered to the active actor → refresh store. GM changes HP on desktop → phone updates within ~1s.

**Milestone:** ✅ the sheet is a live mirror of the actor and HP/conditions are editable from the phone.

---

## Phase 2.1 — Character sheet enhancements ✅ Done (2026-06-11)

> Spec: `docs/superpowers/specs/2026-06-11-phase-2.1-character-sheet-enhancements-design.md` · Plan: `docs/superpowers/plans/2026-06-11-phase-2.1-character-sheet-enhancements.md`. Polish pass on the Phase 2 sheet; rolling still Phase 3. Some live-API paths (modifier breakdowns, HTML enrichment) flagged in the spec for confirmation in play.

- [x] Fix: hero-point pips were invisible (the scoped `button { border: none }` reset outranked the `.border` utility) — now background-filled dots; tap to gain/spend.
- [x] Fix: shield-HP edits now persist — update the shield **item**, not the derived `system.attributes.shield` path.
- [x] Tap-for-info popups: feats, inventory items, and effects open a detail sheet (name, type/level, traits, action cost / bulk·price·usage, description). Spells arrive with Phase 3.
- [x] Bio reorg (PF2e-faithful): new **Profs** sub-tab; lineage + languages moved to the top of Vitals; Bio is prose-only.
- [x] Modifier breakdowns: tap AC / a save / perception / a skill / class DC to see its component modifiers + total. Display-only — the rolling phase adds a Roll button to the same popup.

**Milestone:** ✅ richer, PF2e-faithful sheet — inspect any number's math and any item's rules text from the phone.

---

## Phase 3 — Rolling: checks & spells (strikes → Phase 4)

> **Slice 1 done & verified live (2026-06-11):** checks + chat feed (committed to `main`; typecheck/build/66 tests green; manual checklist passed; damage-apply spike → deferred to Phase 7). Spec: `docs/superpowers/specs/2026-06-11-phase-3-rolling-design.md` · Plan: `docs/superpowers/plans/2026-06-11-phase-3-rolling-slice-1.md`.
>
> **Strikes moved to Phase 4 (2026-06-12)** — they belong in the Actions tab (see Phase 4).
>
> **Spells DONE & live-tested (2026-06-12):** Spells sub-tab (Known/Rituals/Activations), tap-for-detail popups, cast→chat, and a spellbook (prepare/manage). Plan: `docs/superpowers/plans/2026-06-12-phase-3-spells.md` · Report: `docs/reports/2026-06-12-spells-overnight-report.md`. (Learning new spells from the compendium is deferred.)

This is the heart of it. Everything goes through the system so rule elements, your homebrew, MAP, and degree of success all work.

- [x] Skill/save/perception checks: `actor.skills.athletics.roll()`, `actor.saves.reflex.roll()`, `actor.perception.roll()` — via the breakdown popup's **Roll** button (Slice 1, `skipDialog: true`).
- [ ] **Strikes → moved to Phase 4 (Actions tab).** `actor.system.actions`: each strike has `.variants[0..2]` (MAP 0/−5/−10) + `.damage` / `.critical`, shown as a card with three attack buttons + damage + crit. See Phase 4.
- [x] Spellcasting: **Spells sub-tab** (Known / Rituals / Activations) — iterate `actor.spellcasting`, entries → ranks → spells; cast via `entry.cast(spell, { rank, slotId })`; detail popups; spellbook (prepare slots / manage repertoire); remaining slots + focus shown, decrement on cast. Live-tested on Ezren (2026-06-12). Learning new spells from the compendium deferred. See `docs/reports/2026-06-12-spells-overnight-report.md`.
- [x] Roll results: subscribe to `createChatMessage` and render a chat feed — **Chat tab** (full history) + cross-tab **toast** for own results; real PF2e card HTML via `message.renderHTML()` (Slice 1). Damage-apply buttons: see the Spike result in the spec.
- [ ] Damage application buttons on incoming messages (the PF2e chat card buttons may "just work" if you render the real HTML and let their listeners attach — test this early, it determines how much chat UI you must build).

**Milestone:** a player can fight a full round from the phone: strike with MAP, roll damage, cast a spell, make a save.

**Note:** test with your Imaginary Weapon homebrew specifically — if the RollOption/DamageDice rule elements and the per-cast damage selector work through your UI, the architecture is proven.

---

## Phase 4 — Actions tab (strikes, actions, macros)

> **Reframed (2026-06-12):** the app's bottom **Actions** tab, built to mirror PF2e's char-sheet **Actions** tab — **Strikes** (moved from Phase 3: attack w/ MAP, damage, crit), the **actions/activities list** (Encounter/Exploration/Downtime, action glyphs), and combat **toggles** (Rage/Panache/stances). Rolls route through the Slice-1 chat feed. Agreed build order: **strikes first**, checkpoint, then the actions list. **Status: DONE (2026-06-12)** — shipped mirror-only (Strikes + Actions list + Toggles) on `main`; the **hotbar macro bar** split out to **Phase 4.1** below, the **common-actions row** still deferred.

- [x] **Strikes** (attack ×3 MAP, damage, crit), the **actions/activities list** (Encounter / Exploration / Downtime), and combat **toggles** (Rage/Panache/stances) — done on `main`. Spec: `docs/superpowers/specs/2026-06-12-phase-4-actions-tab-design.md` · Handoff: `docs/reports/2026-06-12-phase-4-actions-tab-handoff.md`.
- [x] **Hotbar macros → done in Phase 4.1 (macro bar on the Map tab).** `game.user.hotbar` → `game.macros.get(id)` → `macro.execute()`. See Phase 4.1.
- [ ] **Common-actions row** (Seek / Hide / Demoralize / Treat Wounds / Recall Knowledge via `game.pf2e.actions`) — deferred (not in Phase 4.1; revisit later).

**Milestone:** ✅ player fights a full round from the phone — strike with MAP, roll damage/crit, use actions, flip combat toggles.

---

## Phase 4.1 — Macro bar (Map tab) ✅ Done (2026-06-12)

> Spec: `docs/superpowers/specs/2026-06-12-phase-4.1-macro-bar-design.md` · Plan: `docs/superpowers/plans/2026-06-12-phase-4.1-macro-bar.md`. Picks up the **hotbar macro bar** deferred from Phase 4. A horizontally-scrolling strip **permanently pinned at the bottom of the Map tab**, above the tab nav, mirroring the player's hotbar (all populated slots, flattened, slot order). Tap = run the macro, exactly like the desktop hotbar. Follows the established pattern (pure mapper → version-bumped hook → guarded action → thin UI). A new `MapTab` hosts it; Phase 7's map fills the area above the bar later. **Status: DONE (2026-06-12, user-accepted)** — code-complete on `main`; **162 tests** + typecheck + prod build green. Live in-Foundry verification accepted at code-complete (optional spot-check via the [[phase-4.1-progress]] checklist, esp. a script macro that reads `scope.actor`).

- [x] **Read the hotbar:** pure `buildHotbarView(game.user)` — flatten `game.user.hotbar` (`Record<slot, macroId>`) across all 5 pages in slot order, resolve `game.macros.get(id)`, skip dangling → `MacroButtonView { id, slot, name, img, canExecute }`. (`src/foundry/macros/{types,hotbar}.ts`)
- [x] **Render the bar:** `MacroBar` — pinned `overflow-x-auto` strip of icon + tiny-name buttons; empty-state hint; dimmed/disabled when `canExecute === false`. (`src/app/macros/MacroBar.tsx`)
- [x] **Host on the Map tab:** new `MapTab` (`flex flex-col h-full`: map area `flex-1` [Phase-7 placeholder for now] + `<MacroBar>` pinned `shrink-0`); route `"map"` → `<MapTab />` in `TabContent`.
- [x] **Execute:** guarded `executeMacro(macroId, actorId)` → `macro.execute({ actor, token })` (active actor + its active Token placeable, now the canvas renders; token-aware macros resolve `canvas.tokens.controlled` / the `token` param). Chat macros post to the existing chat feed; failures → Foundry toast. *(token scope added 2026-06-13.)*
- [x] **Live + tests:** `useHotbar` re-preps on `updateUser`/`updateMacro`/`deleteMacro`; Vitest for the pure mapper (slot order, dangling-skip, empty → `[]`); typecheck + prod build; manual live checklist (Player1 @ mobile width, hotbar with a chat macro + a script/actor macro).

**Milestone:** ✅ player taps a macro on the Map tab and it executes identically to desktop.

---

## Phase 5 — Initiative & combat tracker ✅ Done (2026-06-12)

> Spec: `docs/superpowers/specs/2026-06-12-phase-5-combat-tracker-design.md` · Plan: `docs/superpowers/plans/2026-06-12-phase-5-combat-tracker.md`. Live, player-facing **Combat** tab mirroring the stock tracker's player view (custom mobile list over `game.combat`, not the stock HTML). Built in 5 commits (4 plan tasks + a Roll-Initiative skill-picker popup follow-up). **177 tests** + typecheck + prod build green. Two paths confirm only in play (flagged for the live checklist): the **End My Turn** `nextTurn()` permission and the **vibrate**.

- [x] Read `game.combat`: `combat.turns` (ordered combatants), `combat.combatant` (current turn), round number — pure `buildEncounterView` mapper.
- [x] Render the order: portraits, names, initiative values. Respect visibility — hide combatants the player shouldn't see (`combatant.hidden`, `playersCanSeeName`); mirror what the stock tracker shows a player. NPC HP hidden from players.
- [x] Highlight "your turn" prominently; vibration (`navigator.vibrate`) on the transition into the player's turn (`useTurnAlert`, always-on in Shell).
- [x] Roll initiative button when combat starts and the player hasn't rolled — a skill-picker popup → `combat.rollInitiative([id])` with the chosen statistic.
- [x] End-turn button (players can end their own turn: `combat.nextTurn()` is permission-checked, guarded → toast on rejection).
- [x] Hooks: `updateCombat`, `createCombat`, `deleteCombat`, `createCombatant`, `updateCombatant`, `deleteCombatant`.

**Milestone:** ✅ combat tab shows live initiative and buzzes the player on their turn.

---

## Phase 6 — Journals → deferred to the end

> **Moved to the bottom of this file (2026-06-12)** per the build-order note above. Journals is the lowest-priority remaining feature; the battle map (Phase 7) is built first. See **Phase 6 — Journals (deferred)** at the end of the roadmap for the full section.

---

## Phase 7 — Lightweight battle map · **code-complete on `main` (2026-06-13)**

> **Shipped beyond the original plan:** the Map tab now renders the **real Foundry PIXI canvas** (walls/lighting/fog/vision) with a transparent React input layer driving pan/zoom, token drag→`moveToken`, token **targeting**, a **ruler** tool, **door** control, and token **conditions/effects** popups. The "custom renderer" sketch below was superseded by reusing the live canvas. Pending your play-test (bucket B).

Custom renderer, not the PIXI canvas. Goal: situational awareness + moving your token, not full fidelity.

- [ ] Data: `game.scenes.active` (or `canvas.scene` equivalent when canvas is off — use `game.scenes.active` since canvas is disabled). Background: `scene.background.src`, dimensions from `scene.dimensions`, grid size `scene.grid.size`.
- [ ] Renderer: a single `<canvas>` or transformed `<div>` with the background image; tokens as absolutely positioned elements (portrait, name, scaled to grid). Pan/zoom via pointer events (a small gesture lib or hand-rolled pinch-zoom — Chrome-only makes this easy).
- [ ] Visibility: render only tokens the player should see. Start crude: skip `hidden` tokens and rely on GM discipline; proper vision/fog is explicitly out of scope for v1. (Optional later: check `token.hidden` + a setting for "players see all non-hidden tokens".)
- [ ] Token movement: drag own token → snap to grid → `token.update({x, y})` (via `scene.tokens.get(id).update(...)`). Foundry validates ownership server-side. Show movement live from `updateToken` hooks.
- [ ] Current-turn indicator and selection ring; tap a token to see name/HP-bar-level info (respect what players normally see).
- [ ] Templates/measurement: out of scope for v1. Note it in the README so players know.

**Milestone:** player sees the fight, knows where everyone is, and moves their own token.

---

## Phase 8 — Performance, polish, hardening

- [ ] Profile on a real mid-range Android phone with your actual campaign world. Watch: initial world download size, JS heap, jank during chat spam.
- [ ] Code-split tabs (React.lazy) so the sheet loads fast even if the map renderer is heavy.
- [ ] Debounce hook-driven store updates (combat with many tokens fires a lot of `updateToken`).
- [ ] Reconnection handling: Foundry disconnects on screen lock; detect `disconnected` state and show a "reconnecting" overlay instead of a dead UI. Test screen-off → screen-on flow.
- [ ] Settings: force mobile on/off, default tab, vibration toggle, font size.
- [ ] Version pinning: set `relationships.systems` (pf2e min/max) and core `compatibility` in module.json. PF2e's internal API churns — every system update, smoke-test rolls/strikes/spells.
- [ ] Optional: release on GitHub with a manifest URL so your players auto-update; consider publishing to the Foundry package list later (the niche genuinely exists, as you noticed).

---

## Phase 8b — Neutralizing other modules on mobile · **DESCOPED (2026-06-13)**

> **No longer needed.** The Map tab renders the real Foundry canvas, so canvas-rendering modules (Sequencer / JB2A / Automated Animations / lighting) run normally instead of erroring on a missing `canvas`, and system-automation modules hook the live PF2e API regardless of UI. Hotbar macros — including module-added ones — run via the Map-tab macro bar with `{ actor, token }` scope. Nothing to neutralize. The original plan is kept below for reference only.

Foundry's module list is world-level, so you can't disable a module per-client — but you can neutralize them on the mobile client:

- [ ] Free win: canvas-rendering modules (Sequencer, JB2A, Automated Animations, weather, animated lighting) no-op automatically with the canvas disabled. Verify, don't assume — check the console for errors from modules that expect `canvas.*` to exist.
- [ ] Force client-scoped settings during `init`/`setup` in mobile mode (e.g., Dice So Nice's per-client enable toggle: `game.settings.set("dice-so-nice", "...", false)`). Client settings are per-browser, so desktop players are unaffected. Automate the one-time reload if a module only reads its setting at startup.
- [ ] CSS-hide injected UI from modules without client toggles (your UI takeover already hides most of the stock DOM; add selectors for offenders).
- [ ] For modules actively burning CPU with no off-switch: use **libWrapper** to wrap their hot functions with a no-op when mobile mode is active.
- [ ] Build a small "compatibility registry": `{ moduleId: { settings: [...], hideSelectors: [...], wrap: [...] } }` — only populate it for modules your table actually runs. Re-check after module updates.
- [ ] Guard everything with `game.modules.get(id)?.active` checks so missing modules never throw.

**Milestone:** mobile client shows no 3D dice, no animation work in the profiler, and no foreign UI elements, while desktop clients are untouched.

---

## Phase 6 — Journals (deferred)

> **Deferred to the end of the roadmap (2026-06-12)** — lowest-priority remaining feature; the battle map (Phase 7) is built first. Keeps the stable "Phase 6" identifier. Built after the battle map in the same work session.

- [ ] List journals the player can see (`game.journal.filter(j => j.testUserPermission(game.user, "OBSERVER"))`), folders as collapsible groups.
- [ ] Page viewer: journal entries are collections of pages (text/image/pdf). For text pages render `page.text.content` through `TextEditor.enrichHTML(..., { async: true })` so @UUID links, inline rolls, etc. resolve.
- [ ] Handle content links: tapping an actor/item/journal link should open something sensible in your UI (start with: items open a simple item card, journal links navigate, everything else no-ops).
- [ ] Image pages: pinch-zoomable image view (handouts, maps as images — cheap win).

**Milestone:** player reads the campaign handouts on the phone comfortably.

---

## Key reference notes

**API discovery workflow:** open desktop Foundry, F12 console. `game.actors.getName("Test").system.actions`, poke around. Anything the PF2e sheet can do, you can find by grepping the PF2e repo (`src/module/actor/character/sheet.ts` and the `app/sheet` templates are gold).

**Documents vs. live data:** always read from the Document (`actor.system.*`) and mutate via `document.update()`. Never hold copies of data in React state beyond the render cycle — the store mirrors, hooks invalidate.

**Permissions:** you never need to check permissions for safety (server enforces), only for UX (hide buttons that would fail).

**Chat is the system's output channel.** PF2e communicates results through chat messages. Decide early: render real PF2e chat HTML in a webview-style panel (more functionality free, less visual control) vs. custom renderers from message flags/rolls (clean, but you reimplement damage buttons). Recommendation: real HTML for v1.

**Things that will bite you:**

- The world DB downloads fully on join — a bloated compendium-heavy world is slow on mobile data. Trim or accept.
- `core.noCanvas` changes what `canvas.*` globals exist — always go through `game.scenes`, never `canvas.tokens`.
- Foundry hooks fire before/after differently across versions; test on the exact core version your table uses.
- Module conflicts: other UI modules may fight your CSS takeover. Test with your live world's module list, or scope mobile mode to ignore their DOM.

**Rough effort estimate (evenings/weekends):** Phases 0–1 a weekend; 2–3 the big chunk (2–3 weeks of evenings); 4–6 about a week combined; 7 one focused weekend for the crude version; 8 ongoing. A playable v1 (sheet + rolls + macros + initiative) inside a month is realistic.

**Definition of v1 done:** a player at your table runs an entire session — exploration and one combat — without ever pinch-zooming the stock Foundry UI.
