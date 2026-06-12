# Phases 7 (battle map) + 6 (journals) — Return checklist

**Date:** 2026-06-12 · **Branch:** `main` (all work committed) · **Tests:** 200 passing (41 files) · typecheck + prod build clean.

You were away; this is what got done autonomously and exactly what to test (and likely fix) now that you're back. Read the **interpretation note** first — if I read your instruction wrong, that's the thing to correct before anything else.

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
npm run test       # 200 passing (41 files)
npm run typecheck  # clean
npm run build      # clean prod build → dist/
```

The dev server (vite :30001, proxying Foundry :30000) is running; a built `dist/` is current. Reload Foundry on a phone-width window (or set the module's "Mobile UI mode" to **Always on**) to see the tabs. The new tabs are **Map** (battle map + macro bar) and **Journal**.
