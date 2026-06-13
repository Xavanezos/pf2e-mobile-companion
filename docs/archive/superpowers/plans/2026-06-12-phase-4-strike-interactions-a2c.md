# Phase 4 — Strike Interactions Slice A.2c (Ranged Ammunition) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ammunition `<select>` to ranged-weapon strike cards (bow/crossbow/sling) that sets the weapon's selected ammo; PF2e auto-consumes a round on the attack roll.

**Architecture:** Extend `buildStrikesView` with an `ammo` field from the prepared `strike.ammunition` (null for melee/thrown); add a guarded `setStrikeAmmo` that updates the live weapon item's `system.selectedAmmoId`; `StrikeCard` renders the dropdown and disables attacks when unloaded. Consumption and rolling are unchanged.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest (node env), Tailwind v4. Live PF2e v8.2 / Foundry v14.

**Spec:** `docs/superpowers/specs/2026-06-12-phase-4-strike-interactions-design.md` → "Slice A.2c — ranged ammunition selector".

**Conventions:** commits `Phase 4 (Task N): …` + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer, to `main`. Pure logic unit-tested; guarded wrapper stub-tested; components via typecheck + build + manual checklist. `<select>` is not subject to the Tailwind-v4 `<button>` reset, so it styles normally.

---

### Task 1: Mapper — `ammo` on `StrikeView`

**Files:**
- Modify: `src/foundry/actor/types.ts`
- Modify: `src/foundry/actor/strikes.ts`
- Test: `tests/strikesView.test.ts`

- [ ] **Step 1: Add the failing test** — append inside `describe("buildStrikesView", …)` in `tests/strikesView.test.ts`:

```ts
  it("maps ranged ammunition (options/selected/remaining) and null for non-ammo strikes", () => {
    const ranged = strike({
      slug: "longbow",
      ammunition: {
        compatible: [
          { id: "arrows", label: "Arrows (19)" },
          { id: "cold-iron", label: "Cold Iron Arrows (10)" },
        ],
        selected: { id: "arrows" },
        remaining: 19,
      },
    });
    const v = buildStrikesView({ system: { actions: [ranged, strike({ slug: "fist" })] } });
    expect(v[0].ammo).toEqual({
      options: [
        { id: "arrows", label: "Arrows (19)" },
        { id: "cold-iron", label: "Cold Iron Arrows (10)" },
      ],
      selectedId: "arrows",
      remaining: 19,
    });
    expect(v[1].ammo).toBeNull();
  });

  it("falls back to selectedAmmoId and remaining 0 when ammunition.selected is absent", () => {
    const ranged = strike({ slug: "sling", selectedAmmoId: "bullets", ammunition: { compatible: [{ id: "bullets", label: "Bullets (5)" }] } });
    const v = buildStrikesView({ system: { actions: [ranged] } });
    expect(v[0].ammo).toEqual({ options: [{ id: "bullets", label: "Bullets (5)" }], selectedId: "bullets", remaining: 0 });
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- strikesView`
Expected: FAIL — `v[0].ammo` is `undefined`; type errors on the fixture's `ammunition`/`selectedAmmoId`.

- [ ] **Step 3: Extend the types** in `src/foundry/actor/types.ts`.

Add the view type after `StrikeModView`:

```ts
/** Ranged ammunition for a strike's `<select>`; null for melee/thrown weapons. */
export interface StrikeAmmoView { options: { id: string; label: string }[]; selectedId: string | null; remaining: number; }
```

Add `ammo` to `StrikeView` (after `modifiers`):

```ts
  modifiers: StrikeModView[];
  ammo: StrikeAmmoView | null;
  hasDamage: boolean;
```

Extend `StrikeLike` (after the `modifiers?: …` line):

```ts
  selectedAmmoId?: string | null;
  ammunition?: {
    compatible?: { id: string; label: string }[];
    selected?: { id: string } | null;
    remaining?: number;
  } | null;
```

- [ ] **Step 4: Map it** in `src/foundry/actor/strikes.ts`.

Add a helper after `auxGlyph`:

```ts
/** Ranged ammo for the strike card. `strike.ammunition` is null for melee/thrown
 *  (PF2e's `getAttackAmmo` returns null when the weapon doesn't expend ammo). */
function mapAmmo(s: StrikeLike): StrikeView["ammo"] {
  const a = s.ammunition;
  if (!a) return null;
  return {
    options: (a.compatible ?? []).map((o) => ({ id: o.id, label: o.label })),
    selectedId: a.selected?.id ?? s.selectedAmmoId ?? null,
    remaining: a.remaining ?? 0,
  };
}
```

In `buildStrikesView`, add the field (after `modifiers: …`):

```ts
      modifiers: (s.modifiers ?? [])
        .filter((m) => m.enabled || !m.hideIfDisabled)
        .map((m) => ({ slug: m.slug ?? "", label: m.label ?? "", value: m.modifier ?? 0, enabled: m.enabled ?? false })),
      ammo: mapAmmo(s),
      hasDamage: typeof s.damage === "function",
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test -- strikesView`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/foundry/actor/types.ts src/foundry/actor/strikes.ts tests/strikesView.test.ts
git commit -m "Phase 4 (Task 1): map ranged strike ammunition" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `setStrikeAmmo` action

**Files:**
- Modify: `src/foundry/actor/strikeActions.ts`
- Test: `tests/strikeActions.test.ts`

- [ ] **Step 1: Update the stub + add failing tests** in `tests/strikeActions.test.ts`.

Add a `item` with an `update` recorder to the `strike` object in `stub()` (after `auxiliaryActions: …`):

```ts
    auxiliaryActions: [{ execute: (...args: unknown[]) => { calls.push({ method: "aux.execute", args }); return Promise.resolve(); } }],
    item: { id: "w1", update: (...args: unknown[]) => { calls.push({ method: "item.update", args }); return Promise.resolve(); } },
```

Add `setStrikeAmmo` to the import line:

```ts
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  setStrikeAmmo,
} from "../src/foundry/actor/strikeActions";
```

Add tests inside `describe("strike actions", …)`:

```ts
  it("sets the selected ammo on the strike's weapon item", async () => {
    await setStrikeAmmo("a", 0, "ammo1");
    expect(calls[0].method).toBe("item.update");
    expect(calls[0].args[0]).toEqual({ system: { selectedAmmoId: "ammo1" } });
  });

  it("clears ammo with null", async () => {
    await setStrikeAmmo("a", 0, null);
    expect(calls[0].args[0]).toEqual({ system: { selectedAmmoId: null } });
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm run test -- strikeActions`
Expected: FAIL — `setStrikeAmmo` is not exported.

- [ ] **Step 3: Implement** in `src/foundry/actor/strikeActions.ts`.

Extend the `LiveStrike` interface with the weapon item:

```ts
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
  auxiliaryActions?: { execute(args?: Dict): Promise<unknown> }[];
  item?: { update(data: Dict): Promise<unknown> };
}
```

Append the function:

```ts
/** Set (or clear, with null) the selected ammunition on a ranged strike's weapon.
 *  PF2e auto-consumes a round on the attack roll, so rolling is unchanged. */
export function setStrikeAmmo(actorId: string, strikeIndex: number, ammoId: string | null): Promise<void> {
  return guard(() => {
    const weapon = getStrike(actorId, strikeIndex).item;
    if (!weapon?.update) throw new Error(`strike ${strikeIndex} has no weapon item`);
    return weapon.update({ system: { selectedAmmoId: ammoId } });
  });
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test -- strikeActions`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/strikeActions.ts tests/strikeActions.test.ts
git commit -m "Phase 4 (Task 2): setStrikeAmmo (update weapon selectedAmmoId)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `StrikeCard` ammo dropdown + `ActionsTab` wiring

**Files:**
- Modify: `src/app/actions/StrikeCard.tsx`
- Modify: `src/app/tabs/ActionsTab.tsx`

No unit test — verified by typecheck + build + manual checklist.

- [ ] **Step 1: Add the dropdown + attack-disable to `src/app/actions/StrikeCard.tsx`.**

Add `onSetAmmo` to the props type (after `onAux`):

