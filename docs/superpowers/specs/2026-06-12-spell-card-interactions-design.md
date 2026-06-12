# Phase 3 (spells) — Chat-card interactions + row alignment — Design

**Status:** Specced, approved, ready to plan. Follows the shipped Spells feature (`docs/reports/2026-06-12-spells-overnight-report.md`). Three user-reported fixes/enhancements on the cast result card plus the spells list. Live-API paths (PF2e v8.2 / Foundry v14) are **assumptions to verify against the running Foundry during implementation** — see **Live-API assumptions**. We never reimplement PF2e rules; we provide the mobile trigger + popup and call PF2e's own methods.

---

## The three items

1. **Left-align spell names** in the Spells list (names render center/indented; Cast button stays right).
2. **Roll Damage / Roll Save do nothing** when tapped on a cast result card in the Chat feed. Make them work via mobile popups; the save defaults its roller to the current character.
3. **Spell effect → popup** with the effect's description + **Apply to current character**, reachable from **both** the chat card's effect link **and** the Spells-tab detail view.

---

## Decisions (approved)

1. **Mobile popups, PF2e does the math.** Keep the real PF2e card for display; intercept its Roll Damage / Save / effect controls and open a touch-friendly popup that calls PF2e's own roll/apply methods. We never reproduce damage formulas, heightening, save degrees, or effect application.
2. **Damage popup = a single Roll Damage button, showing the spell's base damage.** PF2e v8.2 spells expose only one damage roll (`data-action="spell-damage"`, outcome hardcoded) — there is no separate critical-damage roll like weapon strikes. Critical *doubling* is an apply-time concept tied to a selected token, deferred to Phase 7. Result posts through the existing chat feed. *(Revised from an initial "Damage + Critical" after grounding against the v8.2 source.)*
3. **Save = confirm popup, then roll.** Popup shows save type + DC, a Roll button, and normal / fortune / misfortune. **Roller is always the app's bound character** (sidesteps mobile's absent canvas-token selection).
4. **Spell effect popup in both places** — the chat card's effect link and the `SpellDetailModal`. Apply adds the PF2e effect item to the bound character.

---

## Why the buttons are inert today (root cause)

The chat card is the **real** PF2e card, mounted into React via `message.renderHTML()` in `ChatCard.tsx`; `render.ts` then emits `Hooks.callAll("renderChatMessageHTML", msg, el)` so PF2e binds its card listeners to our mounted element. The **Slice-1 spike** (rolling design, lines 159-169) established two things that frame this work:

- PF2e's card listeners **do** bind to our mounted element (the spike's apply-damage button rendered and was clickable).
- PF2e's interactive actions assume a **canvas token / target context** that mobile lacks (`core.noCanvas`): apply-damage no-ops because there is no selected token to receive it.

So the spell card's **Roll Damage / Save** controls fail for one (or both) of: (a) the spell-card action listener not being among those `renderChatMessageHTML` binds to a detached element, or (b) the native handler depending on canvas-selected/targeted tokens that don't exist on mobile. **We don't need to disambiguate** — calling PF2e's roll methods ourselves, with the bound actor supplied explicitly, is robust to both. The exact native failure mode is confirmed live but does not change the approach.

(In scope here: **rolling** a spell's damage and **rolling** the bound character's save — neither needs a target. Out of scope, still Phase 7: **applying** damage to an arbitrary target token. **Applying an effect** is in scope because the target is our own bound actor, not a canvas selection.)

---

## Architecture & data flow (items 2 & 3)

```
PF2e cast card  (mounted via renderHTML in ChatCard)
   │  user taps Roll Damage / Save / effect link
   ▼
ChatCard — capturing click listener on the host
   │  classifyCardClick(target, message)        [src/foundry/chat/cardInteractions.ts]
   ▼  → {kind:'damage'} | {kind:'save', saveType, dc} | {kind:'effect', uuid} | null
   │  match → preventDefault + stopPropagation, report up;  null → let it pass through
   ▼
onInteract(payload)  →  ChatTab holds the active-popup state, renders one modal
   │
   ├─ DamageRollModal  → rollSpellDamage(messageId)                     ┐
   ├─ SaveRollModal    → rollSpellSave(actorId, saveType, dc, { mode }) │  [src/foundry/spells/
   └─ SpellEffectModal → applySpellEffect(actorId, uuid)                ┘   chatActions.ts — guarded]
                                   │  each calls a live PF2e method
                                   ▼  PF2e posts its own ChatMessage (damage card / save result)
                            createChatMessage hook  (already wired in useChatFeed)
                                   ▼
                       existing chat feed renders the result; the popup closes
```

