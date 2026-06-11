# Phase 3 (rest) — Spells — Implementation Plan

> **Autonomous overnight build (2026-06-12).** User pre-authorized: write this plan and implement it solo, keep `main` green, test, write a morning report, then shut down. No interactive approval gates. Commit per task with the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer.

**Goal:** Mirror the PF2e character sheet's **Spellcasting tab** on mobile — its three sections **Known Spells**, **Rituals**, **Activations** — with tap-for-detail spell popups, casting that posts the real spell card to the Slice-1 chat feed, and a **spellbook** for preparing spells / filling known lists.

**Scope (user chose "Everything"):** prepared, spontaneous, focus, innate casters; rituals; item activations (wand/staff/scroll). Plus the spellbook (preparation + known/repertoire editing) — this *is* in scope now (unlike the earlier "prep is desktop-only" assumption).

**Architecture:**
- **Data (async).** PF2e exposes per-entry sheet data via `await entry.getSheetData()` → `SpellcastingSheetData { groups: SpellcastingSlotGroup[] , isPrepared/isSpontaneous/isInnate/isFocusPool/isRitual, statistic, ... }`. Each group is a rank: `{ id: "cantrips"|1..10, label, uses?: {value,max}, active: (ActiveSpell|null)[] }`, `ActiveSpell { spell, castRank?, expended?, signature?, virtual? }`. We `await` per entry and map to a plain view. The **pure** mapper `mapSpellcastingEntry(sheetData)` is unit-tested against fixtures; the async `buildSpellsView(actor)` is thin glue. (Grounded in cloned PF2e: `src/module/item/spellcasting-entry/{document,collection,types}.ts`, `src/module/actor/spellcasting.ts`.)
- **Cast (guarded).** New `src/foundry/spells/cast.ts`, same `guard()` contract as `rolls.ts`/`mutations.ts`: `entry.cast(spell, { rank?, slotId?, consume?, message? })` for prepared/spontaneous/focus/innate; ritual via the ritual entry; `consumable.consume()` / `castEmbeddedSpell()` for activations. A rejected cast surfaces a Foundry toast, never throws into React. Casting posts the real card → it flows through the existing `createChatMessage` feed (Chat tab + toast).
- **UI.** New **Spells** sub-tab under the *Sheet* tab (joins Vitals/Skills/Items/Feats/Profs/Bio in `SubTabBar`; bar is already `overflow-x-auto`). Inside: a 3-way segmented control **Known · Rituals · Activations**. Spell rows show name + action-cost glyph + cast affordance + expended/uses; tap a row → **SpellDetailModal**; tap cast → cast. A **Spellbook** button opens the prepare/known editor.
- **Live data via a `useSpells(actorId)` hook** (async build; rebuilds on `createItem`/`deleteItem`/`updateItem`/`updateActor` filtered to this actor). The store mirrors UI state only; Documents stay source of truth.

**Tech:** React 18, Zustand, TS, Vitest, Tailwind v4 (no preflight). Foundry v14 / PF2e v8.2. PF2e source ref: `E:/React Projects/pf2e`. Ezren (iconic Wizard, low level) is the live test character.

---

## File structure

**Create**
- `src/foundry/spells/types.ts` — `SpellsView`, `SpellEntryView`, `SpellRankView`, `SpellRowView`, `SpellDetailView`, `SpellbookView`, + source-like shapes (`SpellcastingSheetDataLike`, `SpellLike`).
- `src/foundry/spells/view.ts` — pure `mapSpellcastingEntry`, `mapSpellsView` (from a list of sheet-datas), `buildSpellDetail(spell)`; async `buildSpellsView(actor)` glue.
- `src/foundry/spells/cast.ts` — guarded `castSpell`, `castRitual`, `consumeActivation`, `prepareSpell`, `unprepareSpell`, `addKnownSpell`, `removeKnownSpell`, `setFocusPoints`/`refocus`.
- `src/app/sheet/useSpells.ts` — async hook → `SpellsView | null`, hook-driven refresh.
- `src/app/sheet/SpellsPanel.tsx` — the Spells sub-tab: segmented sections + lists.
- `src/app/sheet/spells/SpellRow.tsx`, `SpellEntryCard.tsx`, `SpellDetailModal.tsx`, `SpellbookModal.tsx`.
- Tests: `tests/spellsView.test.ts`, `tests/spellDetail.test.ts`, `tests/spellCast.test.ts`, `tests/spellbook.test.ts`.

