# Phase 4 — Slice A.2b — Attack Modifier Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `StrikeAttackModal`'s modifier rows togglable — unchecking a modifier (e.g. a potency rune) drops it from the shown attack total *and* the rolled attack bonus, mirroring PF2e's own `CheckModifiersDialog`, then self-heals so the strike's normal rolls are unaffected afterward.

**Architecture:** A pure view already carries each strike's modifier rows (`StrikeView.modifiers`, slug-keyed). We add two live-API functions in `strikeActions.ts`: `previewStrikeAttack` (transiently flips `modifier.ignored`, recomputes, reads back the total + post-stacking rows, restores) and a `disabledSlugs` option on `rollStrikeAttack` (flip → roll → restore in a `finally`). The modal gains checkboxes + local `disabled` state and re-previews on every toggle. PF2e owns all stacking math; we never hold a live strike in React state — the action layer re-reads it by index.

**Tech Stack:** TypeScript, React 18, Vitest, Tailwind v4. Live PF2e API (`actor.system.actions[i]`).

---

## Ground truth (verified against the cloned PF2e source `E:/React Projects/pf2e`)

The toggle mechanism — the highest-risk, PF2e-internal piece — is confirmed end-to-end:

1. **`Modifier.ignored` is a real field** (`src/module/actor/modifiers.ts:129`); the constructor reads it from params (`modifiers.ts:185 → this.ignored = params.ignored ?? false`).
2. **`StatisticModifier.calculateTotal()`** runs `applyStackingRules`, which **forces `enabled = false` for every ignored modifier** and excludes it from `totalModifier` (`modifiers.ts:489-494, 606-618`).
3. **The strike clones its modifiers at roll time.** `variant.roll()` builds `new CheckModifier("strike", action, …)` (`character/document.ts:1559` → `checkModifiers[i]` at `:1500`). `CheckModifier`'s constructor does `statistic.modifiers…map((m) => m.clone())` (`modifiers.ts:650-658`); `Modifier.clone()` spreads `{ ...this }`, **preserving `ignored`** (`modifiers.ts:278`). So flipping `.ignored` on the live strike *before* rolling is honored by the roll.
4. **PF2e's own dialog does exactly this:** `this.check.modifiers[index].ignored = !checkbox.checked; this.check.calculateTotal()` (`system/check/dialog.ts:130-131`).
5. **`variant.label` / `variant.penalty` read the live `action.totalModifier`** (`document.ts:1517`), so after `calculateTotal()` the recomputed total is `strike.totalModifier + variant.penalty`.

> The spec's `helpers.ts:560-625` ref is stale (that file is now 361 lines); the real clone-at-roll is `document.ts:1559` + the `CheckModifier` constructor above. Everything else in the spec holds.

**Restore note:** `calculateTotal()` legitimately re-derives `enabled` (and re-flags ability-type `ignored`) on every call, so the only persistent mutation we must undo is the `.ignored` *we* set on the touched modifiers. We capture each touched modifier's prior `.ignored`, set it `true`, and restore that captured value — fully self-healing, and the next data-prep rebuilds everything regardless.

---

## File structure

| File | Change |
|---|---|
| `src/foundry/actor/types.ts` | Add `StrikeAttackPreview` interface (reuses `StrikeModView`). |
| `src/foundry/actor/strikeActions.ts` | Extend the local live-strike interfaces (`modifiers`, `calculateTotal`, `totalModifier`, `variant.penalty`); add `previewStrikeAttack`; add a `disabledSlugs` option to `rollStrikeAttack`. |
| `tests/strikeActions.test.ts` | Extend the shared stub (modifiers + `calculateTotal` + variant penalties + a roll `snapshot`); add preview + disabled-roll tests. |
| `src/app/actions/StrikeAttackModal.tsx` | Checkboxes per row + local `disabled` state + live re-preview; `onRoll(disabledSlugs)`. |
| `src/app/tabs/ActionsTab.tsx` | Pass `loadPreview` + `onRoll(disabled)` to the modal. |

