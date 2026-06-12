# Chat-roll long-press menu — Design

**Status:** Specced, approved, ready to plan. A user-requested addition to the Chat feed: **long-press a chat roll → a bottom-sheet of the native PF2e message actions** (rerolls, Hero/Mythic Point, Delete). We never reimplement PF2e rules — we provide the mobile trigger + sheet and call PF2e's own `Check.rerollFromMessage` / `message.delete`. Live-API paths (PF2e v8.2 / Foundry v14) are grounded against the local clone (`E:/React Projects/pf2e`) and **spot-checked on the running Foundry** during implementation.

---

## The request

> Long-tap a chat roll (a 1d20 roll) → the options PF2e natively gives: delete, reroll using a hero point, and the other reroll options.

PF2e's right-click chat menu (`src/module/apps/sidebar/chat-log.ts` → `_getEntryContextOptions`) on a d20 check offers exactly the set below. We mirror it (full native parity) minus the token-dependent apply-damage variants and the GM-only "Show Roll Details" (see **Out of scope**).

---

## Decisions (approved)

1. **Full native parity** of the reroll/delete options; each entry shows only when PF2e would show it.
2. **Bottom-sheet popup**, reusing the existing `Modal` + `useLongPress` + `EffectActionsModal` pattern (long-press an effect chip → sheet of actions). This feature is that same shape for a chat message.
3. **Delete requires an in-sheet confirm tap** (mobile safety) — tapping Delete swaps the sheet to `Delete this message? [Delete] [Cancel]`. Reroll options stay one-tap.
4. **PF2e does the work.** We call `game.pf2e.Check.rerollFromMessage(...)` / `message.delete()`; we never reproduce reroll math, degree-of-success, or resource spending.

---

## Native options & their visible-gates (ground truth)

From `chat-log.ts:452-589`, with `message.isRerollable` defined at `chat-message/document.ts:94` as *owns the speaker actor, authored-or-owns the message, and `rolls[0] instanceof CheckRoll` that is itself rerollable* — i.e. exactly the "1d20 roll" the user means.

| Action (`kind`) | Shows when | Call | Icon / label key |
|---|---|---|---|
| `reroll-new` | `isRerollable` | `Check.rerollFromMessage(msg)` | `fa-dice` · `PF2E.RerollMenu.KeepNew` |
| `reroll-higher` | `isRerollable` | `…(msg, { keep: "higher" })` | `fa-dice-six` · `PF2E.RerollMenu.KeepHigher` |
| `reroll-lower` | `isRerollable` | `…(msg, { keep: "lower" })` | `fa-dice-one` · `PF2E.RerollMenu.KeepLower` |
| `hero-point` | `isRerollable` && character `heroPoints.value > 0` | `…(msg, { resource: "hero-points" })` | `fa-circle-h` · `PF2E.RerollMenu.HeroPoint` |
| `mythic-point` | `isRerollable` && `system.resources.mythicPoints.value > 0` | `…(msg, { resource: "mythic-points" })` | `fa-circle-m` · `PF2E.RerollMenu.MythicPoint` |
| `delete` | `isAuthor` ‖ `game.user.isGM` | `msg.delete()` | `fa-trash` · "Delete message" |

- **Familiar → master:** the resource gates resolve the rerolling actor as `actor.isOfType("familiar") ? actor.master : actor` before reading hero/mythic points (mirrors `chat-log.ts:469`, `439`).
- **Permission for reroll** is already inside `isRerollable` (and re-checked by `rerollFromMessage`, which toasts `PF2E.RerollMenu.ErrorCantDelete` if not author/GM). A player on their own character passes; the gate means they only ever see options they can actually run.
- **`game.pf2e.Check`** is the exposed global (`set-game-pf2e.ts:78` → `Check: Check`; declared `global.ts:189`).

On a non-check message the reroll family simply doesn't appear; if the player authored it, only **Delete** shows. If **no** action applies (someone else's non-rerollable message), the long-press opens nothing.

---

## Architecture & data flow