**Modify**
- `src/app/store.ts` — add `"spells"` to `SheetSubTab`.
- `src/app/sheet/SubTabBar.tsx` — add the Spells entry.
- `src/app/sheet/CharacterSheet.tsx` — route `spells` → `<SpellsPanel actorId=… />`.
- `pf2e-mobile-companion-plan.md` — mark the spellcasting bullet done.

---

## Slice A — Known Spells (browse + cast + detail)

### Task A1 — Spell view types + pure entry mapper (TDD)
- Write `tests/spellsView.test.ts` over a `SpellcastingSheetDataLike` fixture (a prepared entry w/ cantrips + rank-1 slots, one expended; a spontaneous entry w/ uses; a focus entry). Assert `mapSpellcastingEntry` yields `{ id, name, kind: "prepared"|"spontaneous"|"innate"|"focus", tradition, attackMod, dc, ranks: [{ id, label, uses?: {value,max}, spells: [{ id, name, img, glyph, rank, castRank, expended, signature, atWill }] }] }`.
- Implement `types.ts` + `mapSpellcastingEntry`/`mapSpellsView` in `view.ts` (pure; drop `null` actives; map cantrips group id "cantrips"; focus uses ← `actor.system.resources.focus` injected via param).
- `npx vitest run tests/spellsView.test.ts` green. Commit.

### Task A2 — Async builder + `useSpells` hook
- `buildSpellsView(actor)`: `for (const entry of actor.spellcasting) await entry.getSheetData()` → `mapSpellsView(...)`, inject focus pool, split regular vs ritual (`entry.isRitual`). Glue, no unit test.
- `useSpells(actorId)`: builds on mount + on `createItem`/`deleteItem`/`updateItem`/`updateActor` (filtered to actor); `alive` guard; returns `null` while first building.
- `npm run typecheck && npm run build`. Commit.

### Task A3 — Guarded cast layer (TDD dispatch)
- `tests/spellCast.test.ts`: stub `game.actors.get` → actor with `spellcasting.get(entryId)` returning `{ cast }` spy + a spell; assert `castSpell` calls `entry.cast(spell, { rank, slotId })`, and that a rejected cast resolves (never throws). Mirror `tests/rolls.test.ts`.
- Implement `cast.ts` `castSpell(actorId, entryId, spellId, opts)` + `guard()`.
- Green. Commit.

### Task A4 — Spells sub-tab + Known section render
- `store.ts` add `"spells"`; `SubTabBar` add `{ id:"spells", label:"Spells" }`; `CharacterSheet` route → `<SpellsPanel actorId={actorId} />`.
- `SpellsPanel`: `useSpells`, a segmented control (Known/Rituals/Activations; local state, default Known), empty state for non-casters. Known section: each entry as `SpellEntryCard` (name, tradition, attack/DC), ranks with `uses` pill (slots/focus/∞), `SpellRow`s. Cast button per row (disabled when expended/0 uses & not at-will).
- `npm run typecheck && npm run build`. Commit.

### Task A5 — Spell detail popup
- `tests/spellDetail.test.ts`: `buildSpellDetail(spellLike)` → `{ name, rank, traits, traditions, castGlyph, components, range, area, targets, duration, defense (save), descriptionHtml, heightening }`. Assert extraction.
- `SpellDetailModal` (mirrors `DetailModal`: enrich description, Chip traits, meta grid). Wire `SpellRow` tap → detail; cast control stays separate.
- Green + typecheck/build. Commit.

