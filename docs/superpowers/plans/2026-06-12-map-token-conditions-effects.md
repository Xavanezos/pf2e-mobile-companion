# Map Token Conditions & Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every visible token's active PF2e conditions and effects on the Map tab — as small status icons on the token sprite and as a labeled list in the tap-for-info popup.

**Architecture:** Extend the pure, unit-tested scene mapper (`buildSceneView`) to read each token actor's `conditions.active` and `itemTypes.effect`, reusing the character sheet's existing `ConditionView`/`EffectView` display types and `effectBadgeLabel` helper. The React renderer (`TokenSprite`, `TokenInfoPopup`) stays dumb. `useScene` gains the `createItem`/`updateItem`/`deleteItem` hooks so the icons update live (conditions/effects are embedded items, not actor updates).

**Tech Stack:** React 18 + TypeScript, Vitest, Tailwind v4, Foundry VTT / PF2e globals (no PIXI canvas).

**Spec:** `docs/superpowers/specs/2026-06-12-map-token-conditions-effects-design.md`

**Commands:** `npm test` (vitest run) · `npm run typecheck` (tsc --noEmit) · `npm run build` (vite build)

**Tailwind v4 gotcha (from project memory):** never use `border` on these elements — use `bg`/`ring` (the no-preflight reset drops borders). The code below already follows this.

---

## File structure

- `src/foundry/actor/types.ts` — **modify**: add `unidentified?` to `EffectLike`.
- `src/foundry/scene/types.ts` — **modify**: import the display types; add `conditions`/`effects` to `TokenView`; add `isOwner`/`conditions`/`itemTypes` to `TokenLike.actor`.
- `src/foundry/scene/view.ts` — **modify**: map conditions/effects in `buildSceneView` (+ two private helpers, + unidentified-mask rule).
- `tests/sceneView.test.ts` — **modify**: 4 new cases.
- `src/app/map/useScene.ts` — **modify**: add the three item hooks.
- `src/app/map/TokenSprite.tsx` — **modify**: render the capped status-icon row.
- `src/app/map/TokenInfoPopup.tsx` — **modify**: add read-only Conditions/Effects chip sections.

---

## Task 1: Map conditions & effects onto `TokenView` (pure mapper)

**Files:**
- Test: `tests/sceneView.test.ts`
- Modify: `src/foundry/actor/types.ts:129`
- Modify: `src/foundry/scene/types.ts` (top import, `TokenView`, `TokenLike.actor`)
- Modify: `src/foundry/scene/view.ts`

- [ ] **Step 1: Write the failing tests**

Add these four `it(...)` blocks inside the existing `describe("buildSceneView", () => { ... })` in `tests/sceneView.test.ts`, immediately before the closing `});` of the describe:

```ts
  it("maps active conditions (with value) and effects (with badge) onto the token", () => {
    const t = token({
      actor: {
        id: "a1", hasPlayerOwner: false,
        conditions: { active: [{ slug: "frightened", name: "Frightened", value: 2, img: "fr.webp", isLocked: false }] },
        itemTypes: { effect: [{ id: "e1", name: "Bless", img: "bl.webp", badge: { value: 1 } }] },
      },
    });
    const v = buildSceneView(scene([t]), DIMS, GM);
    expect(v.tokens[0].conditions).toEqual([
      { slug: "frightened", name: "Frightened", value: 2, img: "fr.webp", locked: false },
    ]);
    expect(v.tokens[0].effects).toEqual([{ id: "e1", name: "Bless", img: "bl.webp", badge: "1" }]);
  });

  it("shows conditions/effects on an NPC token for a player (no owner gating, unlike HP)", () => {
    const npc = token({
      id: "npc",
      actor: {
        id: "x", hasPlayerOwner: false,
        system: { attributes: { hp: { value: 8, max: 8 } } },
        conditions: { active: [{ slug: "prone", name: "Prone", value: null }] },
        itemTypes: { effect: [] },
      },
    });
    const pv = buildSceneView(scene([npc]), DIMS, PLAYER);
    expect(pv.tokens[0].hp).toBeNull();                                   // HP still gated
    expect(pv.tokens[0].conditions.map((c) => c.slug)).toEqual(["prone"]); // conditions are not
  });

  it("defaults conditions/effects to empty arrays when the actor omits them", () => {
    const v = buildSceneView(scene([token({ actor: { id: "a1", hasPlayerOwner: true } })]), DIMS, GM);
    expect(v.tokens[0].conditions).toEqual([]);
    expect(v.tokens[0].effects).toEqual([]);
  });

  it("masks an unidentified effect for a non-GM non-owner, but not for the GM or owner", () => {
    const eff = { id: "e", name: "Secret Buff", img: "s.webp", badge: { value: 3 }, unidentified: true };
    const npc = (isOwner: boolean) =>
      token({ actor: { id: "x", hasPlayerOwner: false, isOwner, itemTypes: { effect: [eff] } } });
    expect(buildSceneView(scene([npc(false)]), DIMS, PLAYER).tokens[0].effects[0])
      .toEqual({ id: "e", name: "Effect", img: "s.webp", badge: null });
    expect(buildSceneView(scene([npc(false)]), DIMS, GM).tokens[0].effects[0])
      .toMatchObject({ name: "Secret Buff", badge: "3" });
    expect(buildSceneView(scene([npc(true)]), DIMS, PLAYER).tokens[0].effects[0])
      .toMatchObject({ name: "Secret Buff", badge: "3" });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- sceneView`
