# Phases 7 (battle map) + 6 (journals) — Return checklist

**Date:** 2026-06-12 · **Branch:** `main` (all work committed) · **Tests:** 206 passing (42 files) · typecheck + prod build clean.

You were away; this is what got done autonomously and exactly what to test (and likely fix) now that you're back. Read the **interpretation note** first — if I read your instruction wrong, that's the thing to correct before anything else.

> **Follow-up after you returned (2026-06-12):** you reported the popup X not closing + asked for targeting. Both done — see **§7. Post-return: deselect fix + targeting** at the bottom. Both were live-verified in your running Foundry.

---

## 0. ⚠️ Interpretation note — please confirm

Your instruction was: *"Mark phase 5 as done. Defer phase 6 to the end of the plan. Then plan and implement phases 6 and 7."* "Defer phase 6 (Journals)" and "implement phases 6 and 7" pull in opposite directions, so I made a call:

- **Phase 5** (combat tracker) → marked **done** in `pf2e-mobile-companion-plan.md` (it was already shipped in 5 commits; I verified 177 tests + build green before checking it off).
- **Journals (Phase 6)** → **moved to the end** of the roadmap doc (lowest priority); a "Build order (revised)" banner explains it. Phase **numbers kept stable** (every old report says "Phase 7 = battle map") — only the *order of work* changed.
- **Built the battle map (Phase 7) first, then Journals (Phase 6)** — both implemented this session, map prioritized.

**If you actually meant** "don't build journals yet, build the map and the *next* phase (Phase 8 settings/polish)," tell me and I'll re-aim. Nothing about journals is wasted either way — it's on the roadmap regardless.

---

## 1. What shipped

**Phase 7 — lightweight battle map** (`src/foundry/scene/*`, `src/app/map/*`, routed in `MapTab`). 6 task commits:
- pure `buildSceneView` mapper + `screen↔scene` transform helpers (TDD) · `useScene` hook · `BattleMap` (fit-on-mount, one-finger pan, two-finger pinch-zoom, wheel-zoom) · drag-your-own-token → `moveToken` (server-validated, optimistic + revert) · tap-a-token info popup · disposition-tinted + current-turn rings. Custom DOM over `game.scenes.active` — **no PIXI canvas** (`noCanvas` stays on).

**Phase 6 — journals reader** (`src/foundry/journal/*`, `src/app/journal/*`, routed in `JournalTab`). 4 task commits:
- pure `buildJournalTree` + `buildEntryPages` mappers (TDD) · `useJournals`/`useJournalEntry` hooks · collapsible folder list ⇄ entry page-viewer · text pages enriched via the existing `enrichHtml` · content-link + inline-roll click routing (`links.ts`) · image/pdf/video pages · full-screen pinch-zoom image viewer.

**Plus:** Phase 5 marked done + roadmap reordered (1 doc commit); spec+plan committed for each phase; a live-found deprecation fix (see §3).

Spec/plan docs: `docs/superpowers/specs|plans/2026-06-12-phase-7-battle-map-*` and `…-phase-6-journals-*`.

---

## 2. Live-test results (what I already confirmed)

I logged in as **Player1** at 412px width against your running dev world ("Test"). Confirmed working **in-app, on the real data**:

- ✅ Mobile takeover (noCanvas on, React root mounted, stock UI hidden), character auto-resolved to **Ezren**, sheet renders.
- ✅ **Battle map renders correctly** — the active scene's background fits the map area and **both tokens (Valeros + Goblin Warrior) sit accurately over the ruins**, not offset into the letterbox. This validates the `scene.dimensions` coordinate math (3840×1920, grid 100) **canvas-free** — the single riskiest thing in Phase 7.
- ✅ Journal tab shows the **empty state** ("No journals." — correct: the world has 0 journal entries).
- ✅ **No runtime errors** from the new code (only Foundry's "window < 1024px" notices).

I left the Player1 session open on the Map tab for you to keep poking.

---

## 3. Fixed during testing

- **`Scene#background` deprecation (Foundry v14).** The getter warned on every map render. Switched `useScene` to read `scene._source.background.src` (same value, no deprecated getter) — verified the warning is gone after reload and the background still renders. Commit: *"read scene background from _source…"*.

---

## 4. What I could NOT test live (do these now)

The dev world's state limited coverage: **Ezren owns no token on the active scene, combat hadn't started, and there are 0 journals.** So these paths are **code-complete + typechecked but unproven in play** — test them:

### Battle map (Phase 7)
- [ ] **Drag-to-move your own token** ⚠️ *highest-risk, like Phase 5's End-Turn.* Use a character that **owns a token on the active scene** (put Ezren's token on the scene, or log in as the player who owns **Valeros**). Your own token should show a grab cursor; drag → it snaps to the grid and moves on the GM's desktop within ~1s. **A rejected move (no permission) should toast and snap back.** Record whether players can move their own tokens in your world's config.
- [ ] **Padded scene.** The test scene has **zero padding** (sceneX/Y = 0), so the padding-offset path is unproven. Open a scene **with padding and/or a `background.offsetX/Y`** and confirm tokens still line up with the art. *If tokens are off by a constant amount, the fix is one line in `useScene` (how `dims`/coords are read) — never the tested mapper.*
- [ ] **Pinch-zoom + pan** on a real touchscreen (two-finger zoom, one-finger pan; double-nothing). Desktop: mouse-wheel zoom + drag-pan work.
- [ ] **Tap a token → info popup** (name / disposition / HP bar where visible). Tap ≠ drag is gated at 6px of movement — confirm a clean tap opens the popup and a drag doesn't.
- [ ] **Current-turn ring.** Start combat; the active combatant's token should get a pulsing indigo ring that follows turn changes (ties into Phase 5). Confirm `combatant.sceneId === scene.id` gating (ring only on the viewed scene).
- [ ] **Disposition ring colors** (friendly = sky, hostile = rose, neutral = amber, secret = fuchsia) and **GM-hidden / secret tokens are absent for players**.
- [ ] **HP bars** under tokens show for own/party only (NPC tokens: no bar), mirroring the tracker.

### Journals (Phase 6) — needs shared journals to exist
Have the GM **share a multi-page entry** (incl. a hidden page), an **image handout**, and an entry containing a **`@UUID` link to an actor** and **another journal**. Then as Player1:
- [ ] Only **shared** entries appear, grouped by **collapsible folders**; a **hidden page** inside a shared entry does **not** show (per-page permission filter).
- [ ] A **text page** renders formatted (headings/lists/bold) via the PF2e enricher.
- [ ] **Content links:** tapping an **actor** link switches the app to that sheet; a **journal/page** link navigates the reader; an **inline `[[/r …]]` roll** posts to chat. ⚠️ PF2e **`@Check`** links bubble to PF2e's own handler — with no token selected on mobile they may fall back to `game.user.character` or error; **record the behavior** (decides whether to special-case them).
- [ ] **Image page** renders fit-to-width; tapping opens the **full-screen pinch-zoom** viewer (double-tap refits; ✕ closes). **pdf** page shows an "Open PDF" link; **video** uses a native player.
- [ ] Live: GM **shares/unshares** an entry → the list updates within ~1s.

---

## 5. Known limitations / deferrals (by design, not bugs)

- **Battle map:** no vision/fog/lighting/walls (canvas is off — v1 shows all non-hidden tokens, GM discipline), no templates/measurement, no token rotation/elevation editing, **active scene only** (no scene switching), move-your-own-token only.
- **Nameplates** on tokens are hidden below ~0.35 zoom (unreadable when fully zoomed out) — the tap popup always shows full info. Phone-rotation doesn't refit the map (fits on mount / scene change only).
- **Journals:** no editing, no in-page heading TOC/anchor jumps, no search, PDF links out (no embedded PDF.js), no "show to players" action.
- **Phase 5 still has 2 live-only items** from before (carried in [[phase-5-progress]]): the **End-My-Turn `nextTurn()` permission** and the **vibrate** — worth confirming on the same pass.

---

## 6. Re-verify any time

```
npm run test       # 206 passing (42 files)
npm run typecheck  # clean
npm run build      # clean prod build → dist/
```