---

## Slice B — Rituals + Activations

### Task B1 — Rituals section
- `buildSpellsView` already splits the ritual entry. Render a Rituals list (name, rank, glyph, Cast). `castRitual(actorId, spellId)` → ritual entry `.cast(spell)`. Reuse `SpellRow`/`SpellDetailModal`.
- typecheck/build (+ extend spellsView test for ritual mapping). Commit.

### Task B2 — Activations section
- `tests/spellsView.test.ts` (extend) or new: `mapActivations(items)` over consumables w/ embedded spells (scroll/wand) + staves → `{ id, name, img, spellName, glyph, uses?: {value,max} }`.
- Read `actor.itemTypes.consumable` (category scroll/wand/spell-gem with `system.spell`) + staff items; render rows; `consumeActivation(actorId, itemId)` → `consumable.consume()`.
- Green + typecheck/build. Commit.

---

## Slice C — Spellbook (prepare + fill known)

> Confirm exact `SpellCollection` method names against source before wiring (`src/module/item/spellcasting-entry/collection.ts`): expected `prepareSpell(spell, groupId, slotIndex)`, `unprepareSpell(groupId, slotIndex)`, `addSpell(spell, { groupId })`, plus item delete for removal, `setSlotExpendedState`.

### Task C1 — Spellbook view (TDD)
- `tests/spellbook.test.ts`: `buildSpellbookView(sheetData, entry)` → for prepared: per-rank slot array (slotIndex → prepared spell or empty) + the entry's known/spellbook list to choose from; for spontaneous: the repertoire (known spells) per rank + remaining "spells known" capacity. Assert structure.
- Implement in `view.ts`.
- Green. Commit.

### Task C2 — Spellbook mutations (TDD dispatch) + modal
- `tests/spellbook.test.ts` (extend): stub entry/collection; assert `prepareSpell`/`unprepareSpell`/`addKnownSpell`/`removeKnownSpell` call the right collection/item methods; guarded (never throw).
- `SpellbookModal`: prepared → tap a slot → pick from known list (`prepareSpell`); tap prepared slot → clear (`unprepareSpell`). Spontaneous → add/remove known. A "Spellbook" button in each `SpellEntryCard` header opens it for that entry.
- Green + typecheck/build. Commit.

### Task C3 — Polish + focus controls
- Focus pool: a small +/- (or "Refocus") control on focus entries → `setFocusPoints`/`refocus`. Cantrip/at-will rows always castable. Heighten: a rank selector on the cast control for spontaneous/known where `castRank` can exceed base (optional; include if time allows, else note).
- typecheck/build. Commit.

---

## Wrap (autonomous)
1. `npm run typecheck && npm run build && npm test` — all green.
2. **Browser test**: if a Foundry instance is reachable (localhost:30000), drive the mobile app via the browser plugin and sanity-check the Spells tab renders for Ezren, a cast posts to chat, detail popups open, spellbook opens. Record honestly what was/ wasn't verifiable.
3. Write `docs/reports/2026-06-12-spells-overnight-report.md` — what's done, test results (honest), known gaps, and a **manual test checklist** for the morning. Commit.
4. Update `pf2e-mobile-companion-plan.md` (Phase 3 spellcasting bullet) + memory. Commit.
5. Shut down the PC.

## Live-API assumptions (verify in play)
1. `entry.getSheetData()` async shape (`groups`/`active`/`uses`) — grounded `collection.ts`/`document.ts`; confirm at runtime.
2. `entry.cast(spell, { rank, slotId, consume, message })` posts the card — grounded `document.ts:258`.
3. Activations: `consumable.consume()` / `castEmbeddedSpell()` — grounded `consumable/document.ts:129`.
4. Spellbook: `collection.prepareSpell/unprepareSpell/addSpell` — confirm names before C2.
5. Focus: `actor.system.resources.focus {value,max}`, `actor.spellcasting.refocus()`.