No store changes. No mapper changes (the view already carries `modifiers`).

---

### Task 1: `previewStrikeAttack` — transient apply → recompute → read → restore

**Files:**
- Modify: `src/foundry/actor/types.ts` (add `StrikeAttackPreview`)
- Modify: `src/foundry/actor/strikeActions.ts` (extend interfaces; add `previewStrikeAttack`)
- Test: `tests/strikeActions.test.ts` (extend stub; add preview tests)

- [ ] **Step 1: Add the preview return type**

In `src/foundry/actor/types.ts`, immediately after the `StrikeAmmoView` interface (around line 240), add:

```ts
/** Result of a live attack-modifier preview (A.2b): the grand total recomputed by
 *  PF2e's own stacking (incl. the MAP penalty), and the post-stacking modifier rows
 *  (with the user-disabled ones flipped to `enabled: false`). */
export interface StrikeAttackPreview { total: number; parts: StrikeModView[]; }
```

- [ ] **Step 2: Replace the shared test stub with one that carries modifiers + calculateTotal**

In `tests/strikeActions.test.ts`, replace the `interface Call` line and the whole `stub()` function (lines 11-39) with:

```ts
interface Call { method: string; args: unknown[]; snapshot?: boolean[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  // Two modifiers; `calculateTotal` mimics PF2e: ignored → enabled false, total = Σ enabled.
  const modifiers = [
    { slug: "ability", label: "Strength", modifier: 4, enabled: true, ignored: false, hideIfDisabled: false },
    { slug: "potency", label: "Potency", modifier: 1, enabled: true, ignored: false, hideIfDisabled: false },
  ];
  const variant = (i: number, penalty: number) => ({
    penalty,
    roll: (...args: unknown[]) => {
      // Snapshot each modifier's `ignored` AT ROLL TIME — proves the flip is live during the roll.
      calls.push({ method: `variant${i}.roll`, args, snapshot: modifiers.map((m) => m.ignored) });
      return Promise.resolve();
    },
  });
  const formulaFor = (m: string, a: unknown[]) =>
    (a[0] as { getFormula?: boolean })?.getFormula ? (m === "critical" ? "2d8+8" : "1d8+4") : undefined;
  const strike = {
    slug: "longsword",
    variants: [variant(0, 0), variant(1, -5), variant(2, -10)],
    modifiers,
    totalModifier: 5,
    calculateTotal() {
      calls.push({ method: "calculateTotal", args: [] });
      for (const m of modifiers) m.enabled = !m.ignored;
      this.totalModifier = modifiers.filter((m) => m.enabled).reduce((t, m) => t + m.modifier, 0);
    },
    damage: (...args: unknown[]) => { calls.push({ method: "damage", args }); return Promise.resolve(formulaFor("damage", args)); },
    critical: (...args: unknown[]) => { calls.push({ method: "critical", args }); return Promise.resolve(formulaFor("critical", args)); },
    auxiliaryActions: [{ execute: (...args: unknown[]) => { calls.push({ method: "aux.execute", args }); return Promise.resolve(); } }],
    item: { id: "w1", update: (...args: unknown[]) => { calls.push({ method: "item.update", args }); return Promise.resolve(); } },
  };
  const actor = { system: { actions: [strike] } };
  (globalThis as { game?: unknown }).game = {
    actors: { get: () => actor },
    user: { settings: { showCheckDialogs: true, showDamageDialogs: false } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { PointerEvent?: unknown }).PointerEvent = class {
    shiftKey: boolean;
    constructor(public type: string, init?: { shiftKey?: boolean }) { this.shiftKey = !!init?.shiftKey; }
  } as unknown;
  return calls;
}
```

Add `previewStrikeAttack` to the import block at the top of the file (lines 2-9):

```ts
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  previewStrikeAttack,
  setStrikeAmmo,
} from "../src/foundry/actor/strikeActions";
```

- [ ] **Step 3: Write the failing preview tests**

In `tests/strikeActions.test.ts`, add inside the `describe("strike actions", …)` block (after the existing "previews damage and critical" test):

