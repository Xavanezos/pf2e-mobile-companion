# Phase 4 — Strike Interactions (roll prompts, auxiliary actions, chat-card damage) — Design

**Status:** Follow-up to Phase 4 Slice A (strikes), driven by the live checkpoint. Two slices: **A.2a** (auxiliary actions + chat-card damage + roll prompts, low-risk, mirrors proven patterns) built first → checkpoint → **A.2b** (the attack modifier-toggle, PF2e-internal, higher-risk). Live-API paths grounded against the cloned PF2e source (`E:/React Projects/pf2e`); the toggle path especially needs in-play verification (see **Live-API assumptions**).

Three pieces of live-test feedback, one unifying idea: on mobile the canvas-bound and dialog-bound paths don't work, so strike rolls currently fire instantly and the attack card's Damage/Crit buttons are dead. We replace both with **our own roll-prompt popups** — the same approach already proven for checks (`BreakdownModal` → Roll) and spells (`DamageRollModal`, card interception). PF2e still owns all the math.

---

## Decisions (approved)

1. **Roll prompts, not instant rolls.** Tapping a strike attack / damage / crit on the Actions tab opens a prompt that shows the math, with a Roll button — mirroring PF2e's CheckModifiers/Damage dialogs, in our module style. The roll itself still skips PF2e's (suppressed) dialog, so nothing double-pops.
2. **Attack prompt = modifier breakdown with toggles.** It lists the strike's modifiers; each can be **unchecked to disable it** (e.g. turn off a potency rune), and the total recomputes using PF2e's own stacking. Damage/crit prompts stay simple (formula preview + Roll); no toggles there for now.
3. **Damage/Crit work from the attack chat card.** Tapping Damage/Crit on a posted attack card opens the damage prompt and rolls — same capture-phase interception we use for spell cards (the native handlers are dead on mobile).
4. **Auxiliary actions on the strike card.** Draw / Sheathe / Change Grip / Retrieve / Pick Up etc. render as a small glyph-button row and run through the live API; they mutate equip state, so the existing hook refreshes the card.
5. **Sequenced into two slices** (A.2a low-risk → checkpoint → A.2b attack toggle). The attack prompt ships **read-only** in A.2a; the per-modifier toggle is layered on in A.2b.
6. **Apply-damage to a target stays deferred to Phase 7** (no canvas token on mobile) — unchanged.

---

## Architecture & data flow

```
Actions tab → StrikeCard (presentational)
   buttons call up to ActionsTab, which owns the "active prompt" state
        │
        ├─ attack(variantIndex) → StrikeAttackModal ─────────────┐
        ├─ damage / crit        → StrikeDamageModal ─────────┐    │
        └─ aux(auxIndex)        → runAuxiliaryAction (no modal)    │
                                                              │    │
Chat tab → ChatCard capture-phase click on the attack card    │    │
   button[data-action="strike-damage"] (data-outcome→crit)    │    │
        → CardInteraction {kind:"strike-damage",msgId,critical}│    │
        → StrikeDamageModal ──────────────────────────────────┘    │
                                                                    │
   StrikeDamageModal(loadFormula, onRoll)        StrikeAttackModal(strike, variantIndex)
        loadFormula via {getFormula:true}             rows from strike.modifiers (+ checkboxes in A.2b)
        onRoll → guarded roll                         Roll → rollStrikeAttack(..,{disabledSlugs})
                          │                                          │
                          ▼                                          ▼
   src/foundry/actor/strikeActions.ts        +  src/foundry/actor/strikeChatActions.ts
     rollStrikeDamage / rollStrikeCritical        rollAttackCardDamage(msgId,{critical})
     rollStrikeAttack(.., {disabledSlugs})         previewAttackCardDamage(msgId,{critical})
     runAuxiliaryAction / previewStrike*           (resolve strike via message._attack)
                          │
                          ▼  PF2e posts the real card → existing chat feed (Chat tab + toast)
```

