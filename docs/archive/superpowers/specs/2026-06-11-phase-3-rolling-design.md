# Phase 3 — Rolling: Checks, Strikes, Spells — Design

**Status:** Slice 1 (rolling infra + checks + chat feed) is implemented now; Slices 2 (strikes) and 3 (spells) are specced here and built after a Slice-1 checkpoint. Live-API paths are grounded against the cloned PF2e source (`E:/React Projects/pf2e` — `src/module/system/statistic/statistic.ts`, `src/module/chat-message/document.ts`) but still need in-play verification (see **Live-API assumptions**).

This is the heart of the project. Every roll routes through the **live PF2e system API**, so rule elements, MAP, degree of success, and homebrew (e.g. the Imaginary Weapon) all work without reimplementation. We never reproduce PF2e math — we call its statistics and render its chat output.

---

## Decisions (approved)

1. **Chat output = real PF2e HTML**, not a custom renderer. PF2e emits results as chat messages; we render `message.renderHTML()` and inherit degree-of-success styling and (pending the spike) the damage-apply buttons. A custom renderer would mean reimplementing degree of success, damage, and crit — rejected for v1.
2. **Chat is a 6th bottom-bar tab** — `Sheet · Actions · Combat · Chat · Journal · Map`. The Chat tab is the full scrollable history; a cross-tab **auto-toast** peeks your own results over whatever tab you're on and, tapped, jumps to the Chat tab.
3. **Tap a stat → breakdown popup → Roll button** (the `onRoll` seam from Phase 2.1). Shows the math first; one extra tap, no fat-finger rolls. Not tap-to-instant-roll.
4. **Skip PF2e's modifier dialog for v1** (`roll({ skipDialog: true })`). The stock Foundry dialog is an Application we suppress on mobile, and the breakdown popup already shows the modifiers. In-dialog circumstance bonuses / fortune are a later enhancement.

---

## Architecture & data flow

```
tap stat → BreakdownModal (Roll button)
   │
   ▼
src/foundry/actor/rolls.ts          [guarded, like mutations.ts]
   rollSkill / rollSave / rollPerception
   → actor.skills[slug].roll({ skipDialog: true })     [live Statistic.roll]
                              │
                              ▼  PF2e creates a ChatMessagePF2e
                       createChatMessage hook  (game-global)
                              │
        ┌─────────────────────┴───────────────────────┐
        ▼                                              ▼
  buildChatView(msg)  (pure: summary for toast)   message.renderHTML() → HTMLElement
        │                                              │ (full card, async)
        ▼                                              ▼
  chatStore (Zustand, cap ~50, seeded from game.messages on mount)
        │
        ├─ ChatToast  — auto-shows YOUR results above the tab bar; tap → Chat tab
        └─ ChatTab    — full history; renders the live HTMLElement via a ref
```