```ts
it("previews the full attack total when nothing is disabled", async () => {
  expect(await previewStrikeAttack("a", 0, 0, [])).toEqual({
    total: 5, // totalModifier 5 + penalty 0
    parts: [
      { slug: "ability", label: "Strength", value: 4, enabled: true },
      { slug: "potency", label: "Potency", value: 1, enabled: true },
    ],
  });
});

it("previews with a modifier disabled (drops it from the total + greys it) and restores .ignored", async () => {
  // variant 1 → MAP penalty -5; potency disabled → totalModifier 4, total 4 + (-5) = -1
  expect(await previewStrikeAttack("a", 0, 1, ["potency"])).toEqual({
    total: -1,
    parts: [
      { slug: "ability", label: "Strength", value: 4, enabled: true },
      { slug: "potency", label: "Potency", value: 1, enabled: false },
    ],
  });
  const live = (globalThis as { game: { actors: { get(): { system: { actions: { modifiers: { ignored: boolean }[]; totalModifier: number }[] } } } } }).game.actors.get().system.actions[0];
  expect(live.modifiers.map((m) => m.ignored)).toEqual([false, false]); // restored
  expect(live.totalModifier).toBe(5); // recomputed back to full
});

it("preview returns null when the variant is missing", async () => {
  expect(await previewStrikeAttack("a", 0, 9, [])).toBeNull();
});
```

- [ ] **Step 4: Run the new tests — verify they fail**

Run: `npm test -- strikeActions`
Expected: FAIL — `previewStrikeAttack` is not exported (`TypeError` / `not a function`).

- [ ] **Step 5: Extend the live-strike interfaces and implement `previewStrikeAttack`**

In `src/foundry/actor/strikeActions.ts`:

(a) Add an import at the very top of the file (above `type Dict`):

```ts
import type { StrikeAttackPreview } from "./types";
```

(b) Replace the `StrikeVariant` + `LiveStrike` interfaces (lines 12-20) with:

```ts
interface StrikeVariant { roll(args?: Dict): Promise<unknown>; penalty?: number; }
interface LiveModifier { slug?: string; label?: string; modifier?: number; enabled?: boolean; ignored?: boolean; hideIfDisabled?: boolean; }
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  modifiers?: LiveModifier[];
  totalModifier?: number;
  calculateTotal?: () => void;
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
  auxiliaryActions?: { execute(args?: Dict): Promise<unknown> }[];
  item?: { update(data: Dict): Promise<unknown> };
}
```

(c) Add `previewStrikeAttack` immediately after `previewStrikeDamage` (after line 97):

```ts
/** Preview an attack's total with a set of modifiers disabled (by slug), without
 *  rolling. Transiently sets `.ignored` on the matching live modifiers, recomputes
 *  via PF2e's own stacking, reads back the grand total (incl. the MAP penalty) and
 *  the post-stacking rows, then RESTORES the prior `.ignored` — all synchronous, so
 *  the live strike is never left mutated. Returns null if the strike can't recompute. */
export async function previewStrikeAttack(
  actorId: string,
  strikeIndex: number,
  variantIndex: number,
  disabledSlugs: string[],
): Promise<StrikeAttackPreview | null> {
  try {
    const strike = getStrike(actorId, strikeIndex);
    const variant = strike.variants?.[variantIndex];
    if (!variant || !strike.modifiers || !strike.calculateTotal) return null;
    const disabled = new Set(disabledSlugs);
    const touched = strike.modifiers.filter((m) => disabled.has(m.slug ?? ""));
    const prev = touched.map((m) => m.ignored ?? false);
    try {
      touched.forEach((m) => { m.ignored = true; });
      strike.calculateTotal();
      const total = (strike.totalModifier ?? 0) + (variant.penalty ?? 0);
      const parts = strike.modifiers
        // keep visible rows + any the user just disabled (so a hideIfDisabled rune doesn't vanish)
        .filter((m) => m.enabled || !m.hideIfDisabled || disabled.has(m.slug ?? ""))
        .map((m) => ({ slug: m.slug ?? "", label: m.label ?? "", value: m.modifier ?? 0, enabled: m.enabled ?? false }));
      return { total, parts };
    } finally {
      touched.forEach((m, i) => { m.ignored = prev[i]; });
      strike.calculateTotal();
    }
  } catch (err) {
    console.error("[pf2e-mobile] strike attack preview failed", err);
    return null;
  }
}
```