All live calls are wrapped by the existing `guard()` contract (a rejected call surfaces a Foundry toast, never throws into React). The view continues to carry display data + indices only; the action layer re-reads the live strike (`actor.system.actions[index]`) — we never hold a live strike in React state.

---

## Slice A.2a — aux actions, chat-card damage, roll prompts (build now)

### ① Auxiliary actions

- **Mapper (`strikes.ts`):** add `auxiliaryActions: { label: string; glyph: string }[]` to `StrikeView`, mapped from `strike.auxiliaryActions` (grounded: `character/data.ts:395`, class `character/auxiliary.ts:51`, populated `character/helpers.ts:212`). Map each `{ label, glyph }`; the glyph is defensive (known glyph code → our `ActionGlyph`, else show the raw text). Array order is the `auxIndex` used to run it.
- **Action (`strikeActions.ts`):** `runAuxiliaryAction(actorId, strikeIndex, auxIndex)` → guarded `actor.system.actions[strikeIndex].auxiliaryActions[auxIndex].execute()` (signature `execute({ selection?: string | null })`, `auxiliary.ts:151`). The rare "modular" `selection` (damage-type swap) is **deferred** — we call `execute()` with no selection.
- **UI (`StrikeCard.tsx`):** a wrapping row of small buttons (label + glyph) below the attack row, when `auxiliaryActions.length > 0`. Tapping runs the action; the resulting item update fires `updateItem` → `useStrikes` re-preps → the `ready` dot and available aux actions refresh.

### ② Damage/Crit from the attack chat card