```ts
  onAux: (auxIndex: number) => void;
  onSetAmmo: (ammoId: string | null) => void;
```

Compute the disabled state at the top of the component body (before `return`):

```tsx
  const ammo = strike.ammo;
  const unloaded = !!ammo && (ammo.selectedId == null || ammo.remaining < 1);
```

Insert the dropdown block between the auxiliary-action row and the attack row (i.e. immediately before the `<div className="mt-2 flex items-center gap-2">` that holds the Attack label):

```tsx
      {ammo && (
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Ammo</span>
          <select
            value={ammo.selectedId ?? ""}
            onChange={(e) => onSetAmmo(e.target.value || null)}
            className="min-w-0 flex-1 rounded-md bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
          >
            <option value="">— select ammunition —</option>
            {ammo.options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
```

Change the attack buttons to disable when `unloaded` (replace the existing attack-row `<div>`):

```tsx
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Attack</span>
        {strike.variants.map((v, i) => (
          <button
            key={i}
            onClick={() => onAttack(i)}
            disabled={unloaded}
            className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-sm font-semibold text-white disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {v.label}
          </button>
        ))}
      </div>
      {unloaded && (
        <div className="mt-1 text-[11px] text-amber-400">
          {ammo && ammo.selectedId != null && ammo.remaining < 1 ? "Out of ammunition" : "Select ammunition to attack"}
        </div>
      )}
```

- [ ] **Step 2: Wire `onSetAmmo` in `src/app/tabs/ActionsTab.tsx`.**

Add `setStrikeAmmo` to the `strikeActions` import:

```tsx
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  setStrikeAmmo,
} from "../../foundry/actor/strikeActions";
```

Pass the prop on the `StrikeCard` (after `onAux`):

```tsx
              onAux={(ai) => void runAuxiliaryAction(actorId, s.index, ai)}
              onSetAmmo={(id) => void setStrikeAmmo(actorId, s.index, id)}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/StrikeCard.tsx src/app/tabs/ActionsTab.tsx
git commit -m "Phase 4 (Task 3): ranged ammo dropdown on strike cards + disable when unloaded" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification + live checkpoint (A.2c)

**Files:** none.

- [ ] **Step 1: Full suite** — Run: `npm run test` — Expected: PASS (prior 128 + 4 new = **132**).
- [ ] **Step 2: Typecheck + build** — Run: `npm run typecheck` then `npm run build` — Expected: both clean.
- [ ] **Step 3: Manual live checklist** (Player1, mobile viewport; an actor with a bow/crossbow + ammo):
  - [ ] A ranged weapon strike shows the **Ammo dropdown** with compatible ammo; melee/thrown strikes show no dropdown.
  - [ ] Selecting ammo persists (the weapon's selected ammo updates; reopening shows it) and **enables** the attack buttons.
  - [ ] With no ammo selected (or 0 remaining), attack buttons are **disabled** with the hint.
  - [ ] Attacking **consumes one round** (the ammo quantity drops; the dropdown's count/remaining updates within ~1s).
  - [ ] Running out mid-combat disables attacks; PF2e's own "not enough ammo" path doesn't break the UI.
- [ ] **Step 4: Report + pause.** This is the A.2c checkpoint — on approval, write the **A.2b** plan (attack modifier-toggle) from the spec.

---

## Self-review

**Spec coverage (A.2c):** ammo data/detection → mapper (T1); `setStrikeAmmo` → action (T2); dropdown + disable-when-unloaded → `StrikeCard`/`ActionsTab` (T3); auto-consume + rolling unchanged (no task needed, by design). Repeating/magazine edge case flagged in the spec, verified in the live checklist. ✓

**Placeholder scan:** none — all steps show complete code. ✓

**Type consistency:** `StrikeAmmoView` (`options`/`selectedId`/`remaining`) defined T1, consumed in `StrikeCard` (T3). `setStrikeAmmo(actorId, strikeIndex, ammoId: string | null)` matches between T2 and the `ActionsTab` call site (T3). `StrikeLike.ammunition`/`selectedAmmoId` (T1) feed `mapAmmo` (T1). ✓