- [ ] **Step 6: Run the tests — verify they pass**

Run: `npm test -- strikeActions`
Expected: PASS — all preview tests green; the existing strike-action tests still green.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: clean (no output).

- [ ] **Step 8: Commit**

```bash
git add src/foundry/actor/types.ts src/foundry/actor/strikeActions.ts tests/strikeActions.test.ts
git commit -m "$(cat <<'EOF'
Phase 4 (Task 1): previewStrikeAttack (transient ignore→recompute→restore)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `disabledSlugs` on `rollStrikeAttack` — flip → roll → restore in a `finally`

**Files:**
- Modify: `src/foundry/actor/strikeActions.ts` (`rollStrikeAttack` signature + body)
- Test: `tests/strikeActions.test.ts` (disabled-roll test)

- [ ] **Step 1: Write the failing roll test**

In `tests/strikeActions.test.ts`, add inside `describe("strike actions", …)` (after the "rolls the chosen MAP variant" test):

```ts
it("rolls with disabledSlugs: ignores matching modifiers DURING the roll, restores AFTER", async () => {
  await rollStrikeAttack("a", 0, 0, { disabledSlugs: ["potency"] });
  const rollCall = calls.find((c) => c.method === "variant0.roll");
  expect(rollCall?.snapshot).toEqual([false, true]); // ability live, potency ignored at roll time
  const live = (globalThis as { game: { actors: { get(): { system: { actions: { modifiers: { ignored: boolean }[]; totalModifier: number }[] } } } } }).game.actors.get().system.actions[0];
  expect(live.modifiers.map((m) => m.ignored)).toEqual([false, false]); // restored
  expect(live.totalModifier).toBe(5);
});

it("rolling with no disabledSlugs touches no modifiers (no calculateTotal)", async () => {
  await rollStrikeAttack("a", 0, 1);
  expect(calls.map((c) => c.method)).toEqual(["variant1.roll"]);
});
```

- [ ] **Step 2: Run — verify the disabled-roll test fails**

Run: `npm test -- strikeActions`
Expected: FAIL — the 4th positional arg is ignored, so `snapshot` is `[false, false]` (potency not flipped) — assertion `toEqual([false, true])` fails.

- [ ] **Step 3: Implement the `disabledSlugs` option**

In `src/foundry/actor/strikeActions.ts`, replace the whole `rollStrikeAttack` function (lines 48-55) with:

```ts
/** Roll one MAP variant of a strike (variantIndex 0/1/2 → MAP 0/-5/-10). When
 *  `disabledSlugs` is given, transiently flips `.ignored` on the matching live
 *  modifiers so the roll's cloned modifiers drop them (PF2e clones at roll time),
 *  then RESTORES them in a `finally` — transient and self-healing even on error. */
