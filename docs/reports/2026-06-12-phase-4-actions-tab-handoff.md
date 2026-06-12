# Phase 4 — Actions Tab — Handoff (2026-06-12)

Handoff for resuming Phase 4 in a new session. Everything below is committed to `main`; working tree clean; `dist/` gitignored. **155 tests green, `tsc --noEmit` clean, production `vite build` clean.**

> **Update 2026-06-12 (latest): Phase 4 is now CODE-COMPLETE on `main`.** Slice **A.2b** (attack modifier toggle) + **Slice B** (Actions list + Toggles bar) are built, plus **two live-bug fixes** (chat-card Crit `55d3e9e`; the A.2b toggle now applies post-clone `73f11a6`). A single **live-verification pass** is pending — the checklist is **`docs/reports/2026-06-12-phase-4-test-report.md`** (start there). Slice B plan: `docs/superpowers/plans/2026-06-12-phase-4-slice-b-actions-toggles.md`.

---

## What Phase 4 is

The bottom **Actions** tab — a mobile mirror of PF2e's character-sheet Actions tab. Agreed scope: **mirror only** = **Strikes + Actions list + Toggles**. The common-actions row (Seek/Hide/Demoralize…) and the Foundry hotbar-macros bar were explicitly **deferred** out of Phase 4. Layout decision: a pinned **Toggles** checkbox strip + a segmented **Strikes / Actions** control (toggles pinned, *not* a third segment).

Rolls route through the **existing Slice-1 chat feed** (Chat tab + own-result toast). PF2e owns all rules math.

---

## Shipped & live-verified (on `main`)

### Slice A — strikes core (`7c7bf50`..`793e7e6`)
Segmented Strikes/Actions shell; strike cards with three MAP attack buttons + Damage + Crit. The **Actions** segment is a "coming next (Slice B)" placeholder.

### Slice A.2a — roll prompts, aux actions, chat-card damage (`cfb1212`..`ef7a85f`)
- **Roll prompts** replace instant rolls: tapping an attack opens `StrikeAttackModal` (read-only modifier breakdown + variant total + Roll); Damage/Crit open `StrikeDamageModal` (formula via `{getFormula:true}` + Roll).
- **Damage/Crit from the posted attack card** in the Chat tab now work (native buttons are dead on mobile): `cardInteractions` classifies `button[data-action="strike-damage"]` (+ `data-outcome`→crit); `strikeChatActions.rollAttackCardDamage` resolves the strike via `message._attack` (+ identifier fallback).
- **Auxiliary actions** (Draw / Sheathe / Change Grip …): a glyph-button row → `runAuxiliaryAction` → `aux.execute()`.

### Slice A.2c — ranged ammunition selector (`13f276a`..`6f934fc`)
- `<select>` of compatible ammo on ranged strike cards (none on melee/thrown). Selecting → `setStrikeAmmo` updates the weapon's `system.selectedAmmoId`. Attack buttons disabled (with hint) when unselected / 0 remaining. **Consumption is automatic** on the attack roll — the roll path is unchanged.

---

## Architecture (the strike subsystem)

Pattern throughout: **pure sync mappers** read the live actor into serializable view data + indices; **guarded action functions** re-read the live object by index and call its methods (never hold live objects in React state); **PF2e posts the real chat cards**.

| File | Role |
|---|---|
| `src/foundry/actor/strikes.ts` | pure `buildStrikesView(actor)` over `actor.system.actions` — `{index,slug,label,ready,glyph,traits,variants,auxiliaryActions,modifiers,ammo,hasDamage,hasCritical}` |
| `src/foundry/actor/strikeActions.ts` | guarded `rollStrikeAttack/Damage/Critical`, `runAuxiliaryAction`, `previewStrikeDamage`, `setStrikeAmmo` |
| `src/foundry/actor/strikeChatActions.ts` | `rollAttackCardDamage` / `previewAttackCardDamage` / `attackCardLabel` — resolve strike from a posted message |
| `src/foundry/chat/cardInteractions.ts` | pure click classifier (spell-damage/save/effect + **strike-damage**) |
| `src/app/actions/{StrikeCard,StrikeAttackModal,StrikeDamageModal,useStrikes}` | card + prompts + sync refresh hook |
| `src/app/tabs/ActionsTab.tsx` | tab shell; owns the active-prompt state; wires the action functions |
| `src/app/tabs/ChatTab.tsx` | opens `StrikeDamageModal` for `strike-damage` card taps |

**Types** in `src/foundry/actor/types.ts` (`StrikeView`, `StrikeVariantView`, `StrikeAuxView`, `StrikeModView`, `StrikeAmmoView`, and the `*Like` source shapes).