- **Rolls** go through a new `src/foundry/actor/rolls.ts`, wrapped by the same `guard()` helper as `mutations.ts` — a rejected roll surfaces as a Foundry toast and never throws into React.
- **The feed hook lives in `Shell`** so messages collect regardless of the active tab. The store mirrors UI state only; `ChatMessage`/`Actor` Documents stay the source of truth.
- **Two render paths, deliberately different:**
  - *Toast & list metadata* use a pure `buildChatView(msg)` that extracts `{ id, speaker, flavorText, outcome, isRoll, authoredBySelf }` from message data — testable, no DOM.
  - *Full card* uses `message.renderHTML()` (async → real `HTMLElement`) inserted into a container `ref`; this is what makes interactive buttons possible. (Contrast Phase 2.1's `DetailModal`, which renders a static description *string* via `dangerouslySetInnerHTML` — fine for prose, wrong for interactive cards.)

---

## Slice plan

The spec covers all three slices; we implement **Slice 1**, checkpoint for live testing, then proceed.

| Slice | Scope | Entry point |
|---|---|---|
| **1 (now)** | rolling infra + **checks** (skill/save/perception) + **chat feed** (tab + toast) | `Statistic.roll`, `createChatMessage` |
| **2** | **strikes** — cards with 3 MAP buttons + damage + crit | `actor.system.actions` |
| **3** | **spells** — entries → ranks → slots, focus points, cast | `actor.spellcasting` |

---

## Slice 1 — checks + chat feed (build now)

### Checks

- **Interaction:** tapping a skill / save / perception opens the existing `BreakdownModal`, which now receives an `onRoll` callback → a **Roll** button. Tapping Roll fires the live statistic roll and closes the modal; the result arrives through the chat feed.
- **Always tappable:** today a `StatRow`'s `onClick` is set only when a `breakdown` exists. Change so every *rollable* stat opens the modal even with no breakdown (the modal already renders "No breakdown available." + Total gracefully). Rollability is a new view flag (`rollable`/`rollKey`) so non-rollable rows (lineage, speed) stay inert.
- **Roll calls** (`rolls.ts`, all guarded):
  - `rollSkill(actorId, slug)` → `actor.skills[slug].roll({ skipDialog: true })`
  - `rollSave(actorId, slug)` → `actor.saves[slug].roll({ skipDialog: true })`
  - `rollPerception(actorId)` → `actor.perception.roll({ skipDialog: true })`
- **Header chips** (AC/Perception in `VitalsHeader`) stay quick-reference for now; rolling is driven from the Vitals/Skills panels. (Initiative rolling is deferred to Phase 5 combat; the statistic selector stays as-is.)
- **AC and class DC stay display-only** — they're defenses/DCs, not checks you roll. Their breakdown popups get no Roll button (no `rollKey` → `CharacterSheet` omits `onRoll`). Only skill / save / perception are rollable.

### Chat feed

- **`useChatFeed`** (mounted in `Shell`): on mount, seed `chatStore` from `game.messages.contents`, filtered by `message.visible`, last ~50. Then subscribe to `createChatMessage` (and `deleteChatMessage` to drop) → `buildChatView` → push to store. Foundry already delivers only messages this client may see, so visibility needs no reimplementation.
- **`ChatTab`** (`src/app/tabs/ChatTab.tsx`): the store's list, newest at bottom, auto-scrolled. Each row mounts the message's `renderHTML()` element through a `ref` + `useEffect`; a styled wrapper class restyles PF2e's card markup for dark/mobile. Empty state when no messages.
- **`ChatToast`** (mounted in `Shell`, above the tab bar): shows the latest **unseen own** result as a compact summary (speaker · flavor · outcome). Auto-dismiss after a few seconds or on tap; **tap → `setActiveTab("chat")`**. Suppressed while the Chat tab is already active.

### Toast-vs-panel filter

- **Everything visible** lands in the Chat tab.
- **Auto-toast only for "your" results:** `authoredBySelf` (`msg.author?.id === game.user.id`) **or** speaker is the active actor (`msg.speaker?.actor === actorId`). Keeps GM/other-player chatter out of the toast while still logging it in the tab.

### Damage-button spike (do this early in Slice 1)

Render a real roll card in `ChatTab` and check whether PF2e's interactive buttons (apply-damage, etc.) work. PF2e attaches chat listeners via the **`renderChatMessageHTML`** hook, which fires in the stock sidebar but **not** automatically when we insert the element ourselves. Plan:
1. Insert the `renderHTML()` element, then emit `Hooks.callAll("renderChatMessageHTML", message, element, …)` (or call PF2e's bound listener) so listeners attach.
2. If that proves unreliable, custom apply-damage buttons become a small, contained task in **Slice 2** (where damage actually originates). Checks in Slice 1 produce no damage buttons, so this never blocks Slice 1 shipping.

---

## Slice 2 — strikes (sketch, finalised at the slice)

- **Data:** `actor.system.actions` — the prepared strike array. Each entry exposes a label, a `.variants[0..2]` set whose labels carry the MAP values (+0 / −5 / −10), and `.damage` / `.critical` roll callbacks.
- **UI:** a new **Strikes** sheet sub-tab. Each strike is a card: name + traits, three attack buttons (variant labels), a Damage button, a Crit button. Buttons call the live variant/damage callbacks (verify exact method names at the slice); results flow through the same chat feed.
- Verify the Imaginary Weapon homebrew here: RollOption/DamageDice rule elements and the per-cast damage selector must work through these buttons — that proves the architecture.

## Slice 3 — spells (sketch, finalised at the slice)

- **Data:** iterate `actor.spellcasting` → entries → ranks → spells; read remaining slots and focus points.
- **Cast:** mirror the desktop sheet — `collection.entry.cast(spell, { rank, slotId })` (confirm `spell.parent.cast` vs. the entry method at the slice). Focus spend must decrement focus points; slot spend must decrement slots.
- **UI:** a new **Spells** sheet sub-tab. With Strikes + Spells the sub-tab bar reaches 8 entries, so it becomes horizontally scrollable.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/actor/rolls.ts` | `rollSkill` / `rollSave` / `rollPerception` — guarded live-API calls |
| `src/foundry/chat/types.ts` | `ChatView` (toast/list summary) + source `ChatMessageLike` |
| `src/foundry/chat/view.ts` | pure `buildChatView(msg)` — speaker, flavor, outcome, `authoredBySelf` |
| `src/foundry/chat/render.ts` | `renderMessageElement(msg): Promise<HTMLElement>` + listener-attach helper |
| `src/app/chatStore.ts` | Zustand: message list (cap), latest-unseen for the toast, seen-marking |
| `src/app/chat/useChatFeed.ts` | seeds from `game.messages`, subscribes to `createChatMessage`/`deleteChatMessage` |
| `src/app/chat/ChatToast.tsx` | cross-tab toast (own results); tap → Chat tab |
| `src/app/tabs/ChatTab.tsx` | full history; mounts live card elements via ref |

**Edits**

- `src/app/store.ts` — add `"chat"` to `TabId`.
- `src/app/TabBar.tsx` — add the Chat entry (`fa-comments`), inserted after Combat.
- `src/app/TabContent.tsx` — route `chat` → `<ChatTab />`.
- `src/app/Shell.tsx` — mount `useChatFeed` + `ChatToast`.
- `src/app/sheet/CharacterSheet.tsx` — pass `onRoll` into `BreakdownModal`; build the request with a `rollKey`.
- `src/foundry/actor/types.ts` + `view.ts` — add a `rollable`/`rollKey` flag to `SkillView`, `SaveView`, and `perception` so rows open the modal regardless of breakdown presence. No mapper math changes.
- `src/app/sheet/SkillsPanel.tsx` / `VitalsPanel.tsx` — open the breakdown modal for rollable rows even without a breakdown.

No new mutations to existing actor data — rolls are side effects that produce chat messages; the actor view is unchanged by a check roll.

---

## Live-API assumptions (verify in play; correct any path on return)

1. **`Statistic.roll`** — `actor.skills[slug]`, `actor.saves[slug]`, `actor.perception` are `Statistic` objects; `.roll(args)` accepts `StatisticRollParameters` including `skipDialog?: boolean` (grounded: `statistic.ts:401,671`). Confirm slugs match `actor.skills` keys (lore skills included).
2. **`ChatMessagePF2e#renderHTML(options?)`** → `Promise<HTMLElement>` (grounded: `chat-message/document.ts:201`). Confirm it's callable for our messages and returns the full card.
3. **`renderChatMessageHTML` hook / listener attach** — whether emitting the hook (or PF2e's bound listener) over our inserted element wires the interactive buttons. This is the Slice-1 spike; outcome decides Slice-2 damage-button work.
4. **`message.author` vs `message.user`** for the authored-by-self toast filter on v14 (use `author?.id ?? user?.id`).
5. **(Slice 2)** strike shape under `actor.system.actions` — `.variants[]`, `.damage`, `.critical` method names.
6. **(Slice 3)** the cast entry point — `collection.entry.cast(spell, {...})` vs `spell.parent.cast(...)`, and slot/focus decrement.

---

## Testing

- **TDD the pure logic** (Vitest), asserting the structural contract (stays green regardless of the live shape; live correctness is the user's verification pass):
  - `buildChatView` — speaker/flavor extraction, outcome classification, `authoredBySelf`, `isRoll`.
  - The toast filter predicate (own vs. others).
  - `rollKey` derivation on the view (which rows are rollable).
- **Components** verified by `npm run typecheck` + `npm run build` + a manual checklist (roll a skill, a save, perception; result toasts and lands in the Chat tab; tapping the toast switches tabs; GM/other messages appear in the tab but don't toast).
- The roll functions in `rolls.ts` are thin guarded wrappers over live objects — covered by the manual checklist, like the existing `mutations.ts`.

---

## Spike result (Slice 1 — verified 2026-06-11)

**Outcome: B — stock apply-damage is inert on mobile; deferred to Phase 7.**

Live-tested (GM on desktop + player on mobile). **Part A passed fully** — checks roll, results toast and land in the Chat tab, toast scoping is correct (own results only), history seeds on open, and cards are legible on dark mobile.

**Part B:** a GM-posted damage card's **Apply Damage** button rendered but produced **no HP change**. PF2e's apply-damage applies to the **selected canvas token**, and we run canvas-off on mobile (`core.noCanvas`), so there is no token to receive it.

**Decision (user):** do **not** add custom apply-damage buttons in Slice 2. Working damage application waits for **Phase 7 (battle map)**, where token selection exists — at which point the stock buttons can be revisited or wired to the tapped map token. Slice 2 strikes still post their normal attack / damage / crit cards through the chat feed; only the apply step is deferred.

(Render path unchanged: `render.ts` calls `message.renderHTML()` then emits `renderChatMessageHTML` so PF2e can bind card listeners to our mounted element — the gap is the absent canvas-token target on mobile, not the feed.)
