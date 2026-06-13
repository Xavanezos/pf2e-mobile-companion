# De-AI the Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `src/**` read as hand-written and separate concerns better, with zero behavior change.

**Architecture:** A behavior-preserving cleanup in two kinds of work — (1) a comment/surface-tell sweep across all source, keeping only genuine *why* notes; (2) tidy-in-place splits of four oversized mapper/type files into per-domain folders behind stable barrel `index.ts` re-exports, so no import path changes. The map components get a conservative pass only (comments + pure-helper extraction), since they are pending live play-test.

**Tech Stack:** TypeScript, React 18, Zustand, Vite 6, Vitest 4, Tailwind v4. No new dependencies.

---

## TDD adaptation (read first)

This is a **behavior-preserving refactor**, not new behavior. There is no failing-test-first cycle. The existing suite **is** the safety net. Every task's verification step is the same gate, and the expected result never changes:

```
npm test          # Expected: Test Files 48 passed (48), Tests 260 passed (260)
npm run typecheck  # Expected: no output, exit 0
npm run build      # Expected: "✓ built in ..." , exit 0
```

**Baseline (already confirmed green):** 260 tests, typecheck clean, build OK. If any task makes any of these red, fix it before committing. Never commit red.

No new tests are written (no new behavior). Do **not** edit anything under `tests/**` — if a split were to require a test-import change, that means a public import path moved, which this plan forbids (barrels keep them stable).

## What counts as an "AI tell" — the sweep catalog

In every file you touch, **remove**:

1. **File-path header comments** — a comment whose text is the file's own path. Exact known locations (re-discover to be safe):
   - `src/app/map/CanvasMap.tsx:1`, `src/app/map/useCanvasLifecycle.ts:1`, `src/foundry/canvas/control.ts:1`, `src/foundry/canvas/hitTest.ts:1`, `src/foundry/canvas/lifecycle.ts:1`, `src/foundry/canvas/view.ts:1`
   - Discover: `grep -rnE "^// *(src/|app/|foundry/)" src --include='*.ts' --include='*.tsx'`
2. **Task/spec number refs** — `(#5)`, `(#3)`, etc. inside comments. Discover: `grep -rn "(#[0-9]" src --include='*.ts' --include='*.tsx'`. Remove just the `(#N)` token (and any "the … seam" framing around it); keep the real description if it explains a *why*.
3. **Process references** — "Phase N", "Slice X", "for v1", and banner dividers like `// ---------- Strikes (Phase 4) ----------`. Discover: `grep -rniE "phase [0-9]|slice [a-z0-9]| seam|for v1|^// -{4,}" src --include='*.ts' --include='*.tsx'`. Remove the process reference. If the sentence carries real meaning without it, keep the meaning; drop bare dividers entirely.
4. **Robotic justifications** — "Defensive:", "Defensive over PF2e's shape", and similar boilerplate. Discover: `grep -rni "defensive" src --include='*.ts' --include='*.tsx'`. Reword to a plain note of the actual quirk, or delete if it only restates that missing data is handled.
5. **JSDoc on private/internal helpers** and any comment that merely restates the code. Convert a private helper's JSDoc to a one-line `//` note **only if** it explains a non-obvious *why*; otherwise delete it.

**Keep** (do not delete — reword lightly if several read identically):

- **Directive comments — deleting these breaks the build/lint.** 11× `// eslint-disable-next-line react-hooks/exhaustive-deps` and 1× `/* @vite-ignore */` (`src/module.ts:44`). Discover to confirm none are lost: `grep -rnE "@ts-|eslint-|/// <reference|@vite-ignore" src --include='*.ts' --include='*.tsx'` — count must stay **12** across the whole sweep.
- **Genuine *why* notes** — PF2e quirks ("cap hero points at 3; live actors surface max:0", "PF2e also stuffs a derived `travel` speed in here", "modifiers live on either the statistic or its `.check`"), event-ordering ("capture → runs before PF2e's button listener"), grid-snap no-op notes, the ruler-mode explanation.

When unsure whether a comment is a tell or a *why* note: **keep it**.

## Commit conventions

