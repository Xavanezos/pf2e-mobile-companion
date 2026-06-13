# Phase 2 — Comprehensive Character Sheet (Design)

**Date:** 2026-06-11
**Status:** Implemented 2026-06-11 — see plan `docs/superpowers/plans/2026-06-11-phase-2-character-sheet.md`; enhancements in Phase 2.1 (`…-phase-2.1-character-sheet-enhancements-design.md`).
**Target:** Foundry VTT v14, PF2e system v8.2+, Chrome on Android
**Builds on:** Phase 1 mobile-takeover shell (`docs/superpowers/specs/2026-06-11-phase-1-mobile-takeover-shell-design.md`). Reuses the Foundry-adapter/React-app split, the Zustand UI-mirror store, `useFoundryHook`, Tailwind v4 (no preflight), Foundry's Font Awesome, and Vitest.

## Goal

Replace the Phase 1 `SheetTab` placeholder with a **comprehensive, live mirror** of the PF2e
*character* actor sheet, organized as **sub-tabs under a sticky vitals header** (layout B,
chosen during brainstorming). The sheet shows every field the real PF2e character sheet shows
and makes the **play-time** controls editable from the phone; **rolling is deferred to Phase 3**.

**Milestone:** the sheet is a live mirror of the actor — GM changes HP/conditions on desktop and
the phone updates instantly — and HP, conditions, hero/dying/wounded, the initiative statistic,
and equip/invest are editable from the phone.

## Decisions (locked during brainstorming)

| Topic | Decision |
|-------|----------|
| Layout | **Sub-tabs** (option B) under a **sticky vitals header**; sub-tab bar scrolls horizontally |
| Fidelity | **Comprehensive** — mirror the real PF2e character sheet's fields, not a minimal subset |
| Rolling | **Deferred to Phase 3.** Phase 2 *displays* rollable stats; tapping to roll is not wired |
| Edit scope | **Play-time edits only.** Build fields (level, XP, abilities, skill ranks, languages, add/remove feats & items) are **read-only** |
| Editable now | HP (value/temp), conditions, dying/wounded, hero points, **initiative statistic dropdown**, equip/invest/carry-type, shield HP |
| Spellcasting | Spell **display** deferred to Phase 3 (alongside casting) to keep the phase bounded |
| New deps | **None** — built on the existing React/Zustand/Tailwind/Vitest stack |

## Architecture

Extends the Phase 1 three-layer split with **one new adapter module** and **one new hook**:

- **`src/foundry/actor.ts`** (new) — the only code that reads a live `CharacterPF2e` and mutates
  it. Two halves:
  - **`buildCharacterView(actor): CharacterView`** — a **pure** mapper from the live actor's
    already-computed data into a plain, typed snapshot the UI renders. No Foundry types leak past
    it; unit-testable against a captured fixture.
  - **Mutation helpers** — thin async wrappers around the live actor/item APIs
    (`setHp`, `applyDamageTo`, `setTempHp`, `toggleCondition`, `adjustCondition`,
    `setInitiativeStatistic`, `setHeroPoints`, `setEquipped`, `toggleInvested`, `setShieldHp`).
    The only place in the app that calls `actor.update` / `item.update` / the conditions API.
- **`src/app/useActor.ts`** (new) — `useActor(actorId)` reads the actor, memoizes
  `buildCharacterView`, and subscribes (via `useFoundryHook`) to the document hooks **filtered to
  this actor**, bumping a version counter that re-reads the view. The live-mirror engine.
- **`src/app/store.ts`** — add `sheetSubTab` + `setSheetSubTab` (UI mirror only).
- **React components** stay **presentational**: given a `CharacterView` and mutation callbacks,
  they never reference `game`.

**Data flow:** `CharacterPF2e` (source of truth) → `buildCharacterView` → `CharacterView` →
panels render. User action → mutation helper → `actor.update(...)` → Foundry persists & fires
`updateActor`/`updateItem` → `useActor` re-reads → re-render. No optimistic local copy.

**Principle preserved (project plan):** read from the Document, mutate via `document.update()`;
the store/view *mirror*, hooks invalidate.

## Information architecture

### Sticky vitals header (visible across all sub-tabs)

```
[V] Valeros  L5 Human Fighter            ◆◆◇   ← portrait · name · ancestry+class · hero-point pips
HP ▓▓▓▓▓▓▓░ 58/72  +5 tmp        ☠0 ❤1          ← tap HP → numpad · dying/wounded pips
AC 24 · Per +12 · Spd 25                        ← compact reference strip
⚠ Frightened 1 · Clumsy 1                  [+]  ← active conditions (tap=adjust, [+]=add)
```

The conditions row and dying/wounded pips hide when empty.

### Sub-tabs (horizontally scrollable; Phase 3 appends Actions/Spells)