Expected: FAIL — the four new cases error/assert because `v.tokens[0].conditions` and `.effects` are `undefined` (mapper doesn't set them yet). The existing cases still pass.

- [ ] **Step 3: Make the type changes, then implement the mapper**

**3a.** In `src/foundry/actor/types.ts`, line 129, add `unidentified?: boolean` to `EffectLike`:

```ts
export interface EffectLike { id?: string; name: string; img?: string; badge?: { value?: number; label?: string } | null; unidentified?: boolean; }
```

**3b.** In `src/foundry/scene/types.ts`, add an import directly below the top comment block (the file currently has no imports), before `export interface SceneDimensionsLike`:

```ts
import type { ConditionView, EffectView, ConditionLike, EffectLike } from "../actor/types";
```

In the same file, in `interface TokenView`, add two fields right after the `hp: ... | null;` line:

```ts
  conditions: ConditionView[];   // active PF2e conditions (frightened, prone, …)
  effects: EffectView[];         // active PF2e effects (spell buffs, …)
```

And replace the `TokenLike.actor` member with this expanded shape:

```ts
  actor?: {
    id: string;
    hasPlayerOwner?: boolean;
    isOwner?: boolean;             // current viewer owns this actor (un-masks unidentified effects)
    system?: { attributes?: { hp?: { value?: number; max?: number } } };
    conditions?: { active: ConditionLike[] };
    itemTypes?: { effect: EffectLike[] };
  } | null;
```

**3c.** In `src/foundry/scene/view.ts`, add these imports below the existing `import type { ... } from "./types";`:

```ts
import type { ConditionView, EffectView, ConditionLike, EffectLike } from "../actor/types";
import { effectBadgeLabel } from "../actor/view";
```

Inside `buildSceneView`, in the `for (const t of raw)` loop, add these three lines just before the `tokens.push({` call:

```ts
    const canIdentifyEffects = ctx.isGM || t.actor?.isOwner === true;
    const conditions = mapTokenConditions(t.actor?.conditions?.active ?? []);
    const effects = mapTokenEffects(t.actor?.itemTypes?.effect ?? [], canIdentifyEffects);
```

And add `conditions` and `effects` to the pushed object (e.g. right after the `hp,` line):

```ts
      hp,
      conditions,
      effects,
    });
```

Finally, add these two module-private helpers at the end of the file (after the `buildSceneView` function):

```ts
/** Map a token actor's active conditions to the shared ConditionView shape
 *  (mirrors the character sheet's mapConditions). */
function mapTokenConditions(active: ConditionLike[]): ConditionView[] {
  return active.map((c) => ({
    slug: c.slug, name: c.name, value: c.value, img: c.img, locked: c.isLocked ?? false,
  }));
}

/** Map a token actor's effects to the shared EffectView shape. An effect flagged
 *  `unidentified` is shown as a neutral "Effect" (no badge) unless the viewer can
 *  identify it (GM or the actor's owner), so its real name never leaks on the map. */
function mapTokenEffects(effects: EffectLike[], canIdentify: boolean): EffectView[] {
  return effects.map((e) => {
    const masked = e.unidentified === true && !canIdentify;
    return {
      id: e.id,
      name: masked ? "Effect" : e.name,
      img: e.img,
      badge: masked ? null : effectBadgeLabel(e.badge),
    };
  });
}
```

- [ ] **Step 4: Run the tests and typecheck to verify green**

Run: `npm test -- sceneView`
Expected: PASS — all `buildSceneView` cases (existing + 4 new) pass.

Run: `npm run typecheck`
Expected: no errors (the new imports resolve; no import cycle — `actor/*` does not import `scene/*`).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/actor/types.ts src/foundry/scene/types.ts src/foundry/scene/view.ts tests/sceneView.test.ts
git commit -m "feat(map): map token conditions & effects onto TokenView (+ unidentified mask)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Refresh the map on condition/effect changes (`useScene` item hooks)

**Files:**
- Modify: `src/app/map/useScene.ts:21-23`

No unit test: this is Foundry-hook wiring (the project's other live hooks — `useActor`, `useStrikes`, `useToggles`, `useSpells` — are likewise verified by build + live play, not unit tests). Conditions/effects are embedded items, so they fire `createItem`/`updateItem`/`deleteItem`, **not** `updateActor`; without these the icons would go stale.

- [ ] **Step 1: Add the three item hooks**

In `src/foundry/../app/map/useScene.ts`, just after the existing `useFoundryHook("updateActor", onChange);` line, add:

```ts
  useFoundryHook("createItem", onChange);
  useFoundryHook("updateItem", onChange);
  useFoundryHook("deleteItem", onChange);
```

(No other change — `sceneArg.tokens` already forwards the live `scene.tokens` collection, so `t.actor.conditions.active` / `t.actor.itemTypes.effect` resolve live in the mapper.)

- [ ] **Step 2: Verify typecheck, tests, and build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: PASS — full suite green (≈210 tests; 206 prior + 4 from Task 1).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/map/useScene.ts
git commit -m "feat(map): re-prep the scene on item create/update/delete (live condition/effect updates)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Status-icon row on the token sprite

**Files:**
- Modify: `src/app/map/TokenSprite.tsx`

Presentational glue (no unit test; verified by build + live play, like the rest of the sprite). Icons are `pointer-events-none` so token drag/tap behavior is unchanged.

- [ ] **Step 1: Compute the capped icon list**

In `src/app/map/TokenSprite.tsx`, after the existing `const hpColor = ...;` line (and before `return (`), add:

```ts
  // Conditions first, then effects; combine, cap at 4 slots, show "+N" when more.
  const statuses: { key: string; img: string | null; value: number | null }[] = [
    ...token.conditions.map((c) => ({ key: `c-${c.slug}`, img: c.img ?? null, value: c.value })),
    ...token.effects.map((e, i) => ({ key: `e-${e.id ?? i}`, img: e.img ?? null, value: null })),
  ];
  const MAX_ICONS = 4;
  const overflow = statuses.length > MAX_ICONS ? statuses.length - (MAX_ICONS - 1) : 0;
  const shownStatuses = overflow > 0 ? statuses.slice(0, MAX_ICONS - 1) : statuses;
```

- [ ] **Step 2: Render the row**

In the same file, insert this block **immediately after** the portrait `</div>` (the `<div className={\`h-full w-full overflow-hidden rounded bg-zinc-800 ...\`}>...</div>`) and **before** the `{token.targeted && (` block:

```tsx
      {statuses.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex">
          {shownStatuses.map((s) => (
            <div key={s.key} className="relative aspect-square w-1/4 overflow-hidden rounded-[2px] bg-zinc-900/70 ring-1 ring-black/50">
              {s.img ? (
                <img src={s.img} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full bg-zinc-600" />
              )}
              {s.value != null && (
                <span className="absolute bottom-0 right-0 rounded-tl-[2px] bg-black/85 px-[1px] text-[7px] font-bold leading-none text-white">
                  {s.value}
                </span>
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div className="flex aspect-square w-1/4 items-center justify-center rounded-[2px] bg-black/80 text-[7px] font-bold leading-none text-white ring-1 ring-black/50">
              +{overflow}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/map/TokenSprite.tsx
git commit -m "feat(map): show condition/effect status icons on the token sprite (capped + value badge)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Conditions/Effects sections in the token info popup

**Files:**
- Modify: `src/app/map/TokenInfoPopup.tsx`

Read-only chip sections (no long-press remove — removal is a sheet action). Reuses the character sheet's `Chip`.

- [ ] **Step 1: Import `Chip`**

In `src/app/map/TokenInfoPopup.tsx`, add below the existing `import { Modal } from "../sheet/parts/Modal";` line:

```ts
import { Chip } from "../sheet/parts/Chip";
```

- [ ] **Step 2: Render the sections**

Insert this block **after** the closing `</div>` of the `<div className="flex gap-3">…</div>` portrait/HP row and **before** the `<button onClick={() => toggleTarget(token.id)} …>` Target button:

```tsx
      {(token.conditions.length > 0 || token.effects.length > 0) && (
        <div className="mt-4 space-y-2">
          {token.conditions.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Conditions</div>
              <div className="flex flex-wrap gap-1">
                {token.conditions.map((c) => (
                  <Chip key={c.slug} tone="warn">{c.name}{c.value != null ? ` ${c.value}` : ""}</Chip>
                ))}
              </div>
            </div>
          )}
          {token.effects.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Effects</div>
              <div className="flex flex-wrap gap-1">
                {token.effects.map((e, i) => (
                  <Chip key={e.id ?? `e${i}`}>{e.name}{e.badge ? ` ${e.badge}` : ""}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Verify typecheck and build**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/map/TokenInfoPopup.tsx
git commit -m "feat(map): list conditions & effects in the token info popup (read-only chips)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full verification + handoff notes

- [ ] **Step 1: Run the full gate**

Run: `npm test` → Expected: PASS (≈210 tests).
Run: `npm run typecheck` → Expected: clean.
Run: `npm run build` → Expected: succeeds.

- [ ] **Step 2: Live play-test checklist (in Foundry, on the Map tab)**

These cannot be unit-tested (live Foundry/PF2e); verify by hand:
- A token with a condition (e.g. apply **Frightened 2** / **Prone**) shows icon(s) on the sprite, value badge on Frightened.
- A token with a spell effect (e.g. **Bless**) shows its icon; tapping the token lists it under **Effects**.
- Applying/removing a condition updates the sprite within ~1s (confirms the item hooks).
- An **enemy/NPC** token shows its conditions/effects to a player (HP stays hidden) — confirms no owner gating.
- More than 4 statuses → 3 icons + "+N"; tap shows the full list.
- (If testable) an **unidentified** effect shows as a generic icon and reads "Effect" for a non-owner player, full name for the GM/owner.

- [ ] **Step 3: Update project memory**

Append a one-line pointer in `C:\Users\diomi\.claude\projects\E--React-Projects-pf2e-mobile-companion\memory\MEMORY.md` and write/update a short memory file noting: map token conditions & effects (sprite icons + popup list, all visible tokens, unidentified-masked) — code-complete on `main`, pending live play-test.

---

## Self-review

**Spec coverage:**
- Types (`TokenView`/`TokenLike.actor`, reuse `ConditionView`/`EffectView`, `EffectLike.unidentified`) → Task 1 (3a/3b). ✓
- Mapper + all-visible-tokens visibility + unidentified rule → Task 1 (3c, tests). ✓
- Live updates (item hooks) → Task 2. ✓
- Sprite icon row (cap 4 + "+N", value badge, pointer-events-none) → Task 3. ✓
- Popup read-only sections → Task 4. ✓
- Testing (5 spec bullets) → Task 1 Step 1 (4 cases cover map/value/badge, NPC-no-gating, empty arrays, unidentified ×3 viewers). ✓
- Out-of-scope items (per-icon tap, removal, tooltips) → not built. ✓

**Placeholder scan:** none — every code step shows complete code; every run step states the exact command + expected result.

**Type consistency:** `conditions`/`effects` field names identical across `TokenView`, mapper, tests, `TokenSprite`, `TokenInfoPopup`. Helpers `mapTokenConditions`/`mapTokenEffects` named consistently; `canIdentifyEffects` (local) passed as `canIdentify` (param). `MAX_ICONS`/`overflow`/`shownStatuses` consistent within Task 3. `effectBadgeLabel` is already `export`ed from `actor/view.ts`. `Chip` props (`tone="warn"`, children) match `Chip.tsx`.
