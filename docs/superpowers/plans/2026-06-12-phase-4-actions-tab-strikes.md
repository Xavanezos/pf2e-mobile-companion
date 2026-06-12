# Phase 4 — Actions Tab (Slice A: Strikes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Actions tab Placeholder with a working **Strikes** view — each strike shows three MAP attack buttons + Damage + Crit, rolling through the live PF2e API into the existing chat feed.

**Architecture:** A pure synchronous mapper (`buildStrikesView`) reads `actor.system.actions` into display data + the original array index; guarded action functions (`rollStrikeAttack`/`rollStrikeDamage`/`rollStrikeCritical`) re-read the live strike by index and call its `.variants[i].roll({event})` / `.damage({event})` / `.critical({event})`. A `useStrikes` hook (sync, like `useActor`) feeds an `ActionsTab` shell with a segmented Strikes/Actions control. PF2e posts the real chat cards → existing Slice-1 feed renders them.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest (node env), Tailwind v4 (preflight off). Live PF2e v8.2 / Foundry v14 API.

**Spec:** `docs/superpowers/specs/2026-06-12-phase-4-actions-tab-design.md` (Slice A). Slice B (Actions list + Toggles) is specced there and gets its own plan after this slice's checkpoint.

**Conventions:**
- All commits use subject `Phase 4 (Task N): …` and end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (project convention; commit directly to `main`).
- Tailwind-v4 button gotcha: bordered `<button>`s lose their border and flex buttons center content — use solid `bg-*` fills and `justify-start` where needed. Verify visuals in the real app, not just the build.
- Hooks/components are verified by `npm run typecheck` + `npm run build` + the manual checklist (not unit tests) — matching the spec and the existing codebase (`useActor`, `SpellsPanel` are untested). Only the pure mapper and guarded actions are unit-tested.

---

### Task 1: Strike view types + `buildStrikesView` mapper

**Files:**
- Modify: `src/foundry/actor/types.ts` (append the strike View + source `Like` types)
- Create: `src/foundry/actor/strikes.ts`
- Test: `tests/strikesView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/strikesView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildStrikesView } from "../src/foundry/actor/strikes";
import type { StrikeActorLike } from "../src/foundry/actor/types";

const strike = (over: Record<string, unknown> = {}) => ({
  type: "strike",
  slug: "longsword",
  label: "Longsword",
  ready: true,
  item: { img: "i/longsword.webp" },
  traits: [{ label: "Versatile P" }, "magical"],
  variants: [
    { label: "+17", penalty: 0 },
    { label: "+12", penalty: -5 },
    { label: "+7", penalty: -10 },
  ],
  damage: () => Promise.resolve(),
  critical: () => Promise.resolve(),
  ...over,
});

describe("buildStrikesView", () => {
  it("maps a strike: variant labels/penalties, ready, traits, img, glyph, damage flags", () => {
    const actor: StrikeActorLike = { system: { actions: [strike()] } };
    const v = buildStrikesView(actor);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      index: 0,
      slug: "longsword",
      label: "Longsword",
      img: "i/longsword.webp",
      ready: true,
      glyph: "1",
      traits: ["Versatile P", "magical"],
      hasDamage: true,
      hasCritical: true,
    });
    expect(v[0].variants).toEqual([
      { label: "+17", penalty: 0 },
      { label: "+12", penalty: -5 },
      { label: "+7", penalty: -10 },
    ]);
  });

  it("preserves the ORIGINAL actions index when a non-strike precedes it", () => {
    const actor: StrikeActorLike = {
      system: { actions: [{ type: "area-attack" }, strike({ slug: "fist", label: "Fist" })] },
    };
    const v = buildStrikesView(actor);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ index: 1, slug: "fist" });
  });

  it("skips entries with no variants and flags missing damage/critical", () => {
    const actor: StrikeActorLike = {
      system: {
        actions: [
          strike({ slug: "novariants", variants: [] }),
          strike({ slug: "bow", damage: undefined, critical: undefined }),
        ],
      },
    };
    const v = buildStrikesView(actor);
    expect(v.map((s) => s.slug)).toEqual(["bow"]);
    expect(v[0]).toMatchObject({ hasDamage: false, hasCritical: false });
  });

  it("returns [] when the actor has no actions", () => {
    expect(buildStrikesView({})).toEqual([]);
    expect(buildStrikesView({ system: {} })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- strikesView`
Expected: FAIL — `Cannot find module '../src/foundry/actor/strikes'` (and the type import is unresolved).