The dev server (vite :30001, proxying Foundry :30000) is running; a built `dist/` is current. Reload Foundry on a phone-width window (or set the module's "Mobile UI mode" to **Always on**) to see the tabs. The new tabs are **Map** (battle map + macro bar) and **Journal**.

---

## 7. Post-return: deselect fix + targeting (2026-06-12)

Both shipped on `main` and **live-verified in your running Foundry** (Player1, mobile width).

### Fixed — token info popup wouldn't close ("pressing X doesn't deselect")
**Root cause:** the popup was rendered *inside* the map viewport, whose `pointerdown` handler calls `setPointerCapture` — which redirected the `pointerup`, so the X (and backdrop tap) never produced a `click`. **Fix:** the popup (and the new targets chip) are now siblings of the viewport, not children. Verified live: tap a token → popup opens → tap **X** → it closes.

### New — target tokens + multi-target (full no-canvas integration)
Foundry's targeting is canvas-coupled and `setTarget` no-ops with `noCanvas`. I researched the v14.364 source and drove the two **canvas-free** primitives directly:
- **`game.user.targets.add(standIn)`** — a stand-in carrying `.id/.document/.actor` but **no `.object`**, so **strikes/spells you roll from the phone resolve vs the target's AC** (PF2e reads only actor data; all geometry is guarded on the absent `.object`).
- **`game.user.broadcastActivity({ sceneId, targets })`** — so the **GM's canvas draws the reticles**. The `sceneId` is mandatory (without it the GM clears your targets).

**How to use it:** tap a token → the info popup has a **Target / Untarget** button. Targeted tokens show a **red reticle**; a **"N targets ✕" chip** at the top clears all. Tap several tokens to multi-target (each toggle adds/removes).

**Live-verified by me:** `game.user.targets` populates with the correct stand-in (`hasDoc:true, hasActor:true, hasObject:false`); the broadcast carries `{sceneId, targets}`; reticles render; multi-target → "2 targets" chip; clear empties everything (local + broadcast). Files: `src/foundry/scene/targeting.ts` (+ `tests/targeting.test.ts`), `targeted` flag through `scene/{types,view}.ts` + `useScene` (re-preps on the `targetToken` hook), reticle in `TokenSprite`, button in `TokenInfoPopup`, chip in `BattleMap`.

**Still confirm in real play (needs a GM watching + an actual roll):**
- [ ] When you target from the phone, the **GM's canvas shows the reticle** on that token (I verified the broadcast is *sent* correctly with the sceneId handshake; the GM-side render is Foundry's stock path).
- [ ] **Roll a strike/spell from the phone with a target set** → the chat card shows **"vs AC N"** / Hit-Miss against that target. (The `game.user.targets` integration is verified populated; this confirms PF2e consumes it at roll time as the research found.)
- [ ] **NPC AC visibility:** the AC number only shows if the target **has a player owner** OR the world's **"Show DCs"** metagame setting is on — otherwise PF2e renders a hidden DC. Not a bug; note which your table uses.
- [ ] Multi-target with a multi-target spell (e.g. a save-based AoE) applies to all targets as expected.

**Deferred polish (noted, not built):** long-press a token to quick-target without opening the popup (faster multi-target); a per-token "is targeted by N players" indicator. The current tap→popup→Target flow covers single + multi.

---

## 8. Post-return round 2: move + grid (2026-06-12)

Two more you reported — both fixed on `main`, **live-verified** (Player1, dragging Valeros's token). **206 tests + build green.**

### Fixed — couldn't move a token from the phone
`isMine`, ownership, and the drag gesture were all fine — the move dispatched `token.update({x,y})`, which **crashed inside Foundry**: `TypeError: Cannot read properties of null (reading 'isSquare')`. Root cause: Foundry v12+ measures the movement path on every x/y change, and **PF2e's `TokenDocument#measureMovementPath` dereferences `canvas.grid.isSquare`** — null with `noCanvas`. `canvas.grid` is a prototype getter (can't assign), so `moveToken` now **lends it the scene's `SquareGrid` via `Object.defineProperty` for the update's duration**, then restores (no-op when canvas is on). Verified: a real drag moves the token (3100,500 → 3500,700) and the GM sees it.

### Fixed — couldn't see the grid
The grid was **never drawn** (only the background + tokens). Now rendered as an overlay. Two gotchas handled: (1) most scenes leave the grid color **black**, invisible on a dark battle map → I render **white lines with `mix-blend-mode: difference`** so it shows on any map; (2) the grid lives inside the zoom-scaled stage, so a fixed 1px line vanishes when zoomed out → **line width scales with zoom** to stay ~1px on screen. Square grids (type 1) only for v1. Verified: grid is crisp and visible.

**Confirm in play:**
- [ ] Drag your own token around — it moves on the GM's canvas; dragging a token you *don't* own should toast + snap back.
- [ ] **Hex / gridless scenes:** v1 only draws **square** grids — a hex scene shows no grid overlay (tokens/positioning still work). Tell me if you use hex and I'll add it.
- [ ] Grid visibility on a **light** map (the difference blend should still show it, but worth a look).