1. **Vitals** (default)
   - **Defenses:** AC; shield (AC bonus, HP value/max, hardness, broken/raise state, editable HP);
     Fortitude / Reflex / Will (modifier + rank); Perception (modifier + rank + senses);
     **Initiative** (total modifier + **statistic dropdown**). Shield shows AC bonus, HP
     value/max, hardness, broken/raised state (display); HP is editable. *Raising* a shield is
     a combat action (Phase 5), not a Phase 2 control.
   - **Speeds:** land + any of fly/swim/climb/burrow present.
   - **Class DC(s).**
   - **Defense traits:** immunities / resistances / weaknesses (each with value/exceptions), size.
   - **Abilities:** STR/DEX/CON/INT/WIS/CHA modifiers (key ability marked).
   - **Conditions & Effects:** full active-condition list with badges (value/locked), dying/wounded
     pips, active-effect badges. Add/remove/adjust here and from the header.
2. **Skills** — every skill + lore skills: label, total modifier, proficiency rank pip, armor-penalty
   marker. Display-only (roll in Phase 3).
3. **Items** — currency (cp/sp/gp/pp); items grouped by category (weapons, armor, equipment,
   consumables, treasure, containers); per-item name/qty/bulk/price/equip-state/invest; total bulk +
   encumbrance; container nesting (expand/collapse). Editable: carry-type, hands-held, invested.
4. **Feats** — ancestry / background / class / general / skill feats grouped by level, plus class
   features; name + action-cost glyph + traits. Read-only.
5. **Bio** — ancestry/heritage/background/class/deity, languages, size, martial proficiencies
   (weapon/armor training ranks, read-only), and biography text (read-only).

## Editable controls → write paths

| Control | Interaction | API (verified against `E:\React Projects\pf2e`) |
|---|---|---|
| HP current | numpad **Damage / Heal / Set** | Damage → `actor.applyDamage({ damage: n })`; Heal/Set → `actor.update({ "system.attributes.hp.value": n })` |
| Temp HP | numpad field | `actor.update({ "system.attributes.hp.temp": n })` |
| Conditions (toggle) | header `[+]` picker / chip remove | `actor.toggleCondition(slug)` |
| Conditions (valued) | chip +/- | `actor.increaseCondition(slug)` / `actor.decreaseCondition(slug)` |
| Dying / Wounded | pips +/- | `actor.increaseCondition("dying"\|"wounded")` / `decreaseCondition(...)` |
| Hero points | tap pips | `actor.update({ "system.resources.heroPoints.value": n })` |
| Initiative statistic | dropdown (Perception + each skill slug) | `actor.update({ "system.initiative.statistic": slug })` |
| Equip / carry-type / hands | item row menu | `item.update({ "system.equipped.carryType": t, "system.equipped.handsHeld": h })` |
| Invest | item row toggle | `item.update({ "system.equipped.invested": bool })` |
| Shield HP | numeric (when shield equipped) | `actor.update({ "system.attributes.shield.hp.value": n })` |

`applyDamage` (PF2e `src/module/actor/base.ts`) accepts `{ damage, token?, skipIWR?, final?, … }`
and respects temp HP + immunities/resistances/weaknesses; passing a plain number as `damage`
applies that much damage.

## CharacterView — read paths (verified)

`buildCharacterView` extracts (paths are the concrete strings confirmed in the PF2e data model):

| Group | Fields → path |
|---|---|
| Identity | `name`; `system.details.level.value`; `actor.ancestry/heritage/background/class/deity .name`; `system.traits.size.value`; `system.details.keyability.value`; `system.details.xp.{value,max}` |
| Hero pts | `system.resources.heroPoints.{value,max}` |
| HP | `system.attributes.hp.{value,temp,max}`; dying `system.attributes.dying.{value,max}`; wounded `system.attributes.wounded.value` |
| AC / shield | `system.attributes.ac.value`; `system.attributes.shield.{ac,hp.value,hp.max,hardness,broken,destroyed}` (+ `raised` if present, display-only) |
| Saves | `system.saves.{fortitude,reflex,will}.{value,rank}` |
| Perception | `system.perception.{value,rank}`; senses `system.perception.senses` |
| Initiative | `system.initiative.{totalModifier,statistic}`; options = `"perception"` + `Object.keys(actor.skills)` |
| Speeds | `system.movement.speeds.{land,fly,swim,climb,burrow}.value` |
| Class DC | `system.proficiencies.classDCs[slug].{value,rank,primary,label}` |
| Abilities | `system.abilities.{str,dex,con,int,wis,cha}.mod` |
| Traits | `system.attributes.{immunities,resistances,weaknesses}` (arrays of `{type,label,value?}`) |
| Languages | `system.details.languages.value` |
| Skills | `actor.skills[slug]` → `{ slug,label,mod,rank,armor,lore }` |
| Inventory | `actor.inventory` items → `{ name,img,quantity,bulk,price,category,equipped.carryType,equipped.handsHeld,equipped.invested,isContainer,containerId }`; `actor.inventory.currency` (cp/sp/gp/pp); `actor.inventory.totalBulk`; `system.attributes.bulkLimit`; `actor.attributes.encumbered` |
| Conditions | `actor.conditions.active` → `{ slug,name,value,img,badge,isLocked }` |
| Effects | `actor.itemTypes.effect` → `{ name,img,badge }` |
| Feats | `actor.feats` groups + `actor.itemTypes.feat`; class features → `{ name,img,actionCost,traits,level }` |
| Proficiencies | `system.proficiencies.{attacks,defenses}[key].{label,rank}` (read-only, Bio tab) |