- [ ] **Step 3: Append the types to `src/foundry/actor/types.ts`**

Add at the end of the file (after the `CharacterLike` interface):

```ts
// ---------- Strikes (Phase 4) ----------

/** One MAP option on a strike: `label` is PF2e's precomposed sign string
 *  ("+17" / "+12" / "+7"); `penalty` is 0 / -5 / -10. */
export interface StrikeVariantView { label: string; penalty: number; }

/** A single strike for the Actions tab. `index` is the position in
 *  `actor.system.actions` — the action layer re-reads the live strike by it. */
export interface StrikeView {
  index: number;
  slug: string;
  label: string;
  img?: string;
  ready: boolean;
  glyph: string; // strikes are always a single action
  traits: string[];
  variants: StrikeVariantView[];
  hasDamage: boolean;
  hasCritical: boolean;
}

export type StrikesView = StrikeView[];

// ---------- Strikes source (the live actor, structurally) ----------

export interface StrikeVariantLike { label?: string; penalty?: number; }
export interface StrikeLike {
  type?: string;
  slug?: string;
  label?: string;
  ready?: boolean;
  traits?: (string | { label?: string; name?: string })[];
  variants?: StrikeVariantLike[];
  /** Live roll callbacks — present (functions) on real strikes; read only as flags. */
  damage?: unknown;
  critical?: unknown;
  item?: { img?: string };
}
export interface StrikeActorLike { system?: { actions?: StrikeLike[] }; }
```

- [ ] **Step 4: Write the mapper `src/foundry/actor/strikes.ts`**

```ts
import type { StrikeActorLike, StrikeLike, StrikeVariantView, StrikeView, StrikesView } from "./types";

function mapTrait(t: string | { label?: string; name?: string }): string {
  if (typeof t === "string") return t;
  return t.label ?? t.name ?? "";
}

function mapVariants(variants: StrikeLike["variants"]): StrikeVariantView[] {
  return (variants ?? []).map((v) => ({ label: v.label ?? "", penalty: v.penalty ?? 0 }));
}

/** Pure: map `actor.system.actions` to the Strikes view. Keeps the ORIGINAL array
 *  index on each kept strike (the action layer re-reads the live strike by it),
 *  filters to real strikes (`type === "strike"` with a non-empty variants array),
 *  and never retains the live roll/damage callbacks (only `hasDamage`/`hasCritical`
 *  flags). Defensive over PF2e's shape. */
export function buildStrikesView(actor: StrikeActorLike): StrikesView {
  const actions = actor.system?.actions ?? [];
  const views: StrikeView[] = [];
  actions.forEach((s, index) => {
    if (s.type !== "strike") return;
    if (!Array.isArray(s.variants) || s.variants.length === 0) return;
    views.push({
      index,
      slug: s.slug ?? "",
      label: s.label ?? s.slug ?? "Strike",
      img: s.item?.img,
      ready: s.ready ?? false,
      glyph: "1",
      traits: (s.traits ?? []).map(mapTrait).filter(Boolean),
      variants: mapVariants(s.variants),
      hasDamage: typeof s.damage === "function",
      hasCritical: typeof s.critical === "function",
    });
  });
  return views;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- strikesView`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/foundry/actor/types.ts src/foundry/actor/strikes.ts tests/strikesView.test.ts
git commit -m "Phase 4 (Task 1): strikes view types + buildStrikesView mapper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Guarded strike actions (`strikeActions.ts`)

**Files:**
- Create: `src/foundry/actor/strikeActions.ts`
- Test: `tests/strikeActions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/strikeActions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { rollStrikeAttack, rollStrikeDamage, rollStrikeCritical } from "../src/foundry/actor/strikeActions";

interface Call { method: string; args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const variant = (i: number) => ({
    roll: (...args: unknown[]) => { calls.push({ method: `variant${i}.roll`, args }); return Promise.resolve(); },
  });
  const strike = {
    slug: "longsword",
    variants: [variant(0), variant(1), variant(2)],
    damage: (...args: unknown[]) => { calls.push({ method: "damage", args }); return Promise.resolve(); },
    critical: (...args: unknown[]) => { calls.push({ method: "critical", args }); return Promise.resolve(); },
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

describe("strike actions", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls the chosen MAP variant with a skip-dialog click event (mirrors showCheckDialogs)", async () => {
    await rollStrikeAttack("a", 0, 1);
    expect(calls[0].method).toBe("variant1.roll");
    const arg = calls[0].args[0] as { event?: { type?: string; shiftKey?: boolean } };
    expect(arg.event?.type).toBe("click");
    expect(arg.event?.shiftKey).toBe(true);
  });

  it("rolls damage and critical with showDamageDialogs mirrored into the event", async () => {
    await rollStrikeDamage("a", 0);
    await rollStrikeCritical("a", 0);
    expect(calls.map((c) => c.method)).toEqual(["damage", "critical"]);
    const dmgArg = calls[0].args[0] as { event?: { shiftKey?: boolean } };
    expect(dmgArg.event?.shiftKey).toBe(false);
  });

  it("never throws when the strike or variant is missing", async () => {
    await expect(rollStrikeAttack("a", 99, 0)).resolves.toBeUndefined();
    await expect(rollStrikeAttack("a", 0, 9)).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- strikeActions`