**Dialog suppression** (mobile suppresses PF2e's Applications): pass a synthetic `{ event: new PointerEvent("click", { shiftKey: game.user.settings.showCheckDialogs|showDamageDialogs }) }` so `eventToRollParams` skips the dialog under either setting.

---

## What's next (in order)

### ✅ Slice A.2b — attack modifier toggle — CODE-COMPLETE on `main` (live-verification PENDING)
`StrikeAttackModal` now renders a checkbox per modifier; unchecking re-previews the total via `previewStrikeAttack(actorId, strikeIndex, variantIndex, disabledSlugs)` and the disabled slugs ride along to `rollStrikeAttack(.., { disabledSlugs })`. Plan: `docs/superpowers/plans/2026-06-12-phase-4-slice-a2b-attack-modifier-toggle.md`. Commits `e9cab46`(plan)/`5c3d45a`(preview)/`3dbf027`(roll)/`69be1e8`(modal+tab).

**Mechanism — VERIFIED against the cloned PF2e source** (the spec's `helpers.ts:560-625` ref was stale; corrected): set `modifier.ignored = true` on the matching live modifiers (by `slug`) → `strike.calculateTotal()` (`applyStackingRules` forces ignored→`enabled=false`, `modifiers.ts:489-494, 606-618`); `variant.roll()` builds `new CheckModifier("strike", action, …)` (`character/document.ts:1559`) whose ctor clones `action.modifiers` **at roll time** (`modifiers.ts:650-658`; `Modifier.clone()` spreads `{...this}`, preserving `ignored`, `:278`) so the roll honors it; **restore `.ignored` in a `finally`** — transient/self-healing. Dialog precedent `system/check/dialog.ts:130-131`.

**⚠️ Live-verify before declaring done** (needs Foundry + a martial actor with a runed weapon, Player1 @ mobile width): uncheck a potency rune → shown **Attack total drops** → Roll → the posted card's bonus reflects the **lowered** total; reopen the strike → checkboxes **all checked again** (no lingering `ignored`), a normal roll uses the **full** bonus; the homebrew **Imaginary Weapon**'s rule-element modifiers toggle/roll too.

### ✅ Slice B — Actions list + Toggles bar — DONE (code-complete on `main`; live-verification pending)
Implemented per `docs/superpowers/plans/2026-06-12-phase-4-slice-b-actions-toggles.md` (`Phase 4 (Task 1..4)`). `buildActionsView` (`src/foundry/actor/actions.ts`) groups `actor.itemTypes.action` + feats w/ `actionCost` into Actions/Reactions/Free/Exploration/Downtime (mirrors `character/sheet.ts:400-464`); `useAction` (`actionUse.ts`) decrements `system.frequency.value` + `item.toMessage()`; `buildTogglesView`+`setToggle` (`toggles.ts`) flatten `actor.synthetics.toggles` (`placement==="actions"`) and flip via `actor.toggleRollOption(...)`. UI: pinned `ToggleBar` + `ActionsList` (Use + tap-name→`DetailModal`) in `ActionsTab`. Deferred: toggle suboptions, action selfEffect/crafting, kineticist blast de-dup, exploration active/other split. **Verify in the test report.**

### 2. Deferred backlog (not Phase 4 blockers)
- **Apply-damage to a target token** → Phase 7 (no canvas token on mobile).
- **Modular/versatile damage-type selectors** on strikes.
- **Repeating/magazine ranged weapons** — A.2c targets the common select-ammo path; the loaded-magazine model is unverified.
- **Common-actions row + hotbar macros** (dropped from Phase 4 scope by decision).
- **Learn new spells from the compendium** (Phase 3 deferral; see [[phase-3-progress]]).

---

## How to resume

1. Read this file + the memory index (`MEMORY.md` → `phase-4-progress.md`), then the two Phase 4 specs above.
2. PF2e API ground truth is cloned at `E:/React Projects/pf2e` — grep it for any path before relying on it (the system churns).
3. **Live test recipe:** `npm run dev`; log in as **Player1** (no password) in a mobile-width viewport; the caster Ezren (L1) exists, but for strikes/ammo use a martial / ranged actor (confirm one is in the test world). Test the **production build too** (`npm run build`) — the dev server has masked broken bundles before.
4. Workflow: brainstorm → spec → plan → implement, **commit per task to `main`** with `Phase N (Task M): …` subjects + the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer (see [[execution-workflow]]).

## Gotchas / lessons (this phase)
- **Tailwind v4 button reset** (`<button>` loses borders + centers content): use `bg-*`/`ring-*` fills and `justify-start`; `<select>`/non-buttons are unaffected. See [[styling-gotchas]].
- **Verify the test COUNT, not just "all green"** — a batched edit once wrote a source file but skipped its new test cases; only counting caught it.
- **Strikes take `{ event }` objects** (`variant.roll({event})`, `strike.damage({event})`), unlike spells' positional event.