- **Interception (`chat/cardInteractions.ts`):** extend `CONTROL_SELECTOR` to also match `button[data-action="strike-damage"]` (grounded: chat listener `chat-message/listeners/cards.ts:72-76`; the card uses `data-outcome` — `"success"` → damage, else critical). Add a `CardInteraction` variant `{ kind: "strike-damage"; messageId: string; critical: boolean }`; `interactionFromControl` reads `data-action` + `data-outcome`. The pure classifier stays unit-testable.
- **Live calls (`foundry/actor/strikeChatActions.ts`, new — mirrors `spells/chatActions.ts`):**
  - `rollAttackCardDamage(messageId, { critical })` — resolve the strike via `message._attack` (PF2e's own resolver, `chat-message/document.ts:142`); fall back to manual identifier resolution (`actor.system.actions.find(s => s.slug === slug && s.item.id === itemId)` from the roll/context `identifier`) if `_attack` is absent. Then call `strike.critical(event)` / `strike.damage(event)` with the dialog-suppressing `{ event }` (same `showDamageDialogs` mirror as `strikeActions`).
  - `previewAttackCardDamage(messageId, { critical })` → `strike[method]({ getFormula: true })` returns the formula string without rolling (grounded: `character/document.ts:1708-1710`).
- **UI:** `ChatTab` handles the new interaction by opening `StrikeDamageModal` (see below), wired exactly like the existing spell `DamageRollModal`.

### ③ Roll prompts (Actions tab)

- **`ActionsTab`** owns an `activePrompt` state (`{ strikeIndex, kind: "attack" | "damage" | "crit", variantIndex? }`). `StrikeCard` stays presentational: its attack buttons call `onAttack(variantIndex)`, Damage/Crit call `onDamage()`/`onCritical()`, which now **open the prompt** instead of rolling.
- **`StrikeDamageModal` (source-agnostic, shared by tab + chat):** props `{ title, loadFormula: () => Promise<string | null>, onRoll: () => void, onClose }`. Loads the formula on mount (async), shows it + a Roll button (mirrors `DamageRollModal`). The tab passes `loadFormula = previewStrikeDamage(actorId, idx, crit)` + `onRoll = rollStrikeDamage/Critical(...)`; the chat passes the `previewAttackCardDamage` / `rollAttackCardDamage` pair.
- **`StrikeAttackModal` (read-only in A.2a):** shows the strike name, a row per modifier (`label` + signed `value`) from the new `StrikeView.modifiers`, a Multiple-Attack-Penalty row when the variant penalty ≠ 0, the variant total (from `variant.label`), and a Roll button → `rollStrikeAttack(actorId, strikeIndex, variantIndex)`. (Checkboxes arrive in A.2b.)
- **Mapper additions (`strikes.ts`):** add `modifiers: { slug: string; label: string; value: number; enabled: boolean }[]` to `StrikeView`, from `strike.modifiers` filtered to `enabled || !hideIfDisabled` (so disabled-and-hidden modifiers stay hidden), mapping `{ slug, label, value: m.modifier, enabled }`. Add `previewStrikeDamage(actorId, strikeIndex, critical)` to `strikeActions.ts` (→ `strike[method]({ getFormula: true })`).

---

## Slice A.2b — attack modifier-toggle (after checkpoint)

Make the `StrikeAttackModal` modifiers togglable, mirroring PF2e's `CheckModifiersDialog`.

- **Toggle mechanism (grounded; verify live):** PF2e suppresses a modifier by setting `modifier.ignored = true` then recomputing (`StatisticModifier.calculateTotal()` → `applyStackingRules`, which forces `enabled = false` for ignored ones; `modifiers.ts:129, 491-493, 605-618`). The strike's `variant.roll()` builds a `CheckModifier` that **clones the strike's modifiers at roll time** (`character/helpers.ts:560-625`), so flipping `.ignored` on the live strike *before* rolling is honored. PF2e's own dialog does exactly this (`system/check/dialog.ts:127-134`).
- **Live preview (`strikeActions.ts`):** `previewStrikeAttack(actorId, strikeIndex, variantIndex, disabledSlugs)` → re-reads the live strike, **transiently** sets `.ignored` on modifiers whose `slug ∈ disabledSlugs`, calls `calculateTotal()`, reads back `{ total: strike.totalModifier + variant.penalty, parts: [{ slug, label, value, enabled }] }`, then **restores** the prior `.ignored` values and recomputes — all synchronous, so the live strike is never left mutated. The modal calls this on every checkbox change.
- **Roll (`strikeActions.ts`):** extend `rollStrikeAttack(actorId, strikeIndex, variantIndex, opts?: { disabledSlugs?: string[] })`: inside `guard`, set `.ignored = true` on matching live modifiers, `calculateTotal()`, `await variant.roll({ event })`, then **restore in a `finally`** (`.ignored = false` on the ones we touched, `calculateTotal()`). Transient and self-healing even on error.
- **UI:** each modifier row gets a checkbox (checked = not user-disabled). Unchecking calls `previewStrikeAttack` and updates the rows + total; disabled-by-stacking rows render greyed. Roll passes the `disabledSlugs`.
- **Identity caveat:** modifiers are matched by `slug`; if two share a slug both toggle together (acceptable). The mutation is transient and reset by the next data-prep regardless.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/actor/strikeChatActions.ts` | `rollAttackCardDamage` / `previewAttackCardDamage` — resolve strike from a chat message via `message._attack` (+ fallback) |
| `src/app/actions/StrikeDamageModal.tsx` | source-agnostic damage prompt (`loadFormula` + `onRoll`); used by the tab and the chat card |
| `src/app/actions/StrikeAttackModal.tsx` | attack prompt — modifier rows (+ checkboxes in A.2b) + total + Roll |

**Edits**

- `src/foundry/actor/types.ts` — `StrikeView` gains `auxiliaryActions` + `modifiers`; add the source shapes (`AuxiliaryActionLike`, `ModifierLike`-style for `strike.modifiers`).
- `src/foundry/actor/strikes.ts` — map `auxiliaryActions` + `modifiers`.
- `src/foundry/actor/strikeActions.ts` — add `runAuxiliaryAction`, `previewStrikeDamage`; (A.2b) `previewStrikeAttack` + `disabledSlugs` on `rollStrikeAttack`.
- `src/foundry/chat/cardInteractions.ts` — `strike-damage` selector + `{kind:"strike-damage"}` interaction (pure, tested).
- `src/app/actions/StrikeCard.tsx` — aux-action row; attack/damage/crit buttons open prompts (via `onAttack`/`onDamage`/`onCritical`/`onAux` callbacks) instead of rolling.
- `src/app/tabs/ActionsTab.tsx` — own the `activePrompt` state; render `StrikeAttackModal`/`StrikeDamageModal`; pass `runAuxiliaryAction`.
- `src/app/tabs/ChatTab.tsx` — handle `{kind:"strike-damage"}` → `StrikeDamageModal`.

No store changes. Apply-damage remains deferred.

---

## Live-API assumptions (verify in play; correct any path on return)

1. **`strike.auxiliaryActions[i]`** exposes `label`, `glyph`, and `execute({ selection? })` (`character/auxiliary.ts:51,151`; `data.ts:395`). Confirm the array is present on prepared strikes and that `execute()` with no args performs draw/sheathe/grip.
2. **Attack card damage button** is `button[data-action="strike-damage"]` with `data-outcome` (`"success"` vs `"criticalSuccess"`) (`chat-message/listeners/cards.ts:72-76`). Confirm the markup on our rendered cards.
3. **`message._attack`** resolves the posted attack to the strike (`chat-message/document.ts:142`). Confirm it's reachable from our message objects; otherwise use the manual `identifier`-split fallback.
4. **`strike.damage/critical({ getFormula: true })`** returns a formula string without rolling (`character/document.ts:1708-1710`).
5. **Modifier toggle (A.2b):** `modifier.ignored` + `strike.calculateTotal()` excludes a modifier, and `variant.roll()` (which clones modifiers at roll time) honors it (`modifiers.ts:129,605-618`; `helpers.ts:560-625`). **This is the highest-risk assumption — verify the disabled modifier actually drops from the rolled total before relying on it.** Also confirm `strike.modifiers` carries stable `slug`s and the `calculateTotal` method is present on the live strike.

---

## Testing

- **Pure logic (Vitest):**
  - `interactionFromControl` — the new `strike-damage` case: `data-outcome="success"` → `{critical:false}`, `"criticalSuccess"` → `{critical:true}`; non-strike controls unaffected.
  - `buildStrikesView` — new `auxiliaryActions` + `modifiers` mapping (label/glyph; `enabled`/`hideIfDisabled` filter; slug/value).
- **Guarded action wrappers** (`strikeChatActions`, the new `strikeActions` functions) — stub-based tests like `spellChatActions`/`strikeActions`: assert the right method is called with the dialog-suppressing event; `getFormula` preview path; the `disabledSlugs` apply-then-restore leaves `.ignored` unchanged after the call (assert restore). Never-throws on missing message/strike/method.
- **Components** verified by `npm run typecheck` + `npm run build` (production bundle — see [[phase-3-progress]]) + manual live checklist.
- **Manual checklist (the two checkpoints):**
  - A.2a: aux actions draw/sheathe/grip and the card updates; attack prompt shows the breakdown + Roll; Damage/Crit prompt from the tab and from the chat attack card both roll; no dialog hangs.
  - A.2b: unchecking the potency rune (or another modifier) lowers the shown total **and** the rolled attack bonus; re-checking restores it; the strike's normal rolls are unaffected afterward (no lingering `ignored`).
  - **Homebrew (Imaginary Weapon):** its rule-element modifiers appear in the attack breakdown and toggle/roll correctly.

---

## Execution

Per [[execution-workflow]]: inline batched execution, **commit per task to `main`**, `Phase 4 (Task M): …` subjects with the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer. Checkpoint after A.2a for a live test before building the A.2b toggle. See [[phase-4-progress]], [[styling-gotchas]].