Expected: FAIL — `Cannot find module '../src/foundry/actor/strikeActions'`.

- [ ] **Step 3: Write `src/foundry/actor/strikeActions.ts`**

```ts
/** Live PF2e strike rolls for the Actions tab. Thin glue over the system API,
 *  guarded so a rejected roll surfaces via Foundry's toast and never throws into
 *  React — same contract as `rolls.ts`. The strike posts the real attack/damage
 *  card, which flows through the existing chat feed (Chat tab + toast).
 *
 *  We never hold a live strike in React state: the view carries the strike's index
 *  in `actor.system.actions`, and these functions re-read the live strike by it —
 *  exactly how PF2e's own sheet resolves a strike from a clicked button. */

type Dict = Record<string, unknown>;

interface StrikeVariant { roll(args?: Dict): Promise<unknown>; }
interface LiveStrike {
  slug?: string;
  variants?: StrikeVariant[];
  damage?: (args?: Dict) => Promise<unknown>;
  critical?: (args?: Dict) => Promise<unknown>;
}
interface StrikeActor { system?: { actions?: LiveStrike[] }; }

function getStrike(actorId: string, index: number): LiveStrike {
  const actor = (game as any)?.actors?.get(actorId) as StrikeActor | undefined;
  const strike = actor?.system?.actions?.[index];
  if (!strike) throw new Error(`no strike at index ${index} on actor ${actorId}`);
  return strike;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] strike action failed", err);
    (ui as any)?.notifications?.error?.("Strike failed — see console.");
  }
}

/** A `{ event }` param whose click `shiftKey` mirrors the given PF2e dialog
 *  setting, so `eventToRollParams` skips the (mobile-suppressed) modifier dialog
 *  under either setting — the proven approach from the spell-damage fix. PF2e's
 *  own sheet passes `{ event }` to `variant.roll` / `strike.damage`. */
function skipDialogEvent(setting: "showCheckDialogs" | "showDamageDialogs"): Dict {
  const show = !!(game as any)?.user?.settings?.[setting];
  return { event: new PointerEvent("click", { shiftKey: show }) };
}

/** Roll one MAP variant of a strike (variantIndex 0/1/2 → MAP 0/-5/-10). */
export function rollStrikeAttack(actorId: string, strikeIndex: number, variantIndex: number): Promise<void> {
  return guard(() => {
    const variant = getStrike(actorId, strikeIndex).variants?.[variantIndex];
    if (!variant) throw new Error(`no variant ${variantIndex} on strike ${strikeIndex}`);
    return variant.roll(skipDialogEvent("showCheckDialogs"));
  });
}

/** Roll a strike's (non-critical) damage. */
export function rollStrikeDamage(actorId: string, strikeIndex: number): Promise<void> {
  return guard(() => {
    const strike = getStrike(actorId, strikeIndex);
    if (!strike.damage) throw new Error(`strike ${strikeIndex} has no damage`);
    return strike.damage(skipDialogEvent("showDamageDialogs"));
  });
}

/** Roll a strike's critical damage. */
export function rollStrikeCritical(actorId: string, strikeIndex: number): Promise<void> {
  return guard(() => {
    const strike = getStrike(actorId, strikeIndex);
    if (!strike.critical) throw new Error(`strike ${strikeIndex} has no critical`);
    return strike.critical(skipDialogEvent("showDamageDialogs"));
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- strikeActions`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/strikeActions.ts tests/strikeActions.test.ts
git commit -m "Phase 4 (Task 2): guarded strike attack/damage/critical rolls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `useStrikes` hook