Conventional-commit style, plain prose, no "Phase/Slice" language in the messages themselves. Each task is one commit unless noted. Commit trailer (Co-Authored-By) per the standing project setting — see the execution handoff note; if the user opts out for the de-AI work, omit it on these commits.

---

## Task 1: Comment sweep — `src/foundry/` (excluding the four to-be-split files)

The four files split in Tasks 3–6 (`actor/types.ts`, `actor/view.ts`, `spells/types.ts`, `spells/view.ts`) are cleaned **as part of their split** — skip them here.

**Files (modify, comments only):** every `.ts` under `src/foundry/` **except** `actor/types.ts`, `actor/view.ts`, `spells/types.ts`, `spells/view.ts`. Notably: `actor/strikes.ts`, `actor/strikeActions.ts`, `actor/strikeChatActions.ts`, `actor/mutations.ts`, `actor/actions.ts`, `scene/*.ts`, `chat/*.ts`, `combat/*.ts`, `canvas/*.ts`, `journal/*.ts`, `macros/*.ts`, `spells/cast.ts`, `spells/chatActions.ts`, `spells/spellbook.ts`.

- [ ] **Step 1: Discover the tells in this subtree**

Run each, note the hits in the files in scope:
```bash
grep -rnE "^// *(src/|app/|foundry/)" src/foundry --include='*.ts'
grep -rn "(#[0-9]" src/foundry --include='*.ts'
grep -rniE "phase [0-9]|slice [a-z0-9]| seam|for v1|^// -{4,}" src/foundry --include='*.ts'
grep -rni "defensive" src/foundry --include='*.ts'
```

- [ ] **Step 2: Edit each file** per the sweep catalog above — remove tells, keep *why* notes and all directive comments. Do not change any code, only comments. (Known examples in scope: `actor/strikes.ts:35` "Defensive over PF2e's shape", the `canvas/*.ts:1` path headers.)

- [ ] **Step 3: Confirm directives survived**

Run: `grep -rnE "@ts-|eslint-|/// <reference|@vite-ignore" src --include='*.ts' --include='*.tsx' | wc -l`
Expected: `12`

- [ ] **Step 4: Verify the gate**

Run: `npm test && npm run typecheck && npm run build`
Expected: 260 tests pass, typecheck silent, build "✓ built".

- [ ] **Step 5: Commit**

```bash
git add src/foundry
git commit -m "refactor: drop AI-process comments from foundry modules"
```

---

## Task 2: Comment sweep — `src/app/` (excluding `src/app/map/`)

Map files are handled conservatively in Task 7 — skip `src/app/map/` here.

**Files (modify, comments only):** every `.ts`/`.tsx` under `src/app/` **except** `src/app/map/**`. Notably: `App.tsx`, `store.ts`, `useActor.ts`, `useFoundryHook.ts`, `SheetTab.tsx`, `SettingsModal.tsx`, and everything under `sheet/`, `chat/`, `combat/`, `actions/`, `journal/`, `tabs/`, `macros/`.

- [ ] **Step 1: Discover the tells in this subtree**
```bash
grep -rnE "^// *(src/|app/|foundry/)" src/app --include='*.ts' --include='*.tsx'
grep -rn "(#[0-9]" src/app --include='*.ts' --include='*.tsx'
grep -rniE "phase [0-9]|slice [a-z0-9]| seam|for v1|^// -{4,}" src/app --include='*.ts' --include='*.tsx'
grep -rni "defensive" src/app --include='*.ts' --include='*.tsx'
```
(Excludes aside, known hits: `BreakdownModal.tsx:11` `(#5)`+"Phase-3 seam", `DetailModal.tsx:14` `(#3)`, `CombatantRow.tsx:6` "Phase 7", `SpellsPanel.tsx:21` "Slice B", `ActionsTab.tsx:36` "Slice B", `MapTab.tsx:10` "Phase 4.1".)

- [ ] **Step 2: Edit each file** per the sweep catalog — remove tells, keep *why* notes and every `eslint-disable` line. Comments only; no code changes.

- [ ] **Step 3: Confirm directives survived**

Run: `grep -rnE "@ts-|eslint-|/// <reference|@vite-ignore" src --include='*.ts' --include='*.tsx' | wc -l`
Expected: `12`

