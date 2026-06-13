# De-AI the source — design

## Goal

Make `src/**` read as hand-written and separate concerns better, with **zero behavior change**. The existing safety net — 260 tests, `tsc --noEmit`, and the production build — stays green at every commit.

## Scope

- **In scope:** source files under `src/**` only.
- **Out of scope:** all markdown/docs (`README.md`, `pf2e-mobile-companion-plan.md`, `docs/**`), git history, `.superpowers/`, build config. Left untouched.

## Non-goals

- No feature changes, no logic changes, no dependency changes.
- No blanket variable renames (e.g. `a`→`actor` everywhere). Terse locals in short pure functions are normal; renaming all of them is high-churn, high-risk, low-value.
- No deep refactor of the map components (they are code-complete but pending live play-test — see Tier 2).

## Constraints / safety net

Behavior-preserving throughout. Verification gate run **before every commit**:

```
npm test          # 260 passing baseline
npm run typecheck # tsc --noEmit
npm run build     # vite production build
```

Any red blocks the commit. Land as staged commits directly on `main` (matches the project's per-task-commit workflow); each stage is independently green so it can be bisected or reverted.

## Part 1 — Surface-tell sweep (comments & naming)

### Remove (the actual AI fingerprints)

- **File-path header comments** — e.g. `// src/app/map/CanvasMap.tsx` as line 1.
- **Task/spec number refs** — `(#5)`, `(#3)` (~8 occurrences: `BreakdownModal.tsx`, `DetailModal.tsx`, `actor/types.ts`, `actor/view.ts`).
- **Process references in comments** — "the Phase-3 seam", "land in Slice B", "non-interactive for v1 (… is Phase 7)", banner dividers like `// ---------- Strikes (Phase 4) ----------` (~14 occurrences).
- **Robotic justifications** — "Defensive:", "Defensive over PF2e's shape", and similar boilerplate framing.
- **JSDoc on private/internal helpers** (`readBreakdown`, `readPan`, `worldAt`, `screenAt`, …) and any comment that merely restates the code.

### Keep (the genuine *why* — reword lightly so they don't all read identically)

- PF2e quirks: "cap hero points at 3; live actors surface max:0", "PF2e also stuffs a derived `travel` speed in here", the dual-shape note (modifiers live on either the statistic or its `.check`).
- Non-obvious mechanics: "capture → runs before PF2e's button listener", the ruler-mode explanation, grid-snap no-op notes.
- All `eslint-disable*` comments — they are functional, not decorative.

### Naming

Rename only where a name is genuinely confusing in context. No mechanical sweep.

## Part 2 — Structural tidy (separate concerns)

### Tier 1 — clear win, low risk

These are pure data mappers and type declarations, fully exercised by `tests/characterView.*.test.ts`, `tests/spells*.test.ts`, etc. — so splits are safe and immediately verifiable.

- **`foundry/actor/view.ts` (301 lines)** → split mappers by domain into a `view/` folder (e.g. `header`, `defenses`, `skills`, `bio`, `feats`, `inventory`, `conditions`, `detail`). Shared private helpers (e.g. `readBreakdown`) move to a small internal module in the folder (`view/modifiers.ts` or similar).
- **`foundry/actor/types.ts` (337 lines)** → split type declarations by the same domains into a `types/` folder.
- **`foundry/spells/view.ts` (213)** + **`foundry/spells/types.ts` (186)** → same treatment **only if** it falls out cleanly; otherwise leave as-is rather than force it.

**Import stability:** convert each split file into a folder with a barrel `index.ts` that re-exports the domain modules (plain re-exports, no logic). This keeps every public import path identical — `foundry/actor/view`, `foundry/actor/types`, etc. — so all consumers stay green without edits:

- `actor/types`: 24 internal + 17 test importers
- `actor/view`: 4 internal + ~12 test importers
- `spells/types`: 6 internal importers
- `spells/view`: 3 internal importers

### Tier 2 — map components, conservative (risk-aware)

`app/map/BattleMap.tsx` (381) and `app/map/CanvasMap.tsx` (370) are code-complete but **pending live play-test**, so the bar for disturbing them is high.

- **Do:** comment/surface-tell cleanup; extract the obviously-pure coordinate/canvas helpers (`liveCanvas`, `readPan`, `applyPan`, `worldAt`, `screenAt`) into a small pure module.
- **Don't:** pull the pointer/gesture state machine into a hook. Defer until after play-test.

## Staging plan

Each numbered item is one (or a few) commits, green before landing:

1. **Surface-tell sweep** across `src/**` — comments and the rare clarifying rename. No structural moves.
2. **Split `actor/view.ts`** into `view/` + barrel.
3. **Split `actor/types.ts`** into `types/` + barrel.
4. **Split `spells/view.ts` + `spells/types.ts`** (only if clean; otherwise note and skip).
5. **Map components** — conservative tidy + pure-helper extraction.

## Risks & mitigations

- **Breaking the unverified map code** → Tier 2 stays conservative; no gesture-logic moves.
- **Import breakage from splits** → barrels keep public paths stable; `tsc --noEmit` + the full suite catch any miss before commit.
- **Over-trimming a useful comment** → the Keep list is explicit; when unsure, keep the *why*.
- **Churn for its own sake** → no blanket renames; skip the spells split if it isn't clean.

## Success criteria

- `src/**` carries no file-path headers, task/phase/slice references, or "Defensive:"-style boilerplate; remaining comments explain non-obvious *why*.
- `actor/view.ts` and `actor/types.ts` are folders of focused, single-domain modules behind stable barrels.
- Map components are cleaned but behaviorally untouched.
- 260 tests + typecheck + production build green at every commit; no public import path changed.