**Files:**
- Create: `src/app/actions/useStrikes.ts`

No unit test — this hook reads the live `game` global and re-renders on Foundry hooks; verified by typecheck + build + the manual checklist, like `useActor`/`useSpells`.

- [ ] **Step 1: Write `src/app/actions/useStrikes.ts`**

```ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildStrikesView } from "../../foundry/actor/strikes";
import type { StrikeActorLike, StrikesView } from "../../foundry/actor/types";

/** Live strikes view for the active actor. `actor.system.actions` is prepared
 *  synchronously, so this mirrors `useActor` (a memo invalidated by a version
 *  bump) rather than the async `useSpells`. Re-preps on actor/item hooks so MAP
 *  labels and `ready` stay live as effects/equipment change. Returns null if the
 *  actor is gone. */
export function useStrikes(actorId: string): StrikesView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  const onActor = useCallback((doc: any) => { if (doc?.id === actorId) bump(); }, [actorId]);
  const onItem = useCallback(
    (doc: any) => { if ((doc?.parent?.id ?? doc?.actor?.id) === actorId) bump(); },
    [actorId],
  );

  useFoundryHook("updateActor", onActor);
  useFoundryHook("createItem", onItem);
  useFoundryHook("updateItem", onItem);
  useFoundryHook("deleteItem", onItem);

  return useMemo(() => {
    const actor = (game as any).actors.get(actorId);
    if (!actor) return null;
    return buildStrikesView(actor as StrikeActorLike);
    // `version` is an intentional invalidation dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/useStrikes.ts
git commit -m "Phase 4 (Task 3): useStrikes hook (sync, re-preps on actor/item hooks)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `StrikeCard` component

**Files:**
- Create: `src/app/actions/StrikeCard.tsx`

No unit test — presentational component, verified by typecheck + build + the manual checklist.

- [ ] **Step 1: Write `src/app/actions/StrikeCard.tsx`**

```tsx
import type { StrikeView } from "../../foundry/actor/types";
import { ActionGlyph } from "../sheet/parts/ActionGlyph";

/** One strike: img + name + action glyph + ready dot, traits line, three MAP
 *  attack buttons (labels straight from PF2e), then Damage + Crit. Solid `bg-*`
 *  fills (never `border`) per the Tailwind-v4 button gotchas; dimmed when not
 *  ready. */