- [ ] **Step 4: Verify the gate**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green (260 / silent / built).

- [ ] **Step 5: Commit**
```bash
git add src/app
git commit -m "refactor: drop AI-process comments from app components"
```

---

## Task 3: Split `foundry/actor/types.ts` into a `types/` folder

337 lines of type declarations grouped by domain. Replace the single file with a folder of focused modules behind a barrel. **Every symbol stays exported exactly as before**; the barrel re-exports all of them so the import path `foundry/actor/types` is unchanged (24 internal + 17 test importers rely on it).

**Files:**
- Create: `src/foundry/actor/types/character.ts` — the core sheet domain: `Rank`, `ModPartView`, and all view interfaces `HpView`→`CharacterView` (lines ~5–118) **and** all source-like interfaces `IwrLike`→`CharacterLike` (lines ~120–226).
- Create: `src/foundry/actor/types/strikes.ts` — `StrikeVariantView`→`StrikeActorLike` (the two strike sections, lines ~228–290).
- Create: `src/foundry/actor/types/actions.ts` — `ActionItemView`→`ActionsActorLike` (lines ~292–323).
- Create: `src/foundry/actor/types/toggles.ts` — `ToggleView`→`TogglesActorLike` (lines ~325–336).
- Create: `src/foundry/actor/types/index.ts` — barrel.
- Remove: `src/foundry/actor/types.ts` (the folder replaces it; the file must be deleted or it shadows the folder in module resolution).

- [ ] **Step 1: Create the four domain files.** Move each interface/type verbatim into its file, dropping the `// ---------- … (Phase N) ----------` banners as you go. No type body changes. (`character.ts` may keep two light plain-language section comments like `// Views — what the UI renders` / `// Source — the live actor, structurally`, with no phase refs.)

- [ ] **Step 2: Create the barrel** `src/foundry/actor/types/index.ts`:
```ts
export * from "./character";
export * from "./strikes";
export * from "./actions";
export * from "./toggles";
```

- [ ] **Step 3: Delete the old file**
```bash
git rm src/foundry/actor/types.ts
```

- [ ] **Step 4: Verify the gate** (this is where a missed type surfaces)

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck silent (every `from ".../actor/types"` still resolves), 260 tests pass, build OK.

- [ ] **Step 5: Commit**
```bash
git add src/foundry/actor/types
git commit -m "refactor: split actor types into per-domain modules"
```

---

## Task 4: Split `foundry/actor/view.ts` into a `view/` folder

301 lines of mapper functions. Same barrel pattern. Private helpers stay private (not re-exported from the barrel) so the public surface is byte-identical to today.

**Public symbols the barrel MUST re-export** (these are imported by tests/consumers — do not rename, do not drop): `mapHeader`, `initiativeOptions`, `mapDefenses`, `mapAbilities`, `mapTraits`, `mapSkills`, `effectBadgeLabel`, `mapConditions`, `mapEffects`, `formatBulk`, `formatPrice`, `mapInventory`, `actionGlyph`, `mapFeats`, `mapBio`, `buildItemDetail`, `buildCharacterView`.