export function rollStrikeAttack(
  actorId: string,
  strikeIndex: number,
  variantIndex: number,
  opts?: { disabledSlugs?: string[] },
): Promise<void> {
  return guard(async () => {
    const strike = getStrike(actorId, strikeIndex);
    const variant = strike.variants?.[variantIndex];
    if (!variant) throw new Error(`no variant ${variantIndex} on strike ${strikeIndex}`);
    const disabled = new Set(opts?.disabledSlugs ?? []);
    const touched = (strike.modifiers ?? []).filter((m) => disabled.has(m.slug ?? ""));
    const prev = touched.map((m) => m.ignored ?? false);
    try {
      if (touched.length) {
        touched.forEach((m) => { m.ignored = true; });
        strike.calculateTotal?.();
      }
      await variant.roll(skipDialogEvent("showCheckDialogs"));
    } finally {
      if (touched.length) {
        touched.forEach((m, i) => { m.ignored = prev[i]; });
        strike.calculateTotal?.();
      }
    }
  });
}
```

- [ ] **Step 4: Run the tests — verify they pass**

Run: `npm test -- strikeActions`
Expected: PASS — disabled-roll snapshot `[false, true]` + restore; the no-opts path unchanged; all prior tests green.

- [ ] **Step 5: Full test run + typecheck (no regressions)**

Run: `npm test`
Expected: PASS — full suite green (was 132; now higher with the new cases).

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/foundry/actor/strikeActions.ts tests/strikeActions.test.ts
git commit -m "$(cat <<'EOF'
Phase 4 (Task 2): rollStrikeAttack disabledSlugs (flip→roll→restore)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `StrikeAttackModal` checkboxes + live re-preview + tab wiring

**Files:**
- Modify: `src/app/actions/StrikeAttackModal.tsx` (full rewrite — checkboxes + state)
- Modify: `src/app/tabs/ActionsTab.tsx` (pass `loadPreview` + `onRoll(disabled)`)

- [ ] **Step 1: Rewrite `StrikeAttackModal` with togglable rows**

Replace the entire contents of `src/app/actions/StrikeAttackModal.tsx` with:

```tsx
import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import type { StrikeAttackPreview, StrikeView } from "../../foundry/actor/types";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Attack roll prompt: a checkbox per modifier (uncheck to disable, PF2e-style), the
 *  MAP penalty row, the live grand total, and a Roll button. Each toggle re-previews
 *  via `loadPreview` (PF2e's own stacking); the disabled slugs ride along to `onRoll`.
 *  Source-agnostic — the tab closes over actorId/strikeIndex/variantIndex. */
export function StrikeAttackModal({
  strike,
  variantIndex,
  loadPreview,
  onRoll,
  onClose,
}: {
  strike: StrikeView;
  variantIndex: number;
  loadPreview: (disabledSlugs: string[]) => Promise<StrikeAttackPreview | null>;
  onRoll: (disabledSlugs: string[]) => void;
  onClose: () => void;
}) {
  const variant = strike.variants[variantIndex];
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<StrikeAttackPreview | null>(null);

  // Before any toggle, render the static view + precomposed label; after, the live preview.
  const rows = preview?.parts ?? strike.modifiers;
  const totalLabel = preview ? sign(preview.total) : variant.label;

  const toggle = (slug: string) => {
    const next = new Set(disabled);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setDisabled(next);
    loadPreview([...next]).then(setPreview).catch(() => {});
  };

  const roll = () => { onRoll([...disabled]); onClose(); };

  return (
    <Modal title={strike.label} onClose={onClose}>
      <div className="divide-y divide-zinc-800">
        {rows.map((m, i) => (
          <label
            key={`${m.slug}-${i}`}
            className={`flex cursor-pointer items-center gap-2 px-1 py-2 text-sm ${m.enabled ? "" : "opacity-40"}`}
          >
            <input
              type="checkbox"
              checked={!disabled.has(m.slug)}
              onChange={() => toggle(m.slug)}
              className="h-4 w-4 shrink-0 accent-indigo-500"
            />
            <span className="min-w-0 flex-1 truncate text-zinc-300">{m.label}</span>
            <span className="font-semibold tabular-nums">{sign(m.value)}</span>
          </label>
        ))}
        {variant.penalty !== 0 && (
          <div className="flex items-center justify-between px-1 py-2 text-sm">
            <span className="pl-6 text-zinc-300">Multiple Attack Penalty</span>
            <span className="font-semibold tabular-nums">{variant.penalty}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-700 px-1 pt-2">
        <span className="font-semibold">Attack</span>
        <span className="text-lg font-bold tabular-nums">{totalLabel}</span>
      </div>
      <button onClick={roll} className="mt-3 min-h-12 w-full rounded-md bg-indigo-600 font-semibold text-white">
        Roll {totalLabel}
      </button>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire `loadPreview` + `onRoll(disabled)` in `ActionsTab`**

In `src/app/tabs/ActionsTab.tsx`, add `previewStrikeAttack` to the `strikeActions` import block (lines 7-14):

```ts
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  previewStrikeAttack,
  setStrikeAmmo,
} from "../../foundry/actor/strikeActions";
```

Then replace the `attack` prompt block (lines 76-83) with:

```tsx
      {prompt?.kind === "attack" && (
        <StrikeAttackModal
          strike={prompt.strike}
          variantIndex={prompt.variantIndex}
          loadPreview={(disabled) => previewStrikeAttack(actorId, prompt.strike.index, prompt.variantIndex, disabled)}
          onRoll={(disabled) =>
            void rollStrikeAttack(actorId, prompt.strike.index, prompt.variantIndex, { disabledSlugs: disabled })
          }
          onClose={() => setPrompt(null)}
        />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean — `loadPreview`/`onRoll` signatures line up; `StrikeAttackPreview` resolves.

- [ ] **Step 4: Production build (the dev server has masked broken bundles before)**

Run: `npm run build`
Expected: `vite build` succeeds, no type/bundle errors.

- [ ] **Step 5: Full test run**

Run: `npm test`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/StrikeAttackModal.tsx src/app/tabs/ActionsTab.tsx
git commit -m "$(cat <<'EOF'
Phase 4 (Task 3): StrikeAttackModal modifier checkboxes + live re-preview

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Live verification (after Task 3 — required before declaring A.2b done)

Per the handoff recipe: `npm run dev`; log in as **Player1** (no password) at mobile width; use a martial actor with a runed weapon (a potency rune gives a clean togglable row). Confirm:

1. Open a strike's attack prompt → each modifier shows a **checkbox** (all checked) + the breakdown + total.
2. **Uncheck the potency rune** → the shown **Attack total drops** by the rune's value and the row greys.
3. **Tap Roll** → the posted attack card's bonus reflects the **lowered** total (not the full one).
4. Re-open the same strike → checkboxes are **all checked again** (no lingering `ignored`); a normal roll uses the **full** bonus.
5. **Homebrew (Imaginary Weapon):** its rule-element modifiers appear, toggle, and roll correctly.

If any path diverges, fix the live-API call and re-ground against `E:/React Projects/pf2e`. On success, update `MEMORY.md` → [[phase-4-progress]] (A.2b done; Slice B next) and the handoff report.

---

## Self-review (checked against the spec)

- **Spec coverage** — "Slice A.2b" requirements all mapped: `previewStrikeAttack` (transient apply→recompute→read→restore) → Task 1; `disabledSlugs` on `rollStrikeAttack` (apply→roll→restore in `finally`) → Task 2; per-modifier checkboxes that re-preview + greyed-by-stacking rows + roll passes `disabledSlugs` → Task 3; the slug-collision "identity caveat" is accepted (the `disabled` Set keys on slug; empty-slug rows toggle together) and the mutation is transient.
- **Placeholder scan** — every code step shows complete code; every run step shows the exact command + expected result. None outstanding.
- **Type consistency** — `previewStrikeAttack(actorId, strikeIndex, variantIndex, disabledSlugs: string[]): Promise<StrikeAttackPreview | null>` and `StrikeAttackPreview = { total: number; parts: StrikeModView[] }` are used identically in `strikeActions.ts`, the modal's `loadPreview` prop, and the tab wiring. `rollStrikeAttack`'s new 4th param `opts?: { disabledSlugs?: string[] }` matches the tab call and is back-compatible with every existing 3-arg call site/test. `parts` elements are exactly `StrikeModView` (`{ slug, label, value, enabled }`).
- **Regression safety** — the stub rewrite keeps all fields the existing tests read; the no-`disabledSlugs` roll path is byte-identical (empty `touched` → no `calculateTotal`, just `variant.roll`), so the "never throws" and existing MAP/damage tests stay green.
