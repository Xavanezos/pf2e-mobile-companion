# Phase 4 — Strike Interactions Slice A.2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auxiliary-action buttons (draw/sheathe/grip) to strikes, make the attack chat card's Damage/Crit buttons work on mobile, and replace instant strike rolls with our own roll-prompt popups (attack prompt is read-only here; modifier toggles are Slice A.2b).

**Architecture:** Extend the pure `buildStrikesView` mapper with `auxiliaryActions` + `modifiers`; add guarded live calls (`runAuxiliaryAction`, `previewStrikeDamage`, and a new `strikeChatActions.ts` that resolves a strike from a posted attack message via `message._attack`); extend the pure `cardInteractions` classifier for `strike-damage`; add two popups (`StrikeAttackModal`, source-agnostic `StrikeDamageModal`) opened from `ActionsTab` (tab) and `ChatTab` (card). PF2e posts all the real cards through the existing chat feed.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest (node env — stub `PointerEvent`), Tailwind v4 (preflight off). Live PF2e v8.2 / Foundry v14.

**Spec:** `docs/superpowers/specs/2026-06-12-phase-4-strike-interactions-design.md` (Slice A.2a). Slice A.2b (attack modifier-toggle) gets its own plan after this slice's checkpoint.

**Conventions:**
- Commits: subject `Phase 4 (Task N): …`, trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`, directly to `main`.
- Tailwind-v4 button gotcha: solid `bg-*` fills (never `border`), `justify-start` on left-aligned flex buttons. Verify visuals in the real app.
- Pure logic (mappers, the `cardInteractions` classifier) is unit-tested; guarded live wrappers are stub-tested (assert the call + never-throws); components are verified by typecheck + production build + the manual checklist.

---

### Task 1: Mapper — `auxiliaryActions` + `modifiers` on `StrikeView`

**Files:**
- Modify: `src/foundry/actor/types.ts`
- Modify: `src/foundry/actor/strikes.ts`
- Test: `tests/strikesView.test.ts`

- [ ] **Step 1: Add the failing test** — append inside the existing `describe("buildStrikesView", …)` in `tests/strikesView.test.ts` (before its closing `});`):

```ts
  it("maps auxiliary actions and enabled modifiers (dropping hidden-disabled ones)", () => {
    const actor: StrikeActorLike = {
      system: {
        actions: [
          strike({
            auxiliaryActions: [
              { label: "Draw", glyph: "1" },
              { label: "Change Grip", glyph: "1" },
            ],
            modifiers: [
              { slug: "prof", label: "Proficiency", modifier: 9, enabled: true },
              { slug: "rune", label: "Potency", modifier: 1, enabled: true, hideIfDisabled: true },
              { slug: "off", label: "Inactive", modifier: 2, enabled: false, hideIfDisabled: true },
            ],
          }),
        ],
      },
    };
    const v = buildStrikesView(actor);
    expect(v[0].auxiliaryActions).toEqual([
      { label: "Draw", glyph: "1" },
      { label: "Change Grip", glyph: "1" },
    ]);
    expect(v[0].modifiers).toEqual([
      { slug: "prof", label: "Proficiency", value: 9, enabled: true },
      { slug: "rune", label: "Potency", value: 1, enabled: true },
    ]);
  });

  it("defaults auxiliaryActions and modifiers to [] when absent", () => {
    const v = buildStrikesView({ system: { actions: [strike()] } });
    expect(v[0].auxiliaryActions).toEqual([]);
    expect(v[0].modifiers).toEqual([]);
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- strikesView`
Expected: FAIL — `v[0].auxiliaryActions`/`v[0].modifiers` are `undefined` (not yet mapped); type errors on the fixture's new fields.

- [ ] **Step 3: Extend the types** in `src/foundry/actor/types.ts`.

In the `StrikeView` interface, add two fields after `variants`:

```ts
  variants: StrikeVariantView[];
  auxiliaryActions: StrikeAuxView[];
  modifiers: StrikeModView[];
  hasDamage: boolean;
  hasCritical: boolean;
```

Add the two view types right after `StrikeVariantView`:

```ts
/** A strike auxiliary action (draw / sheathe / change grip / retrieve …). */
export interface StrikeAuxView { label: string; glyph: string | null; }
/** One row of the attack breakdown; `slug` identifies it for the A.2b toggle. */
export interface StrikeModView { slug: string; label: string; value: number; enabled: boolean; }
```

Extend the source `StrikeLike` with the two live fields (add after `critical?: unknown;`):

```ts
  auxiliaryActions?: { label?: string; glyph?: string }[];
  modifiers?: { slug?: string; label?: string; modifier?: number; enabled?: boolean; ignored?: boolean; hideIfDisabled?: boolean }[];
```

- [ ] **Step 4: Map them** in `src/foundry/actor/strikes.ts`.

Add a glyph helper after `mapVariants`:

```ts
/** PF2e's auxiliary-action glyph → our ActionGlyph code when recognised, else null
 *  (the row just shows its label). Aux actions are typically 1-action. */
function auxGlyph(g: string | undefined): string | null {
  if (g === "1" || g === "2" || g === "3" || g === "reaction" || g === "free") return g;
  return null;
}
```

In `buildStrikesView`, add the two fields to the pushed object (between `variants` and `hasDamage`):

```ts
      variants: mapVariants(s.variants),
      auxiliaryActions: (s.auxiliaryActions ?? [])
        .map((a) => ({ label: a.label ?? "", glyph: auxGlyph(a.glyph) }))
        .filter((a) => a.label),
      modifiers: (s.modifiers ?? [])
        .filter((m) => m.enabled || !m.hideIfDisabled)
        .map((m) => ({ slug: m.slug ?? "", label: m.label ?? "", value: m.modifier ?? 0, enabled: m.enabled ?? false })),
      hasDamage: typeof s.damage === "function",
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test -- strikesView`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/foundry/actor/types.ts src/foundry/actor/strikes.ts tests/strikesView.test.ts
git commit -m "Phase 4 (Task 1): map strike auxiliaryActions + modifiers" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `cardInteractions` — classify `strike-damage`

**Files:**
- Modify: `src/foundry/chat/cardInteractions.ts`
- Test: `tests/cardInteractions.test.ts`

- [ ] **Step 1: Add the failing test** — append inside `describe("interactionFromControl", …)` in `tests/cardInteractions.test.ts`:

```ts
  it("maps a strike-damage button (success) to a non-critical strike-damage interaction", () => {
    expect(interactionFromControl({ action: "strike-damage", save: null, dc: null, uuid: null, outcome: "success" }, "m1"))
      .toEqual({ kind: "strike-damage", messageId: "m1", critical: false });
  });

  it("maps a strike-damage button (criticalSuccess) to a critical strike-damage interaction", () => {
    expect(interactionFromControl({ action: "strike-damage", save: null, dc: null, uuid: null, outcome: "criticalSuccess" }, "m1"))
      .toEqual({ kind: "strike-damage", messageId: "m1", critical: true });
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- cardInteractions`
Expected: FAIL — `interactionFromControl` returns `null` for `strike-damage` (and the `outcome` field isn't in the param type).

- [ ] **Step 3: Implement** — edit `src/foundry/chat/cardInteractions.ts`.

Add the new variant to the `CardInteraction` union:

```ts
export type CardInteraction =
  | { kind: "damage"; messageId: string }
  | { kind: "save"; messageId: string; saveType: string; dc: number }
  | { kind: "effect"; uuid: string }
  | { kind: "strike-damage"; messageId: string; critical: boolean };
```

Update `interactionFromControl` — add `outcome` to the param type and a `strike-damage` branch:

```ts
export function interactionFromControl(
  c: { action: string | null; save: string | null; dc: string | null; uuid: string | null; outcome?: string | null },
  messageId: string,
): CardInteraction | null {
  if (c.uuid && c.uuid.includes("spell-effects")) return { kind: "effect", uuid: c.uuid };
  if (c.action === "spell-damage") return { kind: "damage", messageId };
  if (c.action === "strike-damage") return { kind: "strike-damage", messageId, critical: c.outcome === "criticalSuccess" };
  if (c.action === "spell-save") {
    const dc = Number(c.dc);
    // dc must be a positive integer; a missing/empty data-dc (Number("") === 0) is rejected
    if (c.save && Number.isInteger(dc) && dc > 0) return { kind: "save", messageId, saveType: c.save, dc };
  }
  return null;
}
```

Add `strike-damage` to the selector and read `data-outcome` in `classifyCardClick`:

```ts
const CONTROL_SELECTOR =
  'button[data-action="spell-damage"],button[data-action="spell-save"],button[data-action="strike-damage"],a[data-uuid]';
export function classifyCardClick(target: Element | null, messageId: string): CardInteraction | null {
  const el = target?.closest<HTMLElement>(CONTROL_SELECTOR);
  if (!el) return null;
  return interactionFromControl(
    {
      action: el.getAttribute("data-action"),
      save: el.getAttribute("data-save"),
      dc: el.getAttribute("data-dc"),
      uuid: el.getAttribute("data-uuid"),
      outcome: el.getAttribute("data-outcome"),
    },
    messageId,
  );
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test -- cardInteractions`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/chat/cardInteractions.ts tests/cardInteractions.test.ts
git commit -m "Phase 4 (Task 2): classify strike-damage card controls (damage/crit)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `strikeChatActions.ts` — roll/preview damage from a posted attack card

**Files:**
- Create: `src/foundry/actor/strikeChatActions.ts`
- Test: `tests/strikeChatActions.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/strikeChatActions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { rollAttackCardDamage, previewAttackCardDamage, attackCardLabel } from "../src/foundry/actor/strikeChatActions";

interface Call { method: string; args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const formulaFor = (m: string, a: unknown[]) => ((a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8 slashing" : "1d8+4 slashing") : undefined);
  const strike = {
    label: "Longsword",
    damage: (...a: unknown[]) => { calls.push({ method: "damage", args: a }); return Promise.resolve(formulaFor("damage", a)); },
    critical: (...a: unknown[]) => { calls.push({ method: "critical", args: a }); return Promise.resolve(formulaFor("critical", a)); },
  };
  const message = { _attack: strike, item: { name: "Longsword" } };
  (globalThis as { game?: unknown }).game = {
    messages: { get: (id: string) => (id === "m1" ? message : null) },
    user: { settings: { showDamageDialogs: false } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { PointerEvent?: unknown }).PointerEvent = class {
    shiftKey: boolean;
    constructor(public type: string, init?: { shiftKey?: boolean }) { this.shiftKey = !!init?.shiftKey; }
  } as unknown;
  return calls;
}

describe("strike chat actions", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls damage via the message's resolved strike with a click event", async () => {
    await rollAttackCardDamage("m1");
    expect(calls[0].method).toBe("damage");
    expect((calls[0].args[0] as { event?: { type?: string } }).event?.type).toBe("click");
  });

  it("rolls critical when critical:true", async () => {
    await rollAttackCardDamage("m1", { critical: true });
    expect(calls[0].method).toBe("critical");
  });

  it("previews the damage formula without rolling (getFormula)", async () => {
    expect(await previewAttackCardDamage("m1")).toBe("1d8+4 slashing");
    expect((calls[0].args[0] as { getFormula?: boolean }).getFormula).toBe(true);
  });

  it("returns the strike label for the popup title", () => {
    expect(attackCardLabel("m1")).toBe("Longsword");
  });

  it("never throws / returns null when the message has no strike", async () => {
    await expect(rollAttackCardDamage("missing")).resolves.toBeUndefined();
    expect(await previewAttackCardDamage("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- strikeChatActions`
Expected: FAIL — `Cannot find module '../src/foundry/actor/strikeChatActions'`.

- [ ] **Step 3: Write `src/foundry/actor/strikeChatActions.ts`**

```ts
/** Live strike-card actions driven from the mobile chat feed. Guarded like
 *  `spells/chatActions.ts`. A posted attack card's Damage/Crit buttons are dead on
 *  mobile (their native handlers target a canvas token / a suppressed dialog), so
 *  we resolve the strike from the message and roll it ourselves. PF2e posts the
 *  resulting damage card, which flows through the existing chat feed. */

type Dict = Record<string, unknown>;

interface LiveStrike {
  label?: string;
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
}

/** Resolve the strike a posted attack message came from. PF2e exposes `_attack`
 *  (its own resolver); fall back to matching the roll/context `identifier`
 *  ("<itemId>.<slug>.<melee|ranged>") against the speaker actor's prepared strikes. */
function resolveAttack(messageId: string): LiveStrike | null {
  const msg = (game as any)?.messages?.get(messageId);
  if (!msg) return null;
  const direct = msg._attack as LiveStrike | undefined;
  if (direct) return direct;
  const actor = msg.speakerActor ?? (game as any)?.actors?.get(msg.speaker?.actor);
  const context = msg.flags?.pf2e?.context;
  const roll = (msg.rolls ?? []).find((r: any) => r?.options?.identifier);
  const identifier: string | undefined = roll?.options?.identifier ?? context?.identifier;
  const [itemId, slug] = identifier?.split(".") ?? [];
  const strike = (actor?.system?.actions ?? []).find((s: any) => s.slug === slug && s.item?.id === itemId);
  return (strike as LiveStrike) ?? null;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] strike card action failed", err);
    (ui as any)?.notifications?.error?.("Strike action failed — see console.");
  }
}

function damageEvent(): Dict {
  const show = !!(game as any)?.user?.settings?.showDamageDialogs;
  return { event: new PointerEvent("click", { shiftKey: show }) };
}

/** Roll damage (or critical) for a posted attack card. */
export function rollAttackCardDamage(messageId: string, opts: { critical?: boolean } = {}): Promise<void> {
  return guard(() => {
    const strike = resolveAttack(messageId);
    const method = opts.critical ? strike?.critical : strike?.damage;
    if (!strike || !method) throw new Error(`no strike damage on message ${messageId}`);
    return method.call(strike, damageEvent());
  });
}

/** Preview the damage/critical formula for a posted attack card without rolling. */
export async function previewAttackCardDamage(messageId: string, opts: { critical?: boolean } = {}): Promise<string | null> {
  try {
    const strike = resolveAttack(messageId);
    const method = opts.critical ? strike?.critical : strike?.damage;
    if (!strike || !method) return null;
    const formula = await method.call(strike, { getFormula: true });
    return typeof formula === "string" ? formula : null;
  } catch (err) {
    console.error("[pf2e-mobile] strike damage preview failed", err);
    return null;
  }
}

/** The strike/weapon name for a posted attack card (popup title). */
export function attackCardLabel(messageId: string): string {
  const msg = (game as any)?.messages?.get(messageId);
  return resolveAttack(messageId)?.label ?? msg?.item?.name ?? "Strike";
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test -- strikeChatActions`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/strikeChatActions.ts tests/strikeChatActions.test.ts
git commit -m "Phase 4 (Task 3): roll/preview strike damage from a posted attack card" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `strikeActions` — `runAuxiliaryAction` + `previewStrikeDamage`

**Files:**
- Modify: `src/foundry/actor/strikeActions.ts`
- Test: `tests/strikeActions.test.ts`

- [ ] **Step 1: Update the stub + add failing tests** in `tests/strikeActions.test.ts`.

Replace the `strike` object in `stub()` so damage/critical return a formula under `getFormula` and the strike has an auxiliary action:

```ts
  const formulaFor = (m: string, a: unknown[]) => ((a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8" : "1d8+4") : undefined);
  const strike = {
    slug: "longsword",
    variants: [variant(0), variant(1), variant(2)],
    damage: (...args: unknown[]) => { calls.push({ method: "damage", args }); return Promise.resolve(formulaFor("damage", args)); },
    critical: (...args: unknown[]) => { calls.push({ method: "critical", args }); return Promise.resolve(formulaFor("critical", args)); },
    auxiliaryActions: [{ execute: (...args: unknown[]) => { calls.push({ method: "aux.execute", args }); return Promise.resolve(); } }],
  };
```

Update the imports line to include the new functions:

```ts
import { rollStrikeAttack, rollStrikeDamage, rollStrikeCritical, runAuxiliaryAction, previewStrikeDamage } from "../src/foundry/actor/strikeActions";
```

Add tests inside `describe("strike actions", …)`:

```ts
  it("runs an auxiliary action by index", async () => {
    await runAuxiliaryAction("a", 0, 0);
    expect(calls.map((c) => c.method)).toEqual(["aux.execute"]);
  });

  it("previews damage and critical formulas without rolling", async () => {
    expect(await previewStrikeDamage("a", 0, false)).toBe("1d8+4");
    expect(await previewStrikeDamage("a", 0, true)).toBe("2d8+8");
  });

  it("aux/preview never throw when missing", async () => {
    await expect(runAuxiliaryAction("a", 0, 9)).resolves.toBeUndefined();
    expect(await previewStrikeDamage("a", 99, false)).toBeNull();
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- strikeActions`
Expected: FAIL — `runAuxiliaryAction`/`previewStrikeDamage` are not exported.

- [ ] **Step 3: Implement** in `src/foundry/actor/strikeActions.ts`.

Extend the `LiveStrike` interface with the aux array:

```ts
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
  auxiliaryActions?: { execute(args?: Dict): Promise<unknown> }[];
}
```

Append the two functions at the end of the file:

```ts
/** Run a strike's auxiliary action (draw / sheathe / change grip / retrieve …) by
 *  index. It mutates equip state → the `updateItem` hook refreshes the card. */
export function runAuxiliaryAction(actorId: string, strikeIndex: number, auxIndex: number): Promise<void> {
  return guard(() => {
    const aux = getStrike(actorId, strikeIndex).auxiliaryActions?.[auxIndex];
    if (!aux) throw new Error(`no auxiliary action ${auxIndex} on strike ${strikeIndex}`);
    return aux.execute();
  });
}

/** Preview a strike's damage/critical formula without rolling (for the prompt). */
export async function previewStrikeDamage(actorId: string, strikeIndex: number, critical: boolean): Promise<string | null> {
  try {
    const strike = getStrike(actorId, strikeIndex);
    const method = critical ? strike.critical : strike.damage;
    if (!method) return null;
    const formula = await method.call(strike, { getFormula: true });
    return typeof formula === "string" ? formula : null;
  } catch (err) {
    console.error("[pf2e-mobile] strike damage preview failed", err);
    return null;
  }
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test -- strikeActions`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/strikeActions.ts tests/strikeActions.test.ts
git commit -m "Phase 4 (Task 4): runAuxiliaryAction + previewStrikeDamage" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `StrikeDamageModal` + `StrikeAttackModal`

**Files:**
- Create: `src/app/actions/StrikeDamageModal.tsx`
- Create: `src/app/actions/StrikeAttackModal.tsx`

No unit test — presentational popups, verified by typecheck + build + manual checklist.

- [ ] **Step 1: Write `src/app/actions/StrikeDamageModal.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Modal } from "../sheet/parts/Modal";

/** Damage/crit roll prompt. Source-agnostic: the caller supplies a formula loader
 *  (PF2e's getFormula) and a roll trigger, so the Actions tab and the chat attack
 *  card share it. Mirrors the spell DamageRollModal. */
export function StrikeDamageModal({
  title,
  rollLabel = "Roll Damage",
  loadFormula,
  onRoll,
  onClose,
}: {
  title: string;
  rollLabel?: string;
  loadFormula: () => Promise<string | null>;
  onRoll: () => void;
  onClose: () => void;
}) {
  const [formula, setFormula] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadFormula().then((f) => { if (alive) setFormula(f); }).catch(() => {});
    return () => { alive = false; };
    // Runs once per open; loadFormula closes over the chosen strike/message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const roll = () => { onRoll(); onClose(); };
  return (
    <Modal title={title} onClose={onClose}>
      {formula && (
        <div className="mb-3 text-sm text-zinc-300">
          Damage: <span className="font-semibold">{formula}</span>
        </div>
      )}
      <button onClick={roll} className="min-h-12 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
        {rollLabel}
      </button>
    </Modal>
  );
}
```

- [ ] **Step 2: Write `src/app/actions/StrikeAttackModal.tsx`**

```tsx
import { Modal } from "../sheet/parts/Modal";
import type { StrikeView } from "../../foundry/actor/types";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Attack roll prompt: the strike's modifier breakdown + the chosen MAP variant's
 *  total + a Roll button. Read-only in A.2a; per-modifier toggles arrive in A.2b. */
export function StrikeAttackModal({
  strike,
  variantIndex,
  onRoll,
  onClose,
}: {
  strike: StrikeView;
  variantIndex: number;
  onRoll: () => void;
  onClose: () => void;
}) {
  const variant = strike.variants[variantIndex];
  const roll = () => { onRoll(); onClose(); };
  return (
    <Modal title={strike.label} onClose={onClose}>
      <div className="divide-y divide-zinc-800">
        {strike.modifiers.map((m, i) => (
          <div key={i} className={`flex items-center justify-between px-1 py-2 text-sm ${m.enabled ? "" : "opacity-40"}`}>
            <span className="text-zinc-300">{m.label}</span>
            <span className="font-semibold tabular-nums">{sign(m.value)}</span>
          </div>
        ))}
        {variant.penalty !== 0 && (
          <div className="flex items-center justify-between px-1 py-2 text-sm">
            <span className="text-zinc-300">Multiple Attack Penalty</span>
            <span className="font-semibold tabular-nums">{variant.penalty}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-700 px-1 pt-2">
        <span className="font-semibold">Attack</span>
        <span className="text-lg font-bold tabular-nums">{variant.label}</span>
      </div>
      <button onClick={roll} className="mt-3 min-h-12 w-full rounded-md bg-indigo-600 font-semibold text-white">
        Roll {variant.label}
      </button>
    </Modal>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/StrikeDamageModal.tsx src/app/actions/StrikeAttackModal.tsx
git commit -m "Phase 4 (Task 5): StrikeDamageModal + StrikeAttackModal popups" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `StrikeCard` aux row + `ActionsTab` opens the prompts

**Files:**
- Modify: `src/app/actions/StrikeCard.tsx`
- Modify: `src/app/tabs/ActionsTab.tsx`

No unit test — verified by typecheck + build + manual checklist.

- [ ] **Step 1: Rewrite `src/app/actions/StrikeCard.tsx`** (adds the `onAux` prop + aux-action row; attack/damage/crit buttons keep their callbacks — the parent now opens prompts):

```tsx
import type { StrikeView } from "../../foundry/actor/types";
import { ActionGlyph } from "../sheet/parts/ActionGlyph";

/** One strike: img + name + glyph + ready dot, traits, auxiliary-action row, three
 *  MAP attack buttons, then Damage + Crit. Buttons call up to ActionsTab, which
 *  opens the roll prompts. Solid `bg-*` fills per the Tailwind-v4 button gotchas. */
export function StrikeCard({
  strike,
  onAttack,
  onDamage,
  onCritical,
  onAux,
}: {
  strike: StrikeView;
  onAttack: (variantIndex: number) => void;
  onDamage: () => void;
  onCritical: () => void;
  onAux: (auxIndex: number) => void;
}) {
  return (
    <section className={`border-b border-zinc-800 px-3 py-2 ${strike.ready ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-2">
        {strike.img && <img src={strike.img} alt="" className="h-7 w-7 rounded object-cover" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{strike.label}</span>
        <ActionGlyph code={strike.glyph} />
        <span
          className={`shrink-0 text-[10px] font-medium ${strike.ready ? "text-emerald-400" : "text-zinc-500"}`}
          title={strike.ready ? "Ready" : "Not equipped"}
        >
          {strike.ready ? "● ready" : "○ not ready"}
        </span>
      </div>

      {strike.traits.length > 0 && (
        <div className="mt-0.5 truncate text-[11px] capitalize text-zinc-400">{strike.traits.join(", ")}</div>
      )}

      {strike.auxiliaryActions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {strike.auxiliaryActions.map((a, i) => (
            <button
              key={i}
              onClick={() => onAux(i)}
              className="flex items-center gap-1 rounded-md bg-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-100"
            >
              <span>{a.label}</span>
              <ActionGlyph code={a.glyph} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Attack</span>
        {strike.variants.map((v, i) => (
          <button
            key={i}
            onClick={() => onAttack(i)}
            className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-sm font-semibold text-white"
          >
            {v.label}
          </button>
        ))}
      </div>

      {(strike.hasDamage || strike.hasCritical) && (
        <div className="mt-2 flex gap-2">
          {strike.hasDamage && (
            <button onClick={onDamage} className="flex-1 rounded-md bg-zinc-700 px-2 py-1.5 text-sm font-medium text-zinc-100">
              Damage
            </button>
          )}
          {strike.hasCritical && (
            <button onClick={onCritical} className="flex-1 rounded-md bg-amber-700 px-2 py-1.5 text-sm font-medium text-amber-50">
              Crit
            </button>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/tabs/ActionsTab.tsx`** (owns the active-prompt state, renders the modals, wires aux actions):

```tsx
import { useState } from "react";
import { useAppStore } from "../store";
import { useStrikes } from "../actions/useStrikes";
import { StrikeCard } from "../actions/StrikeCard";
import { StrikeAttackModal } from "../actions/StrikeAttackModal";
import { StrikeDamageModal } from "../actions/StrikeDamageModal";
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
} from "../../foundry/actor/strikeActions";
import type { StrikeView } from "../../foundry/actor/types";

type Section = "strikes" | "actions";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "strikes", label: "Strikes" },
  { id: "actions", label: "Actions" },
];

type Prompt = { strike: StrikeView; kind: "attack" | "damage" | "crit"; variantIndex: number };

/** The bottom Actions tab — mirrors PF2e's char-sheet Actions tab. Strikes section:
 *  cards open roll prompts (attack breakdown / damage formula) before rolling, and
 *  expose auxiliary actions. Actions list + toggles land in Slice B. */
export function ActionsTab() {
  const actorId = useAppStore((s) => s.actorId);
  const [section, setSection] = useState<Section>("strikes");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const strikes = useStrikes(actorId ?? "");

  if (!actorId) return <div className="p-4 text-sm text-zinc-500">No character selected.</div>;

  return (
    <div>
      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-9 whitespace-nowrap rounded-md px-3 text-xs font-medium ${
              section === s.id ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === "strikes" &&
        (strikes === null ? (
          <div className="p-4 text-sm text-zinc-500">Loading strikes…</div>
        ) : strikes.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No strikes.</div>
        ) : (
          strikes.map((s) => (
            <StrikeCard
              key={`${s.slug}-${s.index}`}
              strike={s}
              onAttack={(vi) => setPrompt({ strike: s, kind: "attack", variantIndex: vi })}
              onDamage={() => setPrompt({ strike: s, kind: "damage", variantIndex: 0 })}
              onCritical={() => setPrompt({ strike: s, kind: "crit", variantIndex: 0 })}
              onAux={(ai) => void runAuxiliaryAction(actorId, s.index, ai)}
            />
          ))
        ))}

      {section === "actions" && (
        <div className="p-4 text-sm text-zinc-500">Actions list &amp; toggles — coming next (Slice B).</div>
      )}

      {prompt?.kind === "attack" && (
        <StrikeAttackModal
          strike={prompt.strike}
          variantIndex={prompt.variantIndex}
          onRoll={() => void rollStrikeAttack(actorId, prompt.strike.index, prompt.variantIndex)}
          onClose={() => setPrompt(null)}
        />
      )}
      {(prompt?.kind === "damage" || prompt?.kind === "crit") && (
        <StrikeDamageModal
          title={prompt.strike.label}
          rollLabel={prompt.kind === "crit" ? "Roll Critical" : "Roll Damage"}
          loadFormula={() => previewStrikeDamage(actorId, prompt.strike.index, prompt.kind === "crit")}
          onRoll={() =>
            void (prompt.kind === "crit"
              ? rollStrikeCritical(actorId, prompt.strike.index)
              : rollStrikeDamage(actorId, prompt.strike.index))
          }
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/StrikeCard.tsx src/app/tabs/ActionsTab.tsx
git commit -m "Phase 4 (Task 6): strike cards open roll prompts + auxiliary-action row" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `ChatTab` — Damage/Crit from the attack card

**Files:**
- Modify: `src/app/tabs/ChatTab.tsx`

No unit test — verified by typecheck + build + manual checklist.

- [ ] **Step 1: Add the imports** to `src/app/tabs/ChatTab.tsx` (after the existing modal imports):

```tsx
import { StrikeDamageModal } from "../actions/StrikeDamageModal";
import { rollAttackCardDamage, previewAttackCardDamage, attackCardLabel } from "../../foundry/actor/strikeChatActions";
```

- [ ] **Step 2: Render the strike-damage popup.** In the popup block at the bottom of the returned JSX, add this branch alongside the existing `damage`/`save`/`effect` ones (it does not need `actorId`):

```tsx
      {popup?.kind === "strike-damage" && (
        <StrikeDamageModal
          title={attackCardLabel(popup.messageId)}
          rollLabel={popup.critical ? "Roll Critical" : "Roll Damage"}
          loadFormula={() => previewAttackCardDamage(popup.messageId, { critical: popup.critical })}
          onRoll={() => void rollAttackCardDamage(popup.messageId, { critical: popup.critical })}
          onClose={close}
        />
      )}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both clean (the `CardInteraction` union from Task 2 makes `popup.critical` type-safe under the `strike-damage` narrowing).

- [ ] **Step 4: Commit**

```bash
git add src/app/tabs/ChatTab.tsx
git commit -m "Phase 4 (Task 7): roll strike damage/crit from the attack chat card" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Full verification + live checkpoint (A.2a)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS — prior 117 + new (2 `strikesView` + 2 `cardInteractions` + 5 `strikeChatActions` + 3 `strikeActions`) = **129**.

- [ ] **Step 2: Typecheck + production build**

Run: `npm run typecheck` then `npm run build`
Expected: both clean.

- [ ] **Step 3: Manual live checklist** (Player1, mobile viewport; a strike-bearing actor):

- [ ] Each strike shows an auxiliary-action row (Draw / Sheathe / Change Grip as appropriate); tapping one changes the weapon's state and the `ready` dot/aux buttons update within ~1s.
- [ ] Tapping a MAP attack button opens the **attack prompt** (modifier breakdown + the variant total); tapping **Roll** posts the attack card with the correct bonus.
- [ ] Tapping **Damage**/**Crit** on the tab opens the **damage prompt** (formula shown); Roll posts the damage/crit card. No dialog hangs.
- [ ] On a posted **attack card in the Chat tab**, tapping its **Damage**/**Critical** opens the damage prompt and rolls (crit vs normal correct).
- [ ] **Imaginary Weapon** homebrew: its modifiers show in the attack breakdown; damage rolls through the card.

- [ ] **Step 4: Report results and pause.** This is the A.2a checkpoint — on approval, write the Slice A.2b plan (attack modifier-toggle) from the spec.

---

## Self-review

**Spec coverage (A.2a):** ① aux actions → mapper (T1) + `runAuxiliaryAction` (T4) + card row (T6); ② chat-card damage → `cardInteractions` (T2) + `strikeChatActions` (T3) + `ChatTab` (T7); ③ tab damage prompt → `previewStrikeDamage` (T4) + `StrikeDamageModal` (T5) + `ActionsTab` (T6); ③ tab attack prompt (read-only) → `modifiers` mapping (T1) + `StrikeAttackModal` (T5) + `ActionsTab` (T6). The A.2b modifier-toggle (`previewStrikeAttack`, `disabledSlugs`, checkboxes) is intentionally out of this plan. ✓ no gaps.

**Placeholder scan:** none — every code step is complete; "coming next (Slice B)" is shipped UI copy. ✓

**Type consistency:** `StrikeAuxView`/`StrikeModView` defined in T1 and consumed in `StrikeAttackModal`/`StrikeCard` (T5/T6). `CardInteraction` `strike-damage` variant (`{messageId, critical}`) defined T2, consumed in `ChatTab` (T7). `rollAttackCardDamage`/`previewAttackCardDamage`/`attackCardLabel` signatures match between T3 and T7. `runAuxiliaryAction(actorId, strikeIndex, auxIndex)` and `previewStrikeDamage(actorId, strikeIndex, critical)` match between T4 and T6. `StrikeDamageModal` props (`title`, `rollLabel`, `loadFormula`, `onRoll`, `onClose`) match its two call sites (T6, T7). ✓