**Files:**
- Create: `src/foundry/actor/view/modifiers.ts` — the shared private helper `readBreakdown` (currently a non-exported `function`; **export** it here so siblings can import it). Not re-exported from the barrel — stays internal.
- Create: `src/foundry/actor/view/header.ts` — `mapHeader`.
- Create: `src/foundry/actor/view/defenses.ts` — `initiativeOptions`, `mapDefenses`, `mapAbilities`, `mapTraits` + the `SAVE_LABELS`/`ABILITY_LABELS`/`SPEED_LABELS`/`SIZE_LABELS` consts. Imports `readBreakdown` from `./modifiers`.
- Create: `src/foundry/actor/view/skills.ts` — `mapSkills`. Imports `readBreakdown` from `./modifiers`.
- Create: `src/foundry/actor/view/conditions.ts` — `effectBadgeLabel`, `mapConditions`, `mapEffects`.
- Create: `src/foundry/actor/view/inventory.ts` — `formatBulk`, `formatPrice`, `mapInventory` + private `mapInventoryItem`, `catType` and the `DASH`/`ITEM_CATEGORY`/`OTHER_CATEGORY` consts.
- Create: `src/foundry/actor/view/feats.ts` — `actionGlyph`, `mapFeats` + private `titleCaseKey` and the `FEAT_GROUPS`/`OTHER_FEAT_GROUP` consts.
- Create: `src/foundry/actor/view/bio.ts` — `mapBio` + private `mapProficiencies` (and `titleCaseKey` if `mapProficiencies` is its only user — otherwise keep `titleCaseKey` wherever it's shared; let `tsc` confirm).
- Create: `src/foundry/actor/view/detail.ts` — `buildItemDetail` + the `ITEM_TYPE_LABELS` const. Imports `actionGlyph` from `./feats`.
- Create: `src/foundry/actor/view/character.ts` — `buildCharacterView`. Imports the `map*` functions from their sibling modules.
- Create: `src/foundry/actor/view/index.ts` — barrel.
- Remove: `src/foundry/actor/view.ts`.

**Type imports inside these files:** `import type { … } from "../types"` (resolves to the new `actor/types/` barrel from Task 3).

- [ ] **Step 1: Create `modifiers.ts`** with `readBreakdown` (add `export`):
```ts
import type { ModifierLike, ModPartView } from "../types";

export function readBreakdown(stat: { modifiers?: ModifierLike[]; check?: { modifiers?: ModifierLike[] } } | undefined): ModPartView[] | undefined {
  const mods = stat?.modifiers ?? stat?.check?.modifiers ?? [];
  const parts = mods.filter((m) => m.enabled !== false).map((m) => ({ label: m.label, value: m.modifier }));
  return parts.length ? parts : undefined;
}
```

- [ ] **Step 2: Create the domain files** listed above. Move each function and its private helpers/consts verbatim. Preserve each symbol's `export`/non-`export` exactly as in the original (only `readBreakdown` changes — now exported, in `modifiers.ts`). Clean any tells in the moved comments per the catalog (e.g. drop `(#5)`/"Defensive:" on `readBreakdown`; keep the trimmed *why* about dual modifier shape). Add the cross-module imports each file needs (`tsc` will name any you miss).

- [ ] **Step 3: Create the barrel** `src/foundry/actor/view/index.ts`:
```ts
export * from "./header";
export * from "./defenses";
export * from "./skills";
export * from "./conditions";
export * from "./inventory";
export * from "./feats";
export * from "./bio";
export * from "./detail";
export * from "./character";
```
(`modifiers` is intentionally **not** re-exported — `readBreakdown` was never public.)

- [ ] **Step 4: Delete the old file**
```bash
git rm src/foundry/actor/view.ts
```

- [ ] **Step 5: Verify the gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck silent, 260 tests pass (the `characterView.*` tests import these names from `../src/foundry/actor/view` and must still resolve via the barrel), build OK.

- [ ] **Step 6: Commit**
```bash
git add src/foundry/actor/view
git commit -m "refactor: split actor view mappers into per-domain modules"
```

---

## Task 5: Split `foundry/spells/types.ts` into a `types/` folder

186 lines, three clear domains matching the existing banners. Same barrel pattern; `foundry/spells/types` path unchanged (6 internal importers).

**Files:**
- Create: `src/foundry/spells/types/casting.ts` — `SpellEntryKind`, `SpellRowView`→`SpellsView` (views) and the source-like `SpellLike`→`ActivationItemLike` (lines ~6–123).
- Create: `src/foundry/spells/types/detail.ts` — `SpellDetailView`, `SpellDetailLike` (lines ~125–150).
- Create: `src/foundry/spells/types/book.ts` — `SpellbookOptionView`→`SpellbookSourceLike` (the spellbook section, lines ~152–181).
- Create: `src/foundry/spells/types/index.ts` — barrel:
```ts
export * from "./casting";
export * from "./detail";
export * from "./book";
```
- Remove: `src/foundry/spells/types.ts`.

- [ ] **Step 1: Create the three domain files**, moving each interface/type verbatim and dropping the `// ----------` banners.
- [ ] **Step 2: Create the barrel** (above).
- [ ] **Step 3: Delete the old file**: `git rm src/foundry/spells/types.ts`
- [ ] **Step 4: Verify the gate**: `npm run typecheck && npm test && npm run build` — typecheck silent, 260 pass, build OK.
- [ ] **Step 5: Commit**
```bash
git add src/foundry/spells/types
git commit -m "refactor: split spell types into per-domain modules"
```

---

## Task 6: Split `foundry/spells/view.ts` into a `view/` folder

213 lines. Barrel pattern; `foundry/spells/view` path unchanged (3 internal importers).

**Public symbols the barrel MUST re-export:** `spellGlyph`, `mapSpellcastingEntry`, `mapActivations`, `buildSpellDetail`, `buildSpellbookView`.

**Files:**
- Create: `src/foundry/spells/view/casting.ts` — `spellGlyph`, `mapSpellcastingEntry`, `mapActivations` + private helpers `entryKind`, `mapRow`, `mapUses`, `readFocus`, `formatArea`(if used here) and the `rankNumber` const. (Group the entry/uses/activation mappers together — they share the casting source shapes.)
- Create: `src/foundry/spells/view/detail.ts` — `buildSpellDetail` + its private `formatArea` helper (move `formatArea` here if `buildSpellDetail` is its only user; otherwise keep it in `casting.ts` and import — let `tsc` confirm the single owner).
- Create: `src/foundry/spells/view/book.ts` — `buildSpellbookView`.
- Create: `src/foundry/spells/view/index.ts` — barrel:
```ts
export * from "./casting";
export * from "./detail";
export * from "./book";
```
- Remove: `src/foundry/spells/view.ts`.

**Type imports inside these files:** `import { … } from "../types"` (the Task 5 barrel).

- [ ] **Step 1: Determine `formatArea`'s single owner.** Run `grep -n "formatArea" src/foundry/spells/view.ts`. Place it in the file of its only caller; if both `casting` and `detail` use it, put it in `casting.ts` and `export` it for `detail.ts` to import.
- [ ] **Step 2: Create the domain files**, moving each function + its private helpers/consts verbatim, cleaning tells in the moved comments (e.g. drop "Slice B"/"Defensive over PF2e's spell.system shape" framing, keep any real *why*).
- [ ] **Step 3: Create the barrel** (above).
- [ ] **Step 4: Delete the old file**: `git rm src/foundry/spells/view.ts`
- [ ] **Step 5: Verify the gate**: `npm run typecheck && npm test && npm run build` — typecheck silent, 260 pass (`spellsView`/`spellDetail`/`spellbook` tests resolve via the barrel), build OK.
- [ ] **Step 6: Commit**
```bash
git add src/foundry/spells/view
git commit -m "refactor: split spell view mappers into per-domain modules"
```

---

## Task 7: Map components — conservative tidy (`src/app/map/`)

These are code-complete but **pending live play-test**, so: comment sweep on all map files **plus** one safe extraction — the live-canvas accessor helpers in `CanvasMap.tsx` (no React deps, single consumer). **Do not** touch the pointer/gesture/ruler state machine in `CanvasMap.tsx` or `BattleMap.tsx`.

**Files:**
- Create: `src/app/map/canvasAccess.ts` — the live-canvas accessor helpers currently local to `CanvasMap.tsx`: `liveCanvas`, `readPan`, `applyPan`, `screenCenter`, `worldAt`, `screenAt` (lines ~20–50). Export each.
- Modify: `src/app/map/CanvasMap.tsx` — remove the path header (line 1), delete those six local helpers, import them from `./canvasAccess`, and sweep remaining comments.
- Modify (comments only): `src/app/map/BattleMap.tsx`, `TokenSprite.tsx`, `TokenInfoPopup.tsx`, `useScene.ts`, `useCanvasLifecycle.ts` (drop its line-1 path header), and any other file under `src/app/map/`.

- [ ] **Step 1: Create `canvasAccess.ts`.** Move the six helper functions verbatim, adding `export` to each. They reference `globalThis.canvas`, `window`, and `globalThis.PIXI` exactly as today — copy without changes:
```ts
function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}
export function readPan(): { x: number; y: number; scale: number } | null { /* …verbatim… */ }
export function applyPan(p: { x: number; y: number; scale: number }): void { /* …verbatim… */ }
export function screenCenter(): { x: number; y: number } { /* …verbatim… */ }
export function worldAt(clientX: number, clientY: number): { x: number; y: number } | null { /* …verbatim… */ }
export function screenAt(worldX: number, worldY: number): { x: number; y: number } | null { /* …verbatim… */ }
```
Keep `liveCanvas` exported too (the others call it; simplest is to export all six). Preserve the real *why* comments on `worldAt`/`screenAt` (the stage-transform note), drop the path header.

- [ ] **Step 2: Update `CanvasMap.tsx`** — delete line-1 path header, delete the six moved helpers, add `import { liveCanvas, readPan, applyPan, screenCenter, worldAt, screenAt } from "./canvasAccess";` (import only the ones actually referenced — `tsc` will flag unused/missing). Sweep remaining tells per the catalog. **Leave every `useCallback`/pointer handler body unchanged**, including the `eslint-disable` at `BattleMap.tsx:93`.

- [ ] **Step 3: Sweep the other map files'** comments (path header at `useCanvasLifecycle.ts:1`, etc.). Comments only.

- [ ] **Step 4: Confirm directives survived globally**

Run: `grep -rnE "@ts-|eslint-|/// <reference|@vite-ignore" src --include='*.ts' --include='*.tsx' | wc -l`
Expected: `12`

- [ ] **Step 5: Verify the gate**

Run: `npm test && npm run typecheck && npm run build`
Expected: 260 tests pass (incl. `canvasView`/`canvasHitTest`/`canvasControl`/`mapRenderer`/`moveToken`/`ruler`/`sceneGeometry`), typecheck silent, build OK.

- [ ] **Step 6: Commit**
```bash
git add src/app/map
git commit -m "refactor: tidy map components and extract canvas accessors"
```

---

## Final verification

- [ ] **Whole-tree tell scan is clean** (no path headers, number refs, phase/slice/seam, defensive boilerplate left):
```bash
grep -rnE "^// *(src/|app/|foundry/)|\(#[0-9]" src --include='*.ts' --include='*.tsx'
grep -rniE "phase [0-9]|slice [a-z0-9]| seam|for v1|defensive|^// -{4,}" src --include='*.ts' --include='*.tsx'
```
Expected: no hits (or only deliberate, justified *why* notes you chose to keep — review each remaining line).

- [ ] **Directives intact:** `grep -rnE "@ts-|eslint-|/// <reference|@vite-ignore" src --include='*.ts' --include='*.tsx' | wc -l` → `12`.

- [ ] **No public import path moved:** `git diff --stat main -- tests/` shows **no test files changed**.

- [ ] **Final gate green:** `npm test && npm run typecheck && npm run build` → 260 / silent / built.

---

## Self-review against the spec

- **Spec Part 1 (surface-tell sweep)** → Tasks 1, 2, 7 (+ inline cleanup during 3–6). Catalog + keep-list reproduced above. ✓
- **Spec Part 2 Tier 1 (split actor/view, actor/types, spells/view, spells/types)** → Tasks 3, 4, 5, 6, all behind barrels with public symbols enumerated. ✓
- **Spec Part 2 Tier 2 (map, conservative)** → Task 7: comments + pure-helper extraction only; gesture logic explicitly untouched. ✓
- **Constraint (behavior-preserving, gate green per commit)** → identical gate in every task + final verification. ✓
- **Constraint (no public import path changes / tests untouched)** → barrels in 3–6; final check `git diff --stat -- tests/` empty. ✓
- **Non-goal (no blanket renames)** → no task renames variables; only comment-local clarity. ✓
- **Non-goal (docs untouched)** → no task edits markdown. ✓

**Type consistency:** barrel re-export sets list the exact existing export names; `readBreakdown` (actor) and `formatArea` (spells) are the only symbols whose visibility changes (private→exported-for-siblings), both kept out of the public barrel. No symbol is referenced that isn't defined in the original files.