export function StrikeCard({
  strike,
  onAttack,
  onDamage,
  onCritical,
}: {
  strike: StrikeView;
  onAttack: (variantIndex: number) => void;
  onDamage: () => void;
  onCritical: () => void;
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
            <button
              onClick={onDamage}
              className="flex-1 rounded-md bg-zinc-700 px-2 py-1.5 text-sm font-medium text-zinc-100"
            >
              Damage
            </button>
          )}
          {strike.hasCritical && (
            <button
              onClick={onCritical}
              className="flex-1 rounded-md bg-amber-700 px-2 py-1.5 text-sm font-medium text-amber-50"
            >
              Crit
            </button>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/StrikeCard.tsx
git commit -m "Phase 4 (Task 4): StrikeCard (MAP attack buttons + damage + crit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `ActionsTab` shell + route it in `TabContent`

**Files:**
- Create: `src/app/tabs/ActionsTab.tsx`
- Modify: `src/app/TabContent.tsx` (route `actions` → `<ActionsTab />`)

No unit test — verified by typecheck + build + the manual checklist.

- [ ] **Step 1: Write `src/app/tabs/ActionsTab.tsx`**

```tsx
import { useState } from "react";
import { useAppStore } from "../store";
import { useStrikes } from "../actions/useStrikes";
import { StrikeCard } from "../actions/StrikeCard";
import { rollStrikeAttack, rollStrikeDamage, rollStrikeCritical } from "../../foundry/actor/strikeActions";

type Section = "strikes" | "actions";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "strikes", label: "Strikes" },
  { id: "actions", label: "Actions" },
];

/** The bottom Actions tab — mirrors PF2e's char-sheet Actions tab. Slice A: a
 *  segmented Strikes / Actions control with Strikes implemented. The pinned
 *  Toggles strip + the Actions list (Encounter/Exploration/Downtime) land in
 *  Slice B. */
export function ActionsTab() {
  const actorId = useAppStore((s) => s.actorId);
  const [section, setSection] = useState<Section>("strikes");
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
              onAttack={(vi) => void rollStrikeAttack(actorId, s.index, vi)}
              onDamage={() => void rollStrikeDamage(actorId, s.index)}
              onCritical={() => void rollStrikeCritical(actorId, s.index)}
            />
          ))
        ))}

      {section === "actions" && (
        <div className="p-4 text-sm text-zinc-500">Actions list &amp; toggles — coming next (Slice B).</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Route it in `src/app/TabContent.tsx`**

Add the import alongside the existing imports:

```tsx
import { ActionsTab } from "./tabs/ActionsTab";
```

Replace the `actions` case:

```tsx
    case "actions":
      return <Placeholder title="Actions & Macros" phase="Coming in Phase 4" />;
```

with:

```tsx
    case "actions":
      return <ActionsTab />;
```

(Leave the `Placeholder` import — it's still used by the combat/journal/map cases.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Build (test the production bundle, not just dev — see the Phase 3 gotcha)**

Run: `npm run build`
Expected: build succeeds, emits `dist/module.js` + `dist/style.css`.

- [ ] **Step 5: Commit**

```bash
git add src/app/tabs/ActionsTab.tsx src/app/TabContent.tsx
git commit -m "Phase 4 (Task 5): Actions tab shell + Strikes section (replaces placeholder)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Full verification + live checkpoint

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — all prior tests plus the 7 new ones (4 `strikesView` + 3 `strikeActions`).

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck` then `npm run build`
Expected: both clean.

- [ ] **Step 3: Manual live checklist (the checkpoint)**

Log in as **Player1** (no password) in a mobile-width viewport; use an actor that owns strikes (Ezren's unarmed/staff strike works; a martial actor is better if available). Verify:

- [ ] The **Actions** tab shows the segmented **Strikes / Actions** control; Strikes is selected by default.
- [ ] Strikes render with the right names, an action glyph, and a ready/not-ready indicator; non-ready strikes are dimmed.
- [ ] Each strike shows **three** attack buttons with the live `+N` MAP labels.
- [ ] Tapping the **first** attack button posts an attack card to chat (toasts + lands in the Chat tab); the **second/third** apply the −5 / −10 MAP (check the card's modifier).
- [ ] **Damage** and **Crit** post their cards; **no dialog hangs** under either client setting (toggle `showCheckDialogs` / `showDamageDialogs` and re-test one roll each).
- [ ] Equipping/unequipping a weapon updates the list + `ready` within ~1s; an effect that changes MAP updates the button labels.
- [ ] The **Actions** segment shows the "coming next (Slice B)" note.
- [ ] **Homebrew:** if an Imaginary Weapon strike is available, its rule-element damage resolves through these buttons (proves the architecture).

- [ ] **Step 4: Report results and pause for review.**

Report the checklist outcome. This is the Slice-A checkpoint — on approval, proceed to writing the Slice B plan (Actions list + Toggles bar) from the spec.

---

## Self-review

**Spec coverage (Slice A):** mapper `buildStrikesView` → Task 1; guarded `rollStrikeAttack`/`rollStrikeDamage`/`rollStrikeCritical` + dialog suppression → Task 2; `useStrikes` sync refresh hook → Task 3; `StrikeCard` (attack ×3 MAP, damage, crit, ready, traits) → Task 4; `ActionsTab` shell (segmented Strikes/Actions, Actions "coming next") + `TabContent` wiring → Task 5; pure-mapper + action tests, typecheck, production build, manual checklist incl. homebrew → Tasks 1–2, 6. Apply-damage deferral and Slice B (Actions list + Toggles) are intentionally out of this plan (specced for the next slice). No `store.ts` change needed (`"actions"` already a `TabId`). ✓ no gaps.

**Placeholder scan:** none — every code step shows complete code; "coming next (Slice B)" is shipped UI copy, not a plan placeholder. ✓

**Type consistency:** `StrikeView` fields (`index`, `slug`, `label`, `img`, `ready`, `glyph`, `traits`, `variants`, `hasDamage`, `hasCritical`) are defined in Task 1 and consumed identically in `StrikeCard` (Task 4) and `ActionsTab` (Task 5). `buildStrikesView(actor: StrikeActorLike): StrikesView` matches its use in `useStrikes`. `rollStrikeAttack(actorId, strikeIndex, variantIndex)` / `rollStrikeDamage(actorId, strikeIndex)` / `rollStrikeCritical(actorId, strikeIndex)` signatures match between Task 2 and Task 5 call sites. `StrikeActorLike` imported by both `strikes.ts` and `useStrikes.ts`. ✓