```
PF2e chat card  (mounted via renderHTML in ChatCard)
   │  user LONG-PRESSES anywhere on the card  (useLongPress, 500ms, scroll-cancels)
   ▼
ChatCard — useLongPress on the wrapper <div>  →  onLongPress(messageId)
   │
   ▼
ChatTab holds  actionsForId: string | null  →  renders one ChatMessageActionsModal
   │
   ├─ readMessageActionSource(messageId)                       [messageActionsRun.ts — live glue]
   │     reads live msg/game, resolves familiar→master
   │     → { isRerollable, canDelete, heroPoints, mythicPoints }
   ▼
   messageActions(source)                                      [messageActions.ts — PURE, unit-tested]
   │     → ChatMessageAction[]  ({ kind, label, icon })
   ▼
   ChatMessageActionsModal renders the buttons               [src/app/chat — mirrors EffectActionsModal]
   │     reroll/hero/mythic → one tap;  delete → in-sheet confirm
   ▼
   runMessageAction(messageId, kind)                          [messageActionsRun.ts — guarded]
         → Check.rerollFromMessage(...) | msg.delete()
                     │
                     ▼  PF2e posts the reroll result / removes the message
              create/deleteChatMessage hooks (already wired in useChatFeed)
                     ▼  the feed updates; the sheet closes
```

