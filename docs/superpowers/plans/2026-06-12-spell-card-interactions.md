# Spell Card Interactions + Row Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cast result card's Roll Damage / Save / spell-effect controls work on mobile via touch popups that call PF2e's own methods, and left-align spell-list names.

**Architecture:** The chat card is the real PF2e card mounted via `renderHTML()`. A capturing click listener on `ChatCard` classifies taps on the damage/save/effect controls (`src/foundry/chat/cardInteractions.ts`), suppresses PF2e's mobile-broken native handler, and reports a typed payload to `ChatTab`, which opens one of three mobile modals. The modals call guarded wrappers in `src/foundry/spells/chatActions.ts` that delegate to PF2e (`spell.rollDamage`, `actor.saves[t].roll`, `createEmbeddedDocuments`). Results flow back through the existing chat feed.

**Tech Stack:** React 18 + Zustand + Tailwind v4 (preflight disabled), Vitest (pure-Node, no DOM env), Foundry VTT v14 + PF2e system v8.2.0 (live globals: `game`, `ui`, `Hooks`, `fromUuid`).

**Grounding:** All PF2e calls confirmed against the local v8.2.0 clone `E:/React Projects/pf2e`:
- `spell.rollDamage(event)` — `src/module/item/spell/document.ts:964`; single damage roll, outcome hardcoded (no crit param).
- Cast spell off a message — `message.item` returns the heightened spell at cast rank — `src/module/chat-message/document.ts:104`.
- Card controls — `src/module/chat-message/listeners/cards.ts`: `button[data-action="spell-damage"]`; `button[data-action="spell-save"]` with `data-save` (type) + `data-dc` (DC). The native save handler calls `game.user.getActiveTokens()` → errors `NoTokenSelected` on mobile (why it's dead).
- Save roll — `actor.saves[slug].roll({ dc:{value}, item, origin, rollTwice, skipDialog })` — `src/module/system/statistic/statistic.ts:242,639`; `rollTwice: "keep-higher"|"keep-lower"|false`.
- Effect link — `@UUID[Compendium.pf2e.spell-effects.Item.<name-or-id>]` in `system.description.value` → enriched `<a data-uuid="…spell-effects…">`; apply via `fromUuid` → `toObject()` → `createEmbeddedDocuments("Item", […])` — `src/module/apps/sidebar/chat-log.ts:177`, `src/module/actor/actions/simple.ts:79`.
- Spell damage partial shape — `{ formula: string; type: DamageType; category: …|null }` — `src/module/item/spell/data.ts:64`.

---

## File structure

**New files**

| File | Responsibility |
|---|---|
| `src/foundry/chat/cardInteractions.ts` | `CardInteraction` union; pure `interactionFromControl(attrs, messageId)`; thin DOM `classifyCardClick(target, messageId)` |
| `src/foundry/spells/chatActions.ts` | guarded `rollSpellDamage` / `rollSpellSave` / `applySpellEffect`; pure `findSpellEffectUuid` / `buildSpellBaseDamage`; `loadEffect` helper |
| `src/app/chat/DamageRollModal.tsx` | base-damage + single Roll Damage |
| `src/app/chat/SaveRollModal.tsx` | save type + DC + Roll, normal/fortune/misfortune |
| `src/app/chat/SpellEffectModal.tsx` | effect description + Apply to character (shared: card + detail) |
| `tests/cardInteractions.test.ts` | `interactionFromControl` unit tests |
| `tests/spellChatActions.test.ts` | `findSpellEffectUuid`, `buildSpellBaseDamage`, and guarded-call tests |

**Edited files**

| File | Change |
|---|---|
| `src/app/chat/ChatCard.tsx` | `onInteract` prop + capturing click listener |
| `src/app/tabs/ChatTab.tsx` | popup state; pass `onInteract`; render the matching modal |
| `src/app/sheet/spells/SpellRow.tsx` | left-align name (item 1) |
| `src/app/sheet/SpellsPanel.tsx` | left-align Activations row (item 1) |
| `src/app/sheet/spells/SpellbookModal.tsx` | left-align rows (item 1) |
| `src/app/sheet/spells/SpellDetailModal.tsx` | detect effect → Apply Effect entry (item 3 "both") |

---

## Task 1: Left-align spell names (item 1)

This is the only item I can't reproduce statically — `SpellRow.tsx` already uses `flex … text-left`, yet the live screenshot shows the name centered/indented. **Reproduce live first**, then apply the minimal flush-left fix. Likely cause: with Tailwind preflight disabled, a native `<button>`'s UA centering surfaces.

**Files:**
- Modify: `src/app/sheet/spells/SpellRow.tsx`
- Modify: `src/app/sheet/SpellsPanel.tsx` (Activations row, ~line 92)
- Modify: `src/app/sheet/spells/SpellbookModal.tsx` (slot/known rows)

- [ ] **Step 1: Reproduce and find the real cause**

Run `npm run dev`, open the app in your running Foundry (mobile viewport), go to **Sheet → Spells**. If the spell names are already flush-left after a fresh build, this is a stale-build artifact — note it and skip to Step 4. Otherwise, with devtools, inspect a centered spell name and find the offending rule (computed `text-align`/`justify-content`/`margin` on the row's name button).

- [ ] **Step 2: Apply the flush-left fix in `SpellRow.tsx`**

Force the name/info button to a full-width, start-justified flex so neither UA button centering nor a collapsed flex can re-center it. Replace the inner button's className:

```tsx
// src/app/sheet/spells/SpellRow.tsx — the onDetail button
<button onClick={onDetail} className="flex w-full min-w-0 flex-1 items-center justify-start gap-2 text-left">
```

(If Step 1 found a different concrete cause, apply the minimal change that achieves flush-left instead — the goal is: icon+name flush-left, Cast stays right.)

- [ ] **Step 3: Apply the same to the Activations row and Spellbook rows**

In `src/app/sheet/SpellsPanel.tsx`, the Activations row wrapper already uses `flex items-center gap-2`; ensure its text block is left (`min-w-0 flex-1` is present — add `text-left` to the inner `<div>` if the live check showed centering). In `src/app/sheet/spells/SpellbookModal.tsx`, ensure each slot/known row's label is wrapped in a `justify-start text-left` flex. Only change what the live check showed drifting.

- [ ] **Step 4: Verify in the running app**

Reload; confirm in **Spells**, **Activations**, and the **Spellbook** modal that names are flush-left and Cast/controls stay right.

- [ ] **Step 5: Typecheck + build + commit**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

```bash
git add src/app/sheet/spells/SpellRow.tsx src/app/sheet/SpellsPanel.tsx src/app/sheet/spells/SpellbookModal.tsx
git commit -m "$(cat <<'EOF'
fix(spells): left-align spell-list names (rows, activations, spellbook)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `cardInteractions.ts` — classify a card tap

The pure `interactionFromControl` is unit-tested; the DOM `classifyCardClick` (a `closest()` walk) is thin glue verified by the live checklist (Task 8), matching the project's `render.ts` convention (no DOM test env).

**Files:**
- Create: `src/foundry/chat/cardInteractions.ts`
- Test: `tests/cardInteractions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cardInteractions.test.ts
import { describe, it, expect } from "vitest";
import { interactionFromControl } from "../src/foundry/chat/cardInteractions";

describe("interactionFromControl", () => {
  it("maps a spell-damage button to a damage interaction", () => {
    expect(interactionFromControl({ action: "spell-damage", save: null, dc: null, uuid: null }, "m1"))
      .toEqual({ kind: "damage", messageId: "m1" });
  });

  it("maps a spell-save button (with type + dc) to a save interaction", () => {
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "18", uuid: null }, "m1"))
      .toEqual({ kind: "save", messageId: "m1", saveType: "reflex", dc: 18 });
  });

  it("ignores a save button with a non-numeric dc", () => {
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "NaN", uuid: null }, "m1"))
      .toBeNull();
  });

  it("maps a spell-effects content link to an effect interaction", () => {
    const uuid = "Compendium.pf2e.spell-effects.Item.Spell Effect: Shield";
    expect(interactionFromControl({ action: null, save: null, dc: null, uuid }, "m1"))
      .toEqual({ kind: "effect", uuid });
  });

  it("ignores a non-spell-effects link and unrelated controls", () => {
    expect(interactionFromControl({ action: null, save: null, dc: null, uuid: "Actor.abc" }, "m1")).toBeNull();
    expect(interactionFromControl({ action: "other", save: null, dc: null, uuid: null }, "m1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/cardInteractions.test.ts`
Expected: FAIL — `interactionFromControl` is not exported / module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/foundry/chat/cardInteractions.ts
/** A tap on the mounted PF2e cast card, classified into a mobile action. The card
 *  is real PF2e HTML; its native handlers assume a canvas token (absent on mobile),
 *  so we intercept these controls and drive them ourselves. */
export type CardInteraction =
  | { kind: "damage"; messageId: string }
  | { kind: "save"; messageId: string; saveType: string; dc: number }
  | { kind: "effect"; uuid: string };

/** Pure: given the attributes of the tapped control, produce the interaction.
 *  Disambiguates by which attributes are present (effect link vs damage/save button). */
export function interactionFromControl(
  c: { action: string | null; save: string | null; dc: string | null; uuid: string | null },
  messageId: string,
): CardInteraction | null {
  if (c.uuid && c.uuid.includes("spell-effects")) return { kind: "effect", uuid: c.uuid };
  if (c.action === "spell-damage") return { kind: "damage", messageId };
  if (c.action === "spell-save") {
    const dc = Number(c.dc);
    if (c.save && Number.isInteger(dc)) return { kind: "save", messageId, saveType: c.save, dc };
  }
  return null;
}

/** DOM glue (untested, like render.ts): from a click target, find the nearest
 *  card control and classify it. Returns null for taps on anything else. */
const CONTROL_SELECTOR =
  'button[data-action="spell-damage"],button[data-action="spell-save"],a[data-uuid]';
export function classifyCardClick(target: Element | null, messageId: string): CardInteraction | null {
  const el = target?.closest<HTMLElement>(CONTROL_SELECTOR);
  if (!el) return null;
  return interactionFromControl(
    {
      action: el.getAttribute("data-action"),
      save: el.getAttribute("data-save"),
      dc: el.getAttribute("data-dc"),
      uuid: el.getAttribute("data-uuid"),
    },
    messageId,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/cardInteractions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/chat/cardInteractions.ts tests/cardInteractions.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): classify spell-card taps (damage/save/effect) for mobile interception

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `chatActions.ts` — pure helpers (`findSpellEffectUuid`, `buildSpellBaseDamage`)

**Files:**
- Create: `src/foundry/spells/chatActions.ts` (pure helpers now; guarded wrappers in Task 4)
- Test: `tests/spellChatActions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/spellChatActions.test.ts
import { describe, it, expect } from "vitest";
import { findSpellEffectUuid, buildSpellBaseDamage } from "../src/foundry/spells/chatActions";

describe("findSpellEffectUuid", () => {
  it("extracts a spell-effects UUID from a description", () => {
    const html = '<p>Shield. @UUID[Compendium.pf2e.spell-effects.Item.Spell Effect: Shield]{Effect}</p>';
    expect(findSpellEffectUuid(html)).toBe("Compendium.pf2e.spell-effects.Item.Spell Effect: Shield");
  });
  it("returns null when there is no spell-effects link", () => {
    expect(findSpellEffectUuid("<p>No effect here. @UUID[Compendium.pf2e.conditions.Item.Frightened]</p>")).toBeNull();
    expect(findSpellEffectUuid(undefined)).toBeNull();
  });
});

describe("buildSpellBaseDamage", () => {
  it("joins damage partials as 'formula [category] type'", () => {
    expect(buildSpellBaseDamage({ "0": { formula: "2d4", type: "fire", category: null } })).toBe("2d4 fire");
    expect(
      buildSpellBaseDamage({
        a: { formula: "1d6", type: "fire", category: null },
        b: { formula: "1d6", type: "fire", category: "persistent" },
      }),
    ).toBe("1d6 fire + 1d6 persistent fire");
  });
  it("returns empty string when there is no damage", () => {
    expect(buildSpellBaseDamage(undefined)).toBe("");
    expect(buildSpellBaseDamage({})).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/spellChatActions.test.ts`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write the pure helpers**

```ts
// src/foundry/spells/chatActions.ts
/** Live spell-card actions driven from the mobile chat feed. Guarded like cast.ts:
 *  a rejected call surfaces via Foundry's toast and never throws into React. PF2e
 *  owns the rules math — these only trigger and supply the bound actor. */

interface SpellDamagePartial { formula?: string; type?: string; category?: string | null }

/** Pure: a readable base-damage string for the damage popup, e.g. "2d4 fire". */
export function buildSpellBaseDamage(damage: Record<string, SpellDamagePartial> | undefined): string {
  if (!damage) return "";
  return Object.values(damage)
    .map((d) => [d.formula, d.category ?? "", d.type ?? ""].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .join(" + ");
}

/** Pure: pull a spell's linked effect UUID from its description, if any.
 *  PF2e links spell effects as @UUID[Compendium.pf2e.spell-effects.Item.<name-or-id>]. */
const SPELL_EFFECT_UUID = /@UUID\[(Compendium\.pf2e\.spell-effects\.Item\.[^\]]+)\]/;
export function findSpellEffectUuid(description: string | undefined): string | null {
  if (!description) return null;
  const m = SPELL_EFFECT_UUID.exec(description);
  return m ? m[1] : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/spellChatActions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/spells/chatActions.ts tests/spellChatActions.test.ts
git commit -m "$(cat <<'EOF'
feat(spells): pure helpers — spell-effect UUID + base-damage string

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `chatActions.ts` — guarded live wrappers

Thin guarded wrappers over PF2e (same contract/test style as `cast.ts` / `spellCast.test.ts`): mock the globals, assert the right method is called with the right args, and assert `guard()` swallows rejections.

**Files:**
- Modify: `src/foundry/spells/chatActions.ts`
- Test: `tests/spellChatActions.test.ts` (extend)

- [ ] **Step 1: Add the failing tests**

Append to `tests/spellChatActions.test.ts`:

```ts
import { rollSpellDamage, rollSpellSave, applySpellEffect } from "../src/foundry/spells/chatActions";

interface Call { method: string; args: unknown[] }

function stub() {
  const calls: Call[] = [];
  const spell = {
    name: "Breathe Fire",
    rollDamage: (...args: unknown[]) => { calls.push({ method: "rollDamage", args }); return Promise.resolve(); },
  };
  const reflex = {
    roll: (...args: unknown[]) => { calls.push({ method: "save.roll", args }); return Promise.resolve(); },
  };
  const message = { item: spell, actor: { id: "caster" } };
  const target = { id: "tgt" };
  const actor = { saves: { reflex }, createEmbeddedDocuments: (...args: unknown[]) => { calls.push({ method: "createEmbeddedDocuments", args }); return Promise.resolve([]); } };
  (globalThis as { game?: unknown }).game = {
    messages: { get: (id: string) => (id === "m1" ? message : null) },
    actors: { get: (id: string) => (id === "a1" ? actor : null) },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { fromUuid?: unknown }).fromUuid = (uuid: string) =>
    Promise.resolve(uuid.includes("spell-effects") ? { toObject: () => ({ _id: "orig", type: "effect" }) } : null);
  (globalThis as { PointerEvent?: unknown }).PointerEvent ??= class { constructor(public type: string) {} } as unknown;
  return { calls, target };
}

describe("rollSpellDamage", () => {
  it("calls rollDamage on the message's cast spell", async () => {
    const { calls } = stub();
    await rollSpellDamage("m1");
    expect(calls[0].method).toBe("rollDamage");
  });
  it("never throws when there is no spell on the message", async () => {
    stub();
    await expect(rollSpellDamage("missing")).resolves.toBeUndefined();
  });
});

describe("rollSpellSave", () => {
  it("rolls the bound actor's save with DC + rollTwice, forwarding item/origin", async () => {
    const { calls } = stub();
    await rollSpellSave("a1", "reflex", 18, { mode: "fortune", messageId: "m1" });
    expect(calls[0].method).toBe("save.roll");
    const arg = calls[0].args[0] as Record<string, unknown>;
    expect(arg.dc).toEqual({ value: 18 });
    expect(arg.rollTwice).toBe("keep-higher");
    expect(arg.skipDialog).toBe(true);
  });
  it("never throws for an unknown save type", async () => {
    stub();
    await expect(rollSpellSave("a1", "bogus", 10, {})).resolves.toBeUndefined();
  });
});

describe("applySpellEffect", () => {
  it("creates the effect item on the bound actor (id stripped)", async () => {
    const { calls } = stub();
    await applySpellEffect("a1", "Compendium.pf2e.spell-effects.Item.Spell Effect: Shield");
    expect(calls[0].method).toBe("createEmbeddedDocuments");
    const [docType, sources] = calls[0].args as [string, Array<{ _id: unknown }>];
    expect(docType).toBe("Item");
    expect(sources[0]._id).toBeNull();
  });
  it("never throws when the effect can't be resolved", async () => {
    stub();
    await expect(applySpellEffect("a1", "Compendium.pf2e.other.Item.Nope")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/spellChatActions.test.ts`
Expected: FAIL — `rollSpellDamage` / `rollSpellSave` / `applySpellEffect` not exported.

- [ ] **Step 3: Implement the guarded wrappers**

Append to `src/foundry/spells/chatActions.ts`:

```ts
type Dict = Record<string, unknown>;

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] spell card action failed", err);
    (ui as any)?.notifications?.error?.("Spell action failed — see console.");
  }
}

/** Roll a cast spell's damage. The cast spell (heightened, at cast rank) is read
 *  off the message via `message.item`; PF2e posts the damage card itself. Spells
 *  have a single damage roll (no critical) in v8.2. */
export function rollSpellDamage(messageId: string): Promise<void> {
  return guard(() => {
    const msg = (game as any)?.messages?.get(messageId);
    const spell = msg?.item;
    if (!spell?.rollDamage) throw new Error(`no spell on message ${messageId}`);
    return spell.rollDamage(new PointerEvent("click"));
  });
}

export type SaveMode = "normal" | "fortune" | "misfortune";
const ROLL_TWICE: Record<SaveMode, "keep-higher" | "keep-lower" | false> = {
  normal: false,
  fortune: "keep-higher",
  misfortune: "keep-lower",
};

/** Roll the bound character's save against a spell's DC. There is no canvas token
 *  selection on mobile, so the app's actor is the roller by construction (the
 *  native card uses getActiveTokens() → errors NoTokenSelected). `messageId`, when
 *  given, supplies the spell (item) + caster (origin) for correct roll options. */
export function rollSpellSave(
  actorId: string,
  saveType: string,
  dc: number,
  opts: { mode?: SaveMode; messageId?: string } = {},
): Promise<void> {
  return guard(() => {
    const actor = (game as any)?.actors?.get(actorId);
    const save = actor?.saves?.[saveType];
    if (!save?.roll) throw new Error(`no save statistic ${saveType}`);
    const msg = opts.messageId ? (game as any)?.messages?.get(opts.messageId) : null;
    const args: Dict = {
      dc: { value: dc },
      rollTwice: ROLL_TWICE[opts.mode ?? "normal"],
      skipDialog: true,
    };
    if (msg?.item) args.item = msg.item;
    if (msg?.actor) args.origin = msg.actor;
    return save.roll(args);
  });
}

/** Resolve an effect document from a UUID, tolerating PF2e's name-based
 *  spell-effects links (Compendium.pf2e.spell-effects.Item.<name>) by falling back
 *  to a pack-index lookup by name. */
async function loadEffect(uuid: string): Promise<{ toObject: () => Dict } | null> {
  const g = globalThis as any;
  const direct = await g.fromUuid?.(uuid).catch(() => null);
  if (direct?.toObject) return direct;
  const m = /^Compendium\.(.+)\.Item\.(.+)$/.exec(uuid);
  if (m) {
    const pack = g.game?.packs?.get(m[1]);
    if (pack?.getIndex) {
      const index = await pack.getIndex();
      const entry = index.find?.((e: { _id: string; name: string }) => e.name === m[2] || e._id === m[2]);
      if (entry) {
        const byId = await g.fromUuid?.(`Compendium.${m[1]}.Item.${entry._id}`).catch(() => null);
        if (byId?.toObject) return byId;
      }
    }
  }
  return null;
}

/** Apply a spell effect to the bound character (the mobile "current character").
 *  Faithful to PF2e's simple-action path: clone the effect source, drop its id,
 *  and create it on the actor. */
export function applySpellEffect(actorId: string, uuid: string): Promise<void> {
  return guard(async () => {
    const actor = (game as any)?.actors?.get(actorId);
    if (!actor?.createEmbeddedDocuments) throw new Error(`no actor ${actorId}`);
    const effect = await loadEffect(uuid);
    if (!effect) throw new Error(`effect not found: ${uuid}`);
    const source = effect.toObject();
    source._id = null;
    return actor.createEmbeddedDocuments("Item", [source]);
  });
}
```

- [ ] **Step 4: Run the full test file to verify it passes**

Run: `npx vitest run tests/spellChatActions.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Run the whole suite + typecheck**

Run: `npm run test && npm run typecheck`
Expected: all tests green (prior 85 + the new ones), typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/foundry/spells/chatActions.ts tests/spellChatActions.test.ts
git commit -m "$(cat <<'EOF'
feat(spells): guarded card actions — roll damage, roll save, apply effect

Delegates to PF2e (spell.rollDamage, actor.saves[t].roll, createEmbeddedDocuments);
save rolls on the bound actor (mobile has no token selection). Name-based
spell-effects UUIDs resolved via pack-index fallback.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: The three modals

React components only — verified by typecheck/build and the live checklist (no DOM test env). They reuse `parts/Modal.tsx` and the `SpellDetailModal` description/enrich pattern.

**Files:**
- Create: `src/app/chat/DamageRollModal.tsx`
- Create: `src/app/chat/SaveRollModal.tsx`
- Create: `src/app/chat/SpellEffectModal.tsx`

- [ ] **Step 1: `DamageRollModal.tsx`**

```tsx
// src/app/chat/DamageRollModal.tsx
import { Modal } from "../sheet/parts/Modal";
import { rollSpellDamage, buildSpellBaseDamage } from "../../foundry/spells/chatActions";

/** Confirm popup for rolling a cast spell's damage. PF2e v8.2 spells have a single
 *  damage roll (no critical); we show the base dice and trigger PF2e's own roll. */
export function DamageRollModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const spell = (game as any)?.messages?.get(messageId)?.item;
  const name: string = spell?.name ?? "Spell";
  const damage = buildSpellBaseDamage(spell?.system?.damage);
  const onRoll = () => { void rollSpellDamage(messageId); onClose(); };
  return (
    <Modal title={name} onClose={onClose}>
      {damage && (
        <div className="mb-3 text-sm text-zinc-300">
          Damage: <span className="font-semibold">{damage}</span>
        </div>
      )}
      <button
        onClick={onRoll}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Roll Damage
      </button>
    </Modal>
  );
}
```

- [ ] **Step 2: `SaveRollModal.tsx`**

```tsx
// src/app/chat/SaveRollModal.tsx
import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { rollSpellSave, type SaveMode } from "../../foundry/spells/chatActions";

const MODES: { id: SaveMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "fortune", label: "Fortune" },
  { id: "misfortune", label: "Misfortune" },
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Confirm popup for rolling the bound character's save against a spell DC. */
export function SaveRollModal({
  actorId,
  saveType,
  dc,
  messageId,
  onClose,
}: {
  actorId: string;
  saveType: string;
  dc: number;
  messageId?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<SaveMode>("normal");
  const onRoll = () => { void rollSpellSave(actorId, saveType, dc, { mode, messageId }); onClose(); };
  return (
    <Modal title={`${cap(saveType)} Save`} onClose={onClose}>
      <div className="mb-3 text-sm text-zinc-300">
        DC <span className="font-semibold">{dc}</span>
      </div>
      <div className="mb-3 flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
              mode === m.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        onClick={onRoll}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Roll Save
      </button>
    </Modal>
  );
}
```

- [ ] **Step 3: `SpellEffectModal.tsx`**

```tsx
// src/app/chat/SpellEffectModal.tsx
import { useEffect, useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { enrichHtml } from "../../foundry/enrich";
import { applySpellEffect } from "../../foundry/spells/chatActions";

/** Popup for a spell's linked effect: enriched description + Apply to the bound
 *  character. Reachable from the cast card and the Spells-tab detail view. */
export function SpellEffectModal({
  actorId,
  uuid,
  onClose,
}: {
  actorId: string;
  uuid: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("Spell Effect");
  const [html, setHtml] = useState("");
  useEffect(() => {
    let alive = true;
    void (globalThis as any)?.fromUuid?.(uuid)?.then(async (eff: any) => {
      if (!alive || !eff) return;
      setName(eff.name ?? "Spell Effect");
      const desc: string = eff.system?.description?.value ?? "";
      const enriched = desc ? await enrichHtml(desc) : "";
      if (alive) setHtml(enriched);
    });
    return () => { alive = false; };
  }, [uuid]);
  const onApply = () => { void applySpellEffect(actorId, uuid); onClose(); };
  return (
    <Modal title={name} onClose={onClose}>
      {html ? (
        <div
          className="mb-3 text-sm leading-relaxed text-zinc-200 [&_a]:text-indigo-300 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="mb-3 text-sm text-zinc-500">No description.</div>
      )}
      <button
        onClick={onApply}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Apply to Character
      </button>
    </Modal>
  );
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0 (the modals aren't wired in yet — this just proves they compile).

- [ ] **Step 5: Commit**

```bash
git add src/app/chat/DamageRollModal.tsx src/app/chat/SaveRollModal.tsx src/app/chat/SpellEffectModal.tsx
git commit -m "$(cat <<'EOF'
feat(chat): mobile popups for spell damage / save / effect

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire interception into `ChatCard` + popups into `ChatTab`

**Files:**
- Modify: `src/app/chat/ChatCard.tsx`
- Modify: `src/app/tabs/ChatTab.tsx`

- [ ] **Step 1: Add the capturing interceptor to `ChatCard.tsx`**

Replace the file with (adds `onInteract` + a capture-phase click listener that suppresses PF2e's native handler on a match):

```tsx
// src/app/chat/ChatCard.tsx
import { useEffect, useRef } from "react";
import { renderMessageElement } from "../../foundry/chat/render";
import { classifyCardClick, type CardInteraction } from "../../foundry/chat/cardInteractions";
import type { ChatView } from "../../foundry/chat/types";

/** Mounts the live PF2e card element for one message; falls back to the summary
 *  title if the message is gone or won't render. A capture-phase click listener
 *  intercepts the damage/save/effect controls (whose native handlers are dead on
 *  mobile) and reports them via `onInteract`. */
export function ChatCard({ summary, onInteract }: { summary: ChatView; onInteract?: (i: CardInteraction) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const host = ref.current;
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      if (!onInteract) return;
      const hit = classifyCardClick(e.target as Element, summary.id);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        onInteract(hit);
      }
    };
    host.addEventListener("click", onClick, true); // capture → runs before PF2e's button listener
    renderMessageElement(summary.id).then((el) => {
      if (!alive || !host) return;
      if (el) host.replaceChildren(el);
      else host.textContent = summary.title;
    });
    return () => {
      alive = false;
      host?.removeEventListener("click", onClick, true);
      host?.replaceChildren();
    };
  }, [summary.id, summary.title, onInteract]);
  return <div ref={ref} className="pf2e-chat-card" />;
}
```

- [ ] **Step 2: Hold popup state + render modals in `ChatTab.tsx`**

Replace the file with:

```tsx
// src/app/tabs/ChatTab.tsx
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";
import { ChatCard } from "../chat/ChatCard";
import { DamageRollModal } from "../chat/DamageRollModal";
import { SaveRollModal } from "../chat/SaveRollModal";
import { SpellEffectModal } from "../chat/SpellEffectModal";
import type { CardInteraction } from "../../foundry/chat/cardInteractions";

/** The Chat tab: full scrollable history, newest at the bottom, auto-scrolled.
 *  Taps on a card's damage/save/effect controls open a mobile popup. */
export function ChatTab() {
  const messages = useChatStore((s) => s.messages);
  const actorId = useAppStore((s) => s.actorId);
  const [popup, setPopup] = useState<CardInteraction | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-comments text-3xl" aria-hidden="true" />
        <div className="text-zinc-300">No messages yet.</div>
        <div className="text-sm">Rolls and chat will appear here.</div>
      </div>
    );
  }
  const close = () => setPopup(null);
  return (
    <div className="flex flex-col gap-2 p-3">
      {messages.map((m) => <ChatCard key={m.id} summary={m} onInteract={setPopup} />)}
      <div ref={bottom} />
      {popup?.kind === "damage" && <DamageRollModal messageId={popup.messageId} onClose={close} />}
      {popup?.kind === "save" && actorId && (
        <SaveRollModal actorId={actorId} saveType={popup.saveType} dc={popup.dc} messageId={popup.messageId} onClose={close} />
      )}
      {popup?.kind === "effect" && actorId && (
        <SpellEffectModal actorId={actorId} uuid={popup.uuid} onClose={close} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/chat/ChatCard.tsx src/app/tabs/ChatTab.tsx
git commit -m "$(cat <<'EOF'
feat(chat): intercept spell-card controls and open mobile popups

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Spell-effect entry in the Spells-tab detail (item 3 "both")

**Files:**
- Modify: `src/app/sheet/spells/SpellDetailModal.tsx`

- [ ] **Step 1: Add effect detection + Apply Effect entry**

Edit `src/app/sheet/spells/SpellDetailModal.tsx`. The file already imports `{ useEffect, useMemo, useState } from "react"` (line 1) — leave that as-is. Add only these two new module imports after the existing imports:

```tsx
import { findSpellEffectUuid } from "../../../foundry/spells/chatActions";
import { SpellEffectModal } from "../../chat/SpellEffectModal";
```

Inside the component, after `const [html, setHtml] = useState(...)`, derive the effect UUID and a visibility flag:

```tsx
  const effectUuid = useMemo(() => findSpellEffectUuid(detail?.descriptionHtml), [detail?.descriptionHtml]);
  const [showEffect, setShowEffect] = useState(false);
```

Then, in the returned JSX, immediately before the description block (`{html ? (`), add the Apply Effect button:

```tsx
      {effectUuid && (
        <button
          onClick={() => setShowEffect(true)}
          className="mb-3 w-full rounded-md bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100"
        >
          <i className="fas fa-wand-magic-sparkles mr-1.5" aria-hidden="true" />
          Apply Effect
        </button>
      )}
```

And just before the closing `</Modal>`, mount the effect modal:

```tsx
      {showEffect && effectUuid && (
        <SpellEffectModal actorId={actorId} uuid={effectUuid} onClose={() => setShowEffect(false)} />
      )}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/sheet/spells/SpellDetailModal.tsx
git commit -m "$(cat <<'EOF'
feat(spells): Apply Effect entry in the spell detail popup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Live verification on Ezren + spot-check the grounded DOM

The unit tests cover the pure logic; the DOM glue (the `closest()` walk, capture-listener suppression, enriched effect-link class, and name-based UUID resolution) only exists at runtime. Verify against the running Foundry and fix any DOM mismatch found.

**Files:** none (verification); fix `cardInteractions.ts` / `chatActions.ts` if a selector or path differs live.

- [ ] **Step 1: Build + load**

Run: `npm run build`, then hard-reload the running Foundry as the player who owns Ezren (mobile viewport).

- [ ] **Step 2: Spot-check the card DOM matches the grounded selectors**

In devtools, after casting a save spell (e.g. Breathe Fire), inspect the card: confirm the damage button is `button[data-action="spell-damage"]`, the save button is `button[data-action="spell-save"]` with `data-save` + `data-dc`, and a spell-effect link (e.g. cast Shield) renders as `a[data-uuid*="spell-effects"]`. If any differ, update `CONTROL_SELECTOR` / `interactionFromControl` (and re-run `npx vitest run tests/cardInteractions.test.ts`).

- [ ] **Step 3: Exercise the full checklist**

- [ ] Spells list — names flush-left in entries, Activations, and the Spellbook modal; Cast/controls stay right.
- [ ] Cast a **save** damage spell (Breathe Fire) → tap **Roll Damage** → popup shows base damage → **Roll Damage** → PF2e's damage card posts to Chat.
- [ ] On the same card, tap the **save** → popup shows the save type + DC → **Roll Save** (try Fortune) → Ezren's save result posts to Chat. (Confirms the "current character" default — no NoTokenSelected error.)
- [ ] Cast **Shield** → tap the card's **Spell Effect: Shield** link → popup shows the description → **Apply to Character** → the Shield effect appears on Ezren (Vitals/effects).
- [ ] **Spells → tap Shield → detail → Apply Effect** → same popup → Apply works from the detail path too.
- [ ] Tapping non-interactive card text does nothing unusual (interceptor only catches the three controls).

- [ ] **Step 4: If fixes were needed, commit them**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(chat): align card selectors/paths with live PF2e v8.2 DOM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Final full verification**

Run: `npm run test && npm run typecheck && npm run build`
Expected: all tests green, typecheck + build exit 0.

---

## Self-review notes (for the implementer)

- **Item 1 is reproduce-then-fix** — the source already looks left-aligned, so confirm the live cause before editing; if a fresh build is already correct, it was a stale-build artifact.
- **Critical damage is intentionally absent** — PF2e v8.2 spells have one damage roll; crit-doubling is Phase 7 (apply-to-token).
- **Name-based effect UUIDs** — `loadEffect` falls back to a pack-index lookup; if the live card's `data-uuid` is already id-based, the direct `fromUuid` succeeds and the fallback never runs.
- **Capture-phase suppression** — `stopPropagation()` in the capture listener prevents PF2e's per-button listener (`cards.ts` binds on each button) from also firing (e.g. the save's NoTokenSelected error).
