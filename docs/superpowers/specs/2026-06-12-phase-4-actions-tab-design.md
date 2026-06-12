# Phase 4 — Actions Tab (Strikes, Actions, Toggles) — Design

**Status:** Slice A (tab shell + **Strikes**) is implemented now; Slice B (the **Actions list** + the **Toggles** bar) is specced here and built after a Slice-A checkpoint. Live-API paths are grounded against the cloned PF2e source (`E:/React Projects/pf2e`) but still need in-play verification (see **Live-API assumptions**).

The bottom **Actions** tab (today a `Placeholder`) becomes a faithful mobile mirror of PF2e's character-sheet **Actions** tab. As in Phase 3, every roll routes through the **live PF2e system API** — strike attacks, damage, and crits post the system's own chat cards, so MAP, rule elements, degree of success, and homebrew all work without reimplementation. Results flow through the **existing Slice-1 chat feed** (Chat tab + own-result toast); no new chat infrastructure is built.

**Out of scope (deferred):** the common-actions row (Seek/Hide/Demoralize via `game.pf2e.actions`) and the Foundry hotbar macros bar — both deferred to a later follow-up slice (decided in brainstorming: "mirror only").

---

## Decisions (approved)

1. **The Actions tab mirrors PF2e's char-sheet Actions tab** — three pieces: **Strikes**, an **actions/activities list** (Encounter / Exploration / Downtime), and combat **Toggles** (Rage/Panache/stances). No hotbar macros, no common-actions row in this phase.
2. **Layout: pinned Toggles + segmented Strikes/Actions.** A pinned checkbox strip at the top shows the combat toggles (always visible, like the Spells panel's pinned Focus-Points bar). Below it a segmented control switches **Strikes / Actions**. Toggles are *not* a third segment.
3. **Strike buttons call the live strike object directly.** The Strikes UI calls `variants[i].roll(...)` / `.damage(...)` / `.critical(...)` on the live strike, which posts the real chat card. We do **not** reuse the chat-card interaction-interception path (`cardInteractions.ts`) — that exists for follow-up buttons on already-posted *spell* cards; strikes initiate all three rolls (attack/damage/crit) from the tab itself.
4. **Never hold live objects in React state.** The mapper extracts display data + a stable index; the guarded action functions re-read `actor.system.actions[index]` and call its methods — the same indirection `rolls.ts` uses for `actor.skills[slug]`, and what PF2e's own sheet does when resolving a strike from a DOM button.
5. **Suppress PF2e's roll/damage dialogs** the same proven way as the spell-damage fix: pass a synthetic event whose `shiftKey` matches the client's dialog setting, so `eventToRollParams` yields skip-dialog regardless of the setting (the stock dialog is a suppressed Application on mobile).
6. **Apply-damage stays deferred to Phase 7.** Strike/damage/crit cards post and render correctly; applying damage needs a selected canvas token, which mobile (canvas-off) lacks — unchanged from the Phase 3 spike outcome.

---

## Architecture & data flow

```
Actions tab (segmented: Strikes | Actions ; pinned Toggles strip)
   │
   ├─ Strikes ──────────────────────────────────────────────
   │   useStrikes(actorId)  → buildStrikesView(actor)  [pure, SYNC]
   │        reads actor.system.actions (already prepared)
   │        → StrikeView[]  { index, slug, label, ready, traits,
   │                          variants:[{label,penalty}], hasDamage, hasCritical }
   │   tap attack/damage/crit
   │        → src/foundry/actor/strikeActions.ts   [guarded, like rolls.ts]
   │             rollStrikeAttack / rollStrikeDamage / rollStrikeCritical
   │             re-reads actor.system.actions[index], calls
   │             .variants[v].roll({event}) / .damage({event}) / .critical({event})
   │                              │
   │                              ▼  PF2e creates a ChatMessagePF2e
   │                       createChatMessage hook  → existing chat feed (Slice 1)
   │                              │
   │                    ChatTab (full card) + ChatToast (own results)
   │
   ├─ Actions list (Slice B) ───────────────────────────────
   │   useActionsList(actorId) → buildActionsView(actor)  [pure, SYNC]
   │        actor.itemTypes.action + feats with actionCost,
   │        grouped Encounter / Exploration / Downtime
   │   tap Use → src/foundry/actor/actionUse.ts  useAction(actorId, itemId)
   │        → item.toMessage()  (+ frequency decrement)  → chat feed
   │
   └─ Toggles bar (Slice B) ────────────────────────────────
       useToggles(actorId) → buildTogglesView(actor)  [pure, SYNC]
            reads actor.synthetics.toggles
       tap checkbox → src/foundry/actor/toggles.ts  setToggle(...)
            → actor.toggleRollOption(domain, option, itemId, value)
```

- **The mapper is synchronous.** Unlike spells (which needed `await entry.getSheetData()`), `actor.system.actions` / `actor.itemTypes.*` / `actor.synthetics.toggles` are all prepared during the actor's synchronous data-prep. So the hooks mirror **`useActor`** (a `useMemo` invalidated by a version bump), not the async `useSpells`.
- **The store mirrors UI state only.** Actor/Item Documents stay the source of truth; the hooks re-prep on the relevant Foundry hooks (equipment, conditions/effects, and feat changes all re-prepare strikes and toggles).
- **Rolls are side effects.** A strike roll doesn't mutate the actor view; it produces a chat message. The actor view changes only when the underlying data does (e.g. an effect alters MAP labels).

---

## Slice plan

The spec covers the whole tab; we implement **Slice A**, checkpoint for live testing, then proceed.

| Slice | Scope | Entry point |
|---|---|---|
| **A (now)** | tab shell (pinned-toggles area + segmented Strikes/Actions) + **Strikes** (attack ×3 MAP, damage, crit) | `actor.system.actions` |
| **B** | **Actions list** (Encounter/Exploration/Downtime) + **Toggles** bar | `actor.itemTypes.action`/feats; `actor.synthetics.toggles` |

(The pinned Toggles strip is small but is scoped to Slice B to keep the Slice-A checkpoint focused on strikes — per the brainstorming default. In Slice A the strip area is absent/stubbed; the segmented control + Strikes are the testable unit.)

---

## Slice A — tab shell + Strikes (build now)

### Strikes data — `buildStrikesView(actor)` (pure, sync)

Read `actor.system.actions` (prepared array; grounded: `character/document.ts:623` `system.actions = this.prepareAttacks()`). Map each entry, **defensively** and **filtered to `type === "strike"`** (area/bomb attacks — `CharacterAreaAttack` — are out of scope for v1; entries lacking a `variants` array are skipped):

```ts
interface StrikeVariantView { label: string; penalty: number; } // label e.g. "+17", penalty 0/-5/-10
interface StrikeView {
  index: number;            // position in actor.system.actions — used to re-fetch the live strike
  slug: string;             // sanity-check on re-fetch + React key
  label: string;            // weapon/strike name
  img: string | null;       // weapon img for the row
  ready: boolean;           // equipped & usable → non-ready strikes render dimmed
  glyph: string | null;     // action cost (strikes are 1 action → "1")
  traits: string[];         // action + weapon traits, display-only
  variants: StrikeVariantView[]; // the 3 MAP options (labels straight from variant.label)
  hasDamage: boolean;       // strike.damage present
  hasCritical: boolean;     // strike.critical present
}
type StrikesView = StrikeView[];
```

Grounded fields (from `actor/data/base.ts:224-281`, `character/data.ts:402-409`): `slug`, `label`, `ready`, `traits`, `glyph`, `variants: [{ penalty, label, roll }]`, `damage?`, `critical?`, `item`. The mapper reads only the display fields; it does **not** retain `roll`/`damage`/`critical` (those are re-fetched by the action layer).

### Strike actions — `strikeActions.ts` (guarded, like `rolls.ts`)

All wrapped by the same `guard()` helper (a rejected roll surfaces a Foundry toast, never throws into React):

- `rollStrikeAttack(actorId, strikeIndex, variantIndex)` → `actor.system.actions[strikeIndex].variants[variantIndex].roll({ event })`
- `rollStrikeDamage(actorId, strikeIndex)` → `…[strikeIndex].damage({ event })`
- `rollStrikeCritical(actorId, strikeIndex)` → `…[strikeIndex].critical({ event })`

Where `event` is the dialog-suppressing synthetic event (see **Dialog suppression**). Each function re-reads the live strike by index and validates `slug`/shape before calling; a missing strike or method is a guarded no-op with a console error.

Grounded call sites (PF2e's own sheet): attack `base.ts:491-494` (`strike?.variants[variantIndex]?.roll({ event, altUsage })`); damage/crit `base.ts:498-514` (`strike?.[method]?.({ event })`).

### Dialog suppression

PF2e's check/damage modifier dialogs are Foundry Applications we suppress on mobile, so a roll that opens one would hang (the exact failure the spell-damage fix solved). Mirror that fix:

- **Attack:** `new PointerEvent("click", { shiftKey: game.user?.settings?.showCheckDialogs })`
- **Damage / Crit:** `new PointerEvent("click", { shiftKey: game.user?.settings?.showDamageDialogs })`

`eventToRollParams` then derives skip-dialog correctly whether or not the client has the dialog setting enabled (shift inverts the default). Flagged for in-play confirmation; if `variants[i].roll`/`damage` also accept an explicit `skipDialog`, that is a viable fallback.

### Strikes UI

- **`src/app/tabs/ActionsTab.tsx`** — replaces the `actions` Placeholder. Holds: a (Slice-B) pinned-toggles area, a segmented control (**Strikes** | **Actions**), and section routing. Default section **Strikes**. The **Actions** segment renders a "Coming next" note in Slice A.
- **`src/app/actions/StrikeCard.tsx`** — one strike card: img + name + a `ready` dot (dimmed when not ready); traits line; a row of three MAP attack buttons (labels = `variant.label`); a **Damage** and a **Crit** button (rendered only when `hasDamage`/`hasCritical`). Buttons follow the Tailwind-v4 button gotchas — solid `bg-*` fills (not `border`), `justify-start` where a flex button holds left-aligned content (see [[styling-gotchas]]).
- **`src/app/actions/useStrikes.ts`** — `useMemo` over `(actorId, version)`; `version` bumps on `updateActor` / `createItem` / `updateItem` / `deleteItem` filtered to this actor (mirrors `useActor`). Returns `StrikesView` or `null`. Re-prepping keeps MAP labels and `ready` live as effects/equipment change.

Empty state: an actor with no strikes (rare — unarmed is usually present) shows "No strikes."

---

## Slice B — Actions list + Toggles (sketch; finalised at the slice)

### Actions list

- **Data — `buildActionsView(actor)` (pure, sync):** iterate `actor.itemTypes.action` plus feats with an `actionCost` (grounded: `character/sheet.ts:#prepareAbilities 400-464`). Group: traits include `"exploration"` → Exploration; `"downtime"` → Downtime; otherwise Encounter, sub-bucketed by `actionCost.type` (action / reaction / free). Per item read `name`, `img`, action glyph (`actionCost.type` + value), `frequency` (`value`/`max`/`per`) if present.
- **Use — `actionUse.ts`:** `useAction(actorId, itemId)` → guarded `item.toMessage()` posting the action to chat, decrementing `system.frequency.value` first when limited (mirrors PF2e's `createUseActionMessage`, `chat-message/helpers.ts:18-46`). The internal helper isn't a stable public export, so we replicate its two relevant effects (frequency decrement + `toMessage`) ourselves.
- **UI:** the **Actions** segment — collapsible/section-headed groups (Encounter / Exploration / Downtime), each row: glyph + name + optional frequency pill + **Use** button. Tapping the name opens the existing `DetailModal` (Phase 2.1) for the rules text.

### Toggles bar

- **Data — `buildTogglesView(actor)` (pure, sync):** read `actor.synthetics.toggles` (Record<domain, Record<option, RollOptionToggle>>; grounded `rules/synthetics.ts:119-130`). Each toggle → `{ domain, option, itemId, label, checked, enabled, suboptions }`. (Optionally filter to `placement === "actions"` to match the sheet, TBD at the slice.)
- **Toggle — `toggles.ts`:** `setToggle(actorId, domain, option, itemId, value)` → guarded `actor.toggleRollOption(domain, option, itemId, value)` (grounded `actor/base.ts:946-966`). Suboptions deferred unless a table toggle needs them.
- **UI:** the pinned strip at the top of the tab — a wrapping row of checkboxes (label + checked state); disabled checkboxes for `enabled === false`. Per the styling gotchas, the "checkbox" visual uses a filled box / ring, not a bordered `<button>`.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/actor/strikes.ts` | pure `buildStrikesView(actor)` — display data + indices for the strike array |
| `src/foundry/actor/strikeActions.ts` | guarded `rollStrikeAttack` / `rollStrikeDamage` / `rollStrikeCritical` |
| `src/app/tabs/ActionsTab.tsx` | tab root: pinned-toggles area + segmented Strikes/Actions + routing |
| `src/app/actions/StrikeCard.tsx` | one strike card (attack ×3 MAP, damage, crit, ready, traits) |
| `src/app/actions/useStrikes.ts` | sync refresh hook (useMemo + version bump on actor/item hooks) |
| *(Slice B)* `src/foundry/actor/actions.ts` | pure `buildActionsView(actor)` — grouped actions/activities |
| *(Slice B)* `src/foundry/actor/actionUse.ts` | guarded `useAction(actorId, itemId)` — frequency decrement + `toMessage` |
| *(Slice B)* `src/foundry/actor/toggles.ts` | pure `buildTogglesView` + guarded `setToggle` |
| *(Slice B)* `src/app/actions/ActionsList.tsx`, `ToggleBar.tsx`, `useActionsTab.ts` | Actions-segment + pinned-toggles UI + their hook(s) |

**Edits**

- `src/app/TabContent.tsx` — route `actions` → `<ActionsTab />` (replacing the Placeholder).
- `src/foundry/actor/types.ts` — add `StrikeView` / `StrikeVariantView` / `StrikesView` (and, in Slice B, the actions/toggles view types).
- No change to `store.ts` (`"actions"` is already a `TabId`) and no change to the chat feed.

No new actor mutations from strikes — rolls are side effects producing chat messages. (Slice B's frequency decrement and toggle flip are the only writes, both via the live API.)

---

## Live-API assumptions (verify in play; correct any path on return)

1. **`actor.system.actions`** is the prepared strike array (`CharacterAttack[]`), available synchronously after data prep (grounded `character/document.ts:623`, `prepareAttacks` `:1016`). Confirm each strike exposes `slug`, `label`, `ready`, `traits`, `glyph`, and `variants: [{ penalty, label, roll }]`.
2. **`variants[i].roll(params)`** → `Promise<Rolled<CheckRoll> | null>`, accepting `{ event }` (grounded `data/base.ts:280`, sheet `base.ts:491-494`). Confirm a synthetic-event `shiftKey` skips the modifier dialog under both `showCheckDialogs` settings.
3. **`strike.damage(params)` / `strike.critical(params)`** → `DamageRollFunction` accepting `{ event }` (and possibly `skipDialog`) (grounded `data/base.ts:186,245-246`, impl `document.ts:1646-1714`, sheet `base.ts:498-514`).
4. **Strike index stability** — `actor.system.actions` order is deterministic per prep; equipment changes fire `updateItem` → fresh view + indices before any tap. `slug` is carried as a re-fetch sanity check. Confirm no duplicate-slug ambiguity for identical weapons.
5. **(Slice B)** actions grouping (`itemTypes.action` + feats w/ `actionCost`; trait-based Encounter/Exploration/Downtime) and `item.toMessage()` + `system.frequency` decrement (grounded `sheet.ts:400-464`, `chat-message/helpers.ts:18-46`).
6. **(Slice B)** `actor.synthetics.toggles` shape (`rules/synthetics.ts:119-130`) and `actor.toggleRollOption(domain, option, itemId, value)` (`actor/base.ts:946-966`).

---

## Testing

- **TDD the pure mapper** (Vitest), asserting the structural contract (stays green regardless of the live shape; live correctness is the user's verification pass):
  - `buildStrikesView` — variant `label`/`penalty` extraction, `ready` / `glyph` / traits mapping, the `type === "strike"` filter, index assignment, and graceful handling of a strike missing `variants` / `damage` / `critical`.
  - *(Slice B)* `buildActionsView` grouping predicate (Encounter/Exploration/Downtime) and `buildTogglesView` shape mapping.
- **Components + action wrappers** verified by `npm run typecheck` + `npm run build` (test the **production** build, not only `npm run dev` — see [[phase-3-progress]]) and a manual live checklist:
  - Strikes list renders with correct names/ready state; the three MAP buttons show the live `+N` labels.
  - Tapping each MAP button posts an attack card; the MAP penalty is reflected; result toasts + lands in Chat.
  - Damage and Crit post their cards; no dialog hangs under either `showCheckDialogs`/`showDamageDialogs` setting.
  - Equipping/unequipping a weapon updates the list and `ready` within ~1s; an effect that changes MAP updates the labels.
- The guarded functions in `strikeActions.ts` are thin glue over live objects — covered by the manual checklist, like `rolls.ts` / `cast.ts`.

**Homebrew check (per the plan's note):** verify the **Imaginary Weapon** here — if its RollOption/DamageDice rule elements and per-cast damage selector resolve through these strike buttons, the architecture is proven.

---

## Execution

Per [[execution-workflow]]: inline batched execution, **commit per task directly to `main`**, messages `Phase 4 (Task M): …` with the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer. Checkpoint after Slice A for a live Foundry test (log in as **Player1**, mobile-width viewport; **Ezren L1** owns the test caster — confirm a martial/strike-bearing actor is available, or use Ezren's unarmed/staff strike).