**Three layers, deliberately separated** (mirrors the project's split of pure logic vs. DOM glue vs. guarded live-API, exactly as the spell/strike chat actions do):

- **Pure mapper (`messageActions.ts`, unit-tested like `cardInteractions.ts`/`buildChatView`).** `messageActions(source) → ChatMessageAction[]`. `source` is a reduced structural snapshot, so the visible-gate truth-table is testable with no live Foundry. This is the logic worth locking down.
- **Live glue (`messageActionsRun.ts`, DOM/Foundry, no unit test like `render.ts`/`chatActions.ts`).** `readMessageActionSource(messageId)` builds the snapshot from the live document (incl. familiar→master); `runMessageAction(messageId, kind)` is the `guard()`-wrapped switch into PF2e's methods. A rejection surfaces via Foundry's toast and never throws into React.
- **Popup (`ChatMessageActionsModal.tsx`, React, reuses `parts/Modal.tsx` like `EffectActionsModal`).** Stateless over its action list except for a local `confirmingDelete` boolean.

**Wiring the imperative card to React state.** The card content is imperative PF2e DOM mounted inside `ChatCard`'s wrapper `<div>`. Pointer events bubble from that injected DOM up to the React wrapper, so `useLongPress` spread on the wrapper sees them. `ChatCard` gains an optional `onLongPress?(messageId)` prop; `ChatTab` owns `const [actionsForId, setActionsForId] = useState<string | null>(null)` alongside its existing `popup` state and renders the matching modal. (No new global store — local to the Chat tab, like the existing `popup`.)

**Coexistence with the existing tap interception.** `ChatCard` already runs a **capture-phase `click`** listener that intercepts the damage/save/effect/strike buttons (`cardInteractions.ts`). Long-press is a separate `pointerdown`-hold gesture:
- A short **tap** on a control → capture-click fires → existing damage/save popup (unchanged). `useLongPress`'s `onTap` is left unwired, so a tap on empty card area still does nothing.
- A **long-press** anywhere → the actions sheet. It opens during the hold and renders the full-screen `Modal` overlay (`z-[110000]`), so the eventual pointer-up/click lands on the backdrop, not a button underneath — no double-fire.
- A **scroll** (pointer moves > 10px) cancels the pending long-press (`useLongPress` move-threshold), so dragging the feed never triggers it.
- `useLongPress` already calls `preventDefault()` on `contextmenu`, suppressing the browser's native long-press menu.

---

## Components & data layer

**New files**

| File | Purpose | Tested |
|---|---|---|
| `src/foundry/chat/messageActions.ts` | `messageActions(source) → ChatMessageAction[]`; the `ChatMessageAction` / `ChatMessageActionSource` / `kind` types; label+icon table (labels via `loc()`) | ✅ unit |
| `src/foundry/chat/messageActionsRun.ts` | `readMessageActionSource(messageId)` (live snapshot, familiar→master) + `runMessageAction(messageId, kind)` (guarded reroll/delete) | live glue |
| `src/app/chat/ChatMessageActionsModal.tsx` | bottom-sheet listing the actions; reroll one-tap; Delete → in-sheet confirm | — |

**Edits**

- `src/app/chat/ChatCard.tsx` — add `onLongPress?(messageId)` prop; spread `useLongPress(() => onLongPress?.(summary.id))` on the wrapper `<div>`. (Imports the existing hook from `src/app/sheet/parts/useLongPress.ts` — generic, no need to move it.)
- `src/app/tabs/ChatTab.tsx` — hold `actionsForId` state; pass `onLongPress={setActionsForId}` to each `ChatCard`; render `<ChatMessageActionsModal messageId={actionsForId} onClose={…} />` when set.

No changes to `useChatFeed`/`render.ts`/`chatStore` — reroll results and deletions flow through the existing `createChatMessage` / `deleteChatMessage` hooks unchanged.

**Sheet layout & order.** Reroll family grouped first (Keep New, Keep Higher, Keep Lower), then the resource rerolls (Hero Point, Mythic Point) visually highlighted, then **Delete** last, separated and red (`bg-red-900/70`, like `EffectActionsModal`). Each button is `min-h-11` for touch. Title = the message flavor/title (from the `ChatView` summary already in `ChatTab`, so the sheet needs no extra read for its header).

---

## Live-API paths (grounded against the v8.2 clone; spot-check on the running Foundry)

Confirmed against the local PF2e **v8.2.0** clone with `file:line` refs; the running instance should match, but these only fully exist at runtime:

1. **`game.pf2e.Check.rerollFromMessage(message, options)`** — `check.ts:428`. `options`: `{ keep?: "higher"|"lower"; resource?: "hero-points"|"mythic-points" }` (`RerollOptions`, `check.ts:42`). Re-checks author/GM and toasts on failure — our gate prevents that path for the player's own messages.
2. **`message.isRerollable`** — `chat-message/document.ts:94`. The single source of truth for the reroll family's visibility; read it directly rather than reconstructing its sub-checks.
3. **`message.isAuthor`, `game.user.isGM`** — Delete gate.
4. **`message.actor` + familiar→master + `heroPoints.value` / `system.resources.mythicPoints.value`** — resource gates (`chat-log.ts:466-479`). `heroPoints` is a character getter; mythic is under `system.resources`.
5. **`message.delete()`** — Foundry document delete (the native menu's Delete comes from `super._getEntryContextOptions()`).
6. **`loc(key)`** (`src/foundry/i18n.ts`) — localize the `PF2E.RerollMenu.*` labels so the sheet reads identically to desktop; fall back to a plain-English string if a key is missing.

---

## Out of scope

- **Apply-damage variants** (full/half/double/triple/healing) — they require a **controlled canvas token** to receive the damage (`canvas.tokens.controlled`), the deferred Phase-7 path, and they appear on **damage** rolls, not the d20 checks this feature targets.
- **GM-only "Show Roll Details"** (`message.showDetails()`, GM + has context) — this is a player-focused companion; omitted to keep the sheet lean. (Trivial to add later behind the same `isGM` gate if wanted.)
- **Foundry's other native rows** (Copy ID, etc.) — low value on mobile.

---

## Testing

- **Unit (Vitest, plain objects — same style as `cardInteractions`/`buildChatView` tests):** `messageActions(source)` truth-table —
  - rerollable + author + hero 1 + mythic 0 → `[reroll-new, reroll-higher, reroll-lower, hero-point, delete]` (no mythic).
  - rerollable + hero 0 + mythic 2 → reroll family + `mythic-point` + `delete` (no hero).
  - **not** rerollable + author → `[delete]` only.
  - **not** rerollable + not author → `[]` (long-press opens nothing).
  - rerollable + GM + not author → reroll family + `delete` (Delete via GM).
  - Verify each descriptor carries the expected `icon` and a non-empty `label`.
- **Typecheck + build:** `npm run typecheck` && `npm run build` green.
- **Manual live checklist (Ezren, logged in as the owning Player1):**
  - [ ] Long-press a skill/save/attack **d20** roll you made → sheet shows Keep New/Higher/Lower + Hero Point (Ezren has a hero point) + Delete.
  - [ ] Tap **Hero Point** → PF2e rerolls, spends the point, posts the reroll result; sheet closes.
  - [ ] Tap **Keep Higher** / **Keep New** → reroll posts correctly.
  - [ ] **Mythic Point** absent when the character has none; present (and works) when they do.
  - [ ] Long-press → **Delete** → confirm step → message removed from the feed. Cancel returns to the list.
  - [ ] Long-press a **non-roll** message you authored → only **Delete** shows.
  - [ ] Long-press someone else's non-rerollable message → nothing opens.
  - [ ] Scrolling the feed by dragging on a card does **not** open the sheet; the native browser long-press menu never appears.
  - [ ] Tapping a card's damage/save button still opens the existing popup (long-press didn't break it).
```