Optional groups absent on a given actor (no shield, no resistances, etc.) are omitted from the view
so panels render nothing for them.

## Live updates

`useActor(actorId)` registers, filtered to the active actor, on:

- `updateActor` — HP, temp, hero points, dying/wounded, initiative statistic, AC, etc.
- `createItem` / `updateItem` / `deleteItem` — inventory changes **and conditions/effects** (both
  are embedded items in PF2e).

Each relevant fire bumps a version counter; the view is recomputed via `useMemo`. Filtering: compare
the hook's document `actor.id` / `parent.id` to the active `actorId` and ignore others. (Debouncing
is a Phase 8 concern; Phase 2 re-reads per event — cheap because the actor's derived data is already
computed by the system.)

## Error handling & edges

- **Absent sections** render nothing (no shield → no shield row; no conditions → no conditions row).
- **Actor deleted / ownership lost** while viewing: a `deleteActor` (and `updateActor` ownership)
  guard clears `actorId` → `SheetTab` returns to the picker/empty state.
- **Mutation failures** (permission/validation): the server enforces; we only render controls the
  player can use, wrap helper calls in `try/catch`, and let Foundry's native error toast surface the
  reason. No optimistic local state — the refresh comes from the document hook.
- **Numpad pending state**: disable the confirm button while the async update is in flight.

## Styling

Reuse Phase 1 conventions verbatim: Tailwind v4 utilities only (no preflight), dark theme tokens,
≥44px touch targets, Foundry's bundled Font Awesome (`<i className="fas …">`), `env(safe-area-inset-*)`
padding. The sticky header uses `position: sticky; top: 0` within the scroll container. No new
stylesheet — utilities are generated from class usage as in Phase 1.

## Testing

- **Vitest (pure, node env):**
  - `buildCharacterView` against a **captured fixture** — export one test PC's actor data to
    `tests/fixtures/character.json` (via `game.actors.getName("…").toObject()` in the desktop
    console) and assert the mapped view (HP, saves, skills count, conditions, inventory grouping,
    feat grouping, omitted-section behavior).
  - HP delta math (damage/heal/set + temp-HP interaction at the helper-input level).
  - Bulk/encumbrance formatting; condition-badge formatting; feat-grouping logic; initiative-options
    derivation (`"perception"` + skill slugs).
- **Manual checklist:**
  1. GM changes HP on desktop → phone updates live.
  2. Numpad Damage respects temp HP and resistances (verify via a resistant test actor).
  3. Condition add (picker) / remove / value +/-; dying & wounded pips.
  4. Initiative-statistic dropdown persists and updates the total.
  5. Equip/unequip + invest toggle on an item.
  6. Sticky header stays put while the panel scrolls; sub-tab bar scrolls horizontally.
  7. A character with no shield/spells/resistances renders cleanly (no empty headers).
  8. Desktop GM client visually unchanged throughout.

## Proposed file layout

```
src/
  foundry/
    actor.ts                 # buildCharacterView() [pure] + mutation helpers
  app/
    useActor.ts              # live-mirror hook (view + version counter)
    store.ts                 # + sheetSubTab / setSheetSubTab
    SheetTab.tsx             # resolves actor (unchanged) → renders CharacterSheet
    sheet/
      CharacterSheet.tsx     # header + sub-tab bar + active panel
      VitalsHeader.tsx       # sticky header (HP, hero/dying/wounded, conditions, AC/Per/Spd)
      SubTabBar.tsx          # scrollable sub-tab selector
      VitalsPanel.tsx        # defenses, speeds, class DC, traits, abilities, conditions & effects
      SkillsPanel.tsx
      ItemsPanel.tsx
      FeatsPanel.tsx
      BioPanel.tsx
      HpNumpad.tsx           # modal: Damage / Heal / Set + temp HP
      ConditionPicker.tsx    # modal: add condition
      CarryTypeMenu.tsx      # modal: equip carry-type / hands
      parts/                 # StatRow, RankPip, Chip, ActionGlyph, Pips
tests/
  fixtures/character.json    # captured test PC
  characterView.test.ts
  hpMath.test.ts
  characterView.grouping.test.ts
```

## Out of scope (later phases)

Rolling — skill/save/perception checks, strikes, **spell display + casting** (Phase 3); the
initiative **roll** and combat tracker (Phase 5); action-bar/macros (Phase 4); journals (Phase 6);
battle map (Phase 7); module neutralization (Phase 8b). Build edits (level/XP/abilities/skill
ranks/languages, adding feats/items), the crafting and Pathfinder-Society tabs, and biography
*editing* are out of scope for Phase 2.