**Three layers, deliberately separated** (mirrors the project's existing split of pure logic vs. DOM glue vs. guarded live-API calls):

- **Intercept / classify (DOM glue, light-tested like `render.ts`).** `classifyCardClick(target, message)` walks up from the tapped element and returns a typed payload or `null`. Pure with respect to the element + message it's handed (the DOM `closest()` lookups make it integration-ish, but the branch logic is unit-testable against fabricated elements). On a match the listener calls `preventDefault()`/`stopPropagation()` so PF2e's own (broken-on-mobile) handler never runs; on `null` the click passes through untouched (content links, etc. still behave).
- **Popups (React, reuse the existing `parts/Modal.tsx` pattern, like `SpellDetailModal`).** Stateless over their payload; their buttons call the execute layer and close.
- **Execute (foundry glue, guarded exactly like `cast.ts`).** A new `src/foundry/spells/chatActions.ts` with `guard()`-wrapped `rollSpellDamage` / `rollSpellSave` / `applySpellEffect`, plus a pure `findSpellEffectUuid` helper. Each delegates to a live PF2e method; a rejection surfaces via Foundry's toast and never throws into React.

**Wiring the imperative card to React state.** The card is mounted imperatively (outside React's tree). `ChatCard` gains an `onInteract` prop; it attaches the capturing listener in its existing `useEffect` and calls `onInteract(payload)` on a match. `ChatTab` owns `const [popup, setPopup] = useState<CardInteraction | null>(null)`, passes `onInteract={setPopup}` to every `ChatCard`, and renders the one matching modal. Closing sets it back to `null`. (No new global store — popup state is local to the Chat tab, like the Spells panel's `detailSpellId`.)

---

## Item 1 — Left-align spell names

Spell rows render `icon + name (+ glyph)` as a group that reads as centered/indented; the user wants the name flush-left with the Cast button kept on the right. `SpellRow.tsx` already uses `flex … text-left`, so the visible centering is not obvious from the source — **reproduce against the running app first**, then apply the minimal fix. Prime suspect: with Tailwind v4 **preflight disabled** ([styling-gotchas] memory), native `<button>` elements keep UA-default centering, which can surface when the flex layout collapses. Likely fix is forcing the name/info button to a full-width left-justified flex (`w-full justify-start` / explicit `text-left`), but the exact offending rule is confirmed live.

**Also check for the same drift** (and fix consistently): the **Activations** row (`SpellsPanel.tsx`) and the prepared/known rows inside **`SpellbookModal.tsx`**, which share the icon + name layout.

This item is pure styling — no logic, no new tests; verified by eye on the live app.

---

## Item 2 — Roll Damage / Roll Save

### Damage popup (`DamageRollModal`)
- **Trigger:** tap the card's damage control (`button[data-action="spell-damage"]`) → `classifyCardClick` returns `{kind:'damage'}` (payload carries `messageId`).
- **Contents:** the spell name + its **base damage** (the dice from the cast spell's `system.damage`), and a single **Roll Damage** button.
- **Execute:** `rollSpellDamage(messageId)` resolves the cast spell via `message.item` (already the heightened variant at cast rank — `chat-message/document.ts:104`) and calls `spell.rollDamage(event)` (`item/spell/document.ts:964`). PF2e posts the damage card → appears in the feed → modal closes.
- **No critical / heighten / variant UI** — PF2e v8.2 spells have a single damage roll (outcome hardcoded); the spell on the message is already at cast rank, so damage heightens correctly. Critical doubling is deferred to Phase 7 (apply-to-token).

### Save popup (`SaveRollModal`)
- **Trigger:** tap the card's save control → `classifyCardClick` returns `{kind:'save', saveType, dc}`. `saveType` (e.g. `reflex`) and `dc` are read from the tapped element's dataset; if absent, fall back to the spell's defense save + the casting DC from the message.
- **Contents:** save type + DC, a **Roll** button, and **normal / fortune / misfortune**.
- **Execute:** `rollSpellSave(actorId, saveType, dc, { mode })` rolls **the bound character's** save statistic against the DC (`actor.saves[saveType].roll({ dc, … })`). This is the "default selected token = current character" behavior — there is no canvas selection on mobile, so the app's actor is the roller by construction. Result posts to the feed; modal closes.

---

## Item 3 — Spell effect popup (`SpellEffectModal`)

One modal, two entry points:

- **Contents:** the effect's name + enriched **description**, and an **Apply to \<character\>** button.
- **Execute:** `applySpellEffect(actorId, uuid)` resolves the effect via `fromUuid(uuid)` and adds it to the bound actor (`createEmbeddedDocuments("Item", [effect.toObject()])`, with origin flags if PF2e expects them — verify). Guarded.
- **From the chat card:** `classifyCardClick` catches taps on the card's spell-effect link (a content link / effect reference) and returns `{kind:'effect', uuid}`.
- **From the Spells tab:** `SpellDetailModal` calls `findSpellEffectUuid(spell)` — scanning the spell's description for its linked `spell-effects` UUID (PF2e's standard `@UUID[…]` effect link) — and, when present, shows an **Apply Effect** entry that opens the same modal.

`findSpellEffectUuid` is pure (string in → uuid|null) and unit-tested.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/chat/cardInteractions.ts` | `classifyCardClick(target, message)` → typed `CardInteraction` payload or `null`; the `CardInteraction` union type |
| `src/foundry/spells/chatActions.ts` | `rollSpellDamage` / `rollSpellSave` / `applySpellEffect` (guarded live-API), `findSpellEffectUuid` (pure) |
| `src/app/chat/DamageRollModal.tsx` | formula + Roll Damage / Roll Critical |
| `src/app/chat/SaveRollModal.tsx` | save type + DC + Roll, normal / fortune / misfortune |
| `src/app/chat/SpellEffectModal.tsx` | effect description + Apply to character; shared by card + detail |

**Edits**

- `src/app/chat/ChatCard.tsx` — add `onInteract` prop; attach the capturing click listener that runs `classifyCardClick` and reports matches.
- `src/app/tabs/ChatTab.tsx` — hold active-popup state; pass `onInteract`; render the matching modal.
- `src/app/sheet/spells/SpellRow.tsx` — left-align the name/info column (item 1).
- `src/app/sheet/SpellsPanel.tsx` — align the Activations row (item 1 consistency).
- `src/app/sheet/spells/SpellbookModal.tsx` — align prepared/known rows (item 1 consistency).
- `src/app/sheet/spells/SpellDetailModal.tsx` — detect a linked effect and show the Apply Effect entry (item 3).

No changes to the cast path (`cast.ts`) or the chat feed (`useChatFeed`/`render.ts`) — results from the new rolls flow through the existing `createChatMessage` pipeline unchanged.

---

## Live-API paths (grounded against the v8.2 clone; spot-check on the running Foundry)

These were confirmed against the local PF2e **v8.2.0** source clone (`E:/React Projects/pf2e`) with `file:line` references during planning (see the implementation plan for the exact refs). The running instance should match; still **spot-check the rendered card's DOM** (enriched link class, button datasets) since those only exist at runtime.

1. **Spell on the message** — the cast `ChatMessage` exposes the cast spell (at its cast rank) via `message.item` (or equivalent). Needed by `rollSpellDamage` and as the damage-formula source.
2. **Spell damage roll** — confirmed: `message.item` returns the heightened spell at cast rank (`chat-message/document.ts:104`); `spell.rollDamage(event)` rolls + posts (`item/spell/document.ts:964`). Single button (`data-action="spell-damage"`), no critical param. Attack spells read a target from `game.user.targets` (absent on mobile → rolls untargeted); save/AoE damage needs no target.
3. **Damage control selector** — the cast card's damage button (`data-action` value / class) that `classifyCardClick` matches.
4. **Save control + dataset** — the cast card's save element and the keys carrying save type + DC (e.g. `data-pf2-check`, `data-pf2-dc` on an inline check); plus the fallback (spell defense save + message casting DC).
5. **Save roll for a chosen actor** — `actor.saves[saveType].roll({ dc, rollMode, … })`, and how **fortune / misfortune** is expressed (e.g. `rollTwice: "keep-higher" | "keep-lower"`).
6. **Effect link shape** — how the spell-effect reference appears in the rendered card (content link `a[data-uuid]` → an Effect item, or a `spell-effects` compendium UUID) for `classifyCardClick`, and the description pattern `findSpellEffectUuid` scans in the Spells-tab path.
7. **Apply effect** — `fromUuid` + `createEmbeddedDocuments("Item", …)`, including any origin/spellcasting flags PF2e attaches when applying a spell effect.
8. **Item 1 cause** — reproduce the centering live and identify the offending rule before changing styles.

---

## Testing

- **Unit (Vitest, mocked actor/message — same style as `cast.ts` / `spellbook.ts` tests):**
  - `findSpellEffectUuid` — extracts a `spell-effects` UUID from a description; returns `null` when absent.
  - `classifyCardClick` — fabricated elements/datasets classify to the right payload (damage / save with type+dc / effect with uuid) and to `null` for unrelated targets.
  - `rollSpellDamage` / `rollSpellSave` / `applySpellEffect` — assert they resolve the right live object and call the expected method with the expected args, and that `guard()` swallows rejections (toast, no throw). Live correctness is the manual pass.
- **Typecheck + build:** `npm run typecheck` && `npm run build` green.
- **Manual live checklist (Ezren, as the owning player):**
  - [ ] Spells list — names flush-left, Cast on the right; same in Activations and the Spellbook modal.
  - [ ] Cast a damaging (save) spell → tap **Roll Damage** → popup shows base damage → Roll → PF2e's damage card posts to Chat.
  - [ ] Cast a save spell → tap the **save** → popup shows type + DC → **Roll** → the character's save result posts. Try fortune/misfortune.
  - [ ] A spell with an effect → tap the card's **effect link** → popup shows the description → **Apply** → the effect appears on the character.
  - [ ] Same effect popup reachable from **Spells → tap spell → detail → Apply Effect**.
```
