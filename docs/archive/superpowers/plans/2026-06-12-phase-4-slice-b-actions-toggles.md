# Phase 4 — Slice B — Actions List + Toggles Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Commit per task to `main` with `Phase 4 (Task N): …` + the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer.

**Goal:** Finish the Actions tab — a grouped **Actions/activities list** (Encounter → Exploration → Downtime) where each row can be **Used** (posts the PF2e action card, decrementing limited-use frequency), plus a pinned **Toggles** strip for combat roll-options (Rage / Panache / stances).

**Architecture:** Same pattern as Strikes (Slice A): **pure sync mappers** read the prepared actor into serializable view data + stable ids; **guarded action functions** re-read the live item/actor and call its methods; **PF2e posts the real chat card**. Two new mappers (`buildActionsView`, `buildTogglesView`), two guarded actions (`useAction`, `setToggle`), sync hooks (mirror `useStrikes`), and UI (`ActionsList`, `ToggleBar`) wired into `ActionsTab`. Tap an action name → existing `DetailModal`.

**Tech Stack:** TypeScript, React 18, Vitest, Tailwind v4. Live PF2e API.

---

## Ground truth (verified against `E:/React Projects/pf2e`, commit 220b300b)

| Concern | Source | Fact |
|---|---|---|
| Action items | `item/ability/document.ts:33-45` | `actionCost` getter = `null` (passive) or `{ type: "action"\|"reaction"\|"free", value: 1\|2\|3\|null }`; `frequency` = `system.frequency` (`{value,max,per}\|null`). |
| Feat actions | `item/feat/document.ts:51-63` | `actionCost` = `null` if `actionType.value==="passive"`, else `{type, value: actions.value}`. |
| Sheet list + group | `actor/character/sheet.ts:400-464` | Loop `actor.items`; keep `isOfType("action")` OR (`feat` && `actionCost`); skip `item.suppressed`; `traits.includes("exploration")`→exploration (active if `actor.system.exploration.includes(item.id)`), `"downtime"`→downtime, else `encounter[actionCost?.type ?? "free"]`; sort each by name. |
| Use action | `chat-message/helpers.ts:18-46` (`createUseActionMessage`) | if `system.frequency && value>0` → `await item.update({"system.frequency.value": value-1})`; then `item.toMessage(null,{mode})`. (selfEffect/crafting branches deferred.) |
| `toMessage` | `item/base/document.ts:210` | `toMessage(event?, {mode?,create?,data?})` — no-arg call posts a public card. |
| Toggles store | `rules/synthetics.ts` + `rule-element/roll-option/rule-element.ts:296-312` | `actor.synthetics.toggles` = `Record<domain, Record<option, RollOptionToggle>>`; each `{itemId,label,placement,domain,option,suboptions,alwaysActive,checked,enabled}`. `checked` = real resolved value (`:309`); `enabled` = `!disabledIf` (`:270`); default `placement` = `"actions"` (`:300`). |
| Toggle flatten | `actor/sheet/base.ts:149-153` | sheet does `Object.values(toggles).flatMap(d => Object.values(d))` grouped by `placement`. |
| Toggle flip | `actor/base.ts:946-965` | `toggleRollOption(domain, option, itemId?, value?, suboption?)` → `Promise<boolean\|null>`; sheet calls `toggleRollOption(domain, option, itemId ?? null, checkbox.checked, suboption)` (`sheet/base.ts:472`). |
| Sync? | `character/sheet.ts:290` | `actions` + `synthetics.toggles` are prepared during sync actor data-prep — a sync mapper (like `useStrikes`) is correct, not the async `useSpells` path. |

**Design decisions for the mobile mirror:**
- **Action items**: include all (even passive); **feats**: only with `actionCost`. Skip `suppressed`. (Kineticist elemental-blast de-dupe is an edge case — **deferred**, noted.)
- **Groups** (ordered, non-empty only): `Actions` / `Reactions` / `Free Actions` (encounter, by `actionCost.type`) → `Exploration` → `Downtime`. Each sorted by name.
- **Toggles strip**: filter to `placement === "actions"` (the default → combat toggles). Suboptions **deferred** (v1 toggles the base option). `alwaysActive` toggles render checked + disabled.
- **Use**: replicate frequency-decrement + `toMessage` (selfEffect/crafting deferred — most actions just post their card).

---

## File structure

| File | Change |
|---|---|
| `src/foundry/actor/types.ts` | Add `ActionItemView`, `ActionGroupView`, `ActionsView`, `ToggleView`, `TogglesView`, and the source-likes (`ActionItemLike`, `ActionsActorLike`, `RollOptionToggleLike`, `TogglesActorLike`). |
| `src/foundry/actor/actions.ts` (new) | `buildActionsView(actor)` (pure, sync). |
| `src/foundry/actor/toggles.ts` (new) | `buildTogglesView(actor)` (pure) + guarded `setToggle(...)`. |
| `src/foundry/actor/actionUse.ts` (new) | guarded `useAction(actorId, itemId)`. |
| `src/app/actions/useActionsList.ts` (new) | sync hook (mirror `useStrikes`). |
| `src/app/actions/useToggles.ts` (new) | sync hook. |
| `src/app/actions/ActionsList.tsx` (new) | grouped list (glyph + name + frequency pill + Use; tap name → detail). |
| `src/app/actions/ToggleBar.tsx` (new) | pinned checkbox strip. |
| `src/app/tabs/ActionsTab.tsx` | render `<ToggleBar>` pinned + `<ActionsList>` for the Actions segment; owns a `detailId` for `DetailModal`. |

Tests: `tests/actionsView.test.ts`, `tests/togglesView.test.ts`, `tests/actionUse.test.ts`, `tests/toggles.test.ts`.

---

### Task 1: Actions mapper — `buildActionsView`

**Files:** Create `src/foundry/actor/actions.ts`; modify `src/foundry/actor/types.ts`; Test `tests/actionsView.test.ts`.

- [ ] **Step 1: Add view + source types** to `src/foundry/actor/types.ts` (after the Strikes block):

```ts
// ---------- Actions list (Phase 4 Slice B) ----------

/** One action/activity row. `glyph` is an ActionGlyph code ("1"/"2"/"3"/"reaction"/"free") or null. */
export interface ActionItemView {
  id: string;
  name: string;
  img?: string;
  glyph: string | null;
  traits: string[];
  frequency: { value: number; max: number; per: string } | null;
}
export interface ActionGroupView { key: string; label: string; actions: ActionItemView[]; }
export type ActionsView = ActionGroupView[];

/** Live action/feat item, structurally (read by the mapper). */
export interface ActionItemLike {
  id: string;
  name: string;
  img?: string;
  type: string;
  suppressed?: boolean;
  system?: {
    actionType?: { value?: string | null };
    actions?: { value?: number | null };
    traits?: { value?: string[] };
    frequency?: { value?: number; max?: number; per?: string } | null;
  };
}
export interface ActionsActorLike {
  itemTypes?: { action?: ActionItemLike[]; feat?: ActionItemLike[] };
  system?: { exploration?: string[] };
}
```

- [ ] **Step 2: Write the failing test** `tests/actionsView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildActionsView } from "../src/foundry/actor/actions";
import type { ActionItemLike, ActionsActorLike } from "../src/foundry/actor/types";

const action = (over: Partial<ActionItemLike> & { id: string; name: string }): ActionItemLike => ({
  type: "action",
  system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] }, frequency: null },
  ...over,
});

describe("buildActionsView", () => {
  it("groups encounter actions by cost type, ordered Actions/Reactions/Free, sorted by name", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "b", name: "Bravado", system: { actionType: { value: "free" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "r", name: "Riposte", system: { actionType: { value: "reaction" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "z", name: "Zephyr", system: { actionType: { value: "action" }, actions: { value: 2 }, traits: { value: [] } } }),
          action({ id: "a", name: "Aid", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
        ],
        feat: [],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    expect(v.map((g) => g.key)).toEqual(["action", "reaction", "free"]);
    expect(v[0].actions.map((a) => [a.name, a.glyph])).toEqual([["Aid", "1"], ["Zephyr", "2"]]);
    expect(v[1].actions[0]).toMatchObject({ name: "Riposte", glyph: "reaction" });
    expect(v[2].actions[0]).toMatchObject({ name: "Bravado", glyph: "free" });
  });

  it("splits exploration (and ignores downtime ordering) and carries frequency", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "e", name: "Search", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: ["exploration"] } } }),
          action({ id: "d", name: "Earn Income", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: ["downtime"] } } }),
          action({ id: "f", name: "Goblin Song", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] }, frequency: { value: 1, max: 1, per: "PT1M" } } }),
        ],
        feat: [],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    expect(v.find((g) => g.key === "exploration")?.actions[0].name).toBe("Search");
    expect(v.find((g) => g.key === "downtime")?.actions[0].name).toBe("Earn Income");
    expect(v.find((g) => g.key === "action")?.actions[0].frequency).toEqual({ value: 1, max: 1, per: "PT1M" });
  });

  it("includes only feats with an action cost, skips suppressed, includes passive action items as free", () => {
    const actor: ActionsActorLike = {
      itemTypes: {
        action: [
          action({ id: "p", name: "Passive Thing", system: { actionType: { value: "passive" }, actions: { value: null }, traits: { value: [] } } }),
          action({ id: "s", name: "Suppressed", suppressed: true, system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
        ],
        feat: [
          action({ id: "fa", name: "Feat Action", type: "feat", system: { actionType: { value: "action" }, actions: { value: 1 }, traits: { value: [] } } }),
          action({ id: "fp", name: "Passive Feat", type: "feat", system: { actionType: { value: "passive" }, actions: { value: null }, traits: { value: [] } } }),
        ],
      },
      system: { exploration: [] },
    };
    const v = buildActionsView(actor);
    const free = v.find((g) => g.key === "free")?.actions.map((a) => a.name) ?? [];
    const acts = v.find((g) => g.key === "action")?.actions.map((a) => a.name) ?? [];
    expect(free).toEqual(["Passive Thing"]); // passive action item → free bucket, glyph null
    expect(acts).toEqual(["Feat Action"]); // feat with cost included; passive feat + suppressed excluded
    expect(v.find((g) => g.key === "free")?.actions[0].glyph).toBeNull();
  });

  it("returns [] for an actor with no actions", () => {
    expect(buildActionsView({})).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — verify it fails** (`buildActionsView` not defined): `npm test -- actionsView` → FAIL.

- [ ] **Step 4: Implement** `src/foundry/actor/actions.ts`:

```ts
import type { ActionItemLike, ActionsActorLike, ActionItemView, ActionsView } from "./types";

type Cost = { type: "action" | "reaction" | "free"; value: number | null } | null;

/** Mirror PF2e's `actionCost` getters (ability/feat document.ts): null for passive. */
function actionCost(it: ActionItemLike): Cost {
  const type = it.system?.actionType?.value || "passive";
  if (type !== "action" && type !== "reaction" && type !== "free") return null;
  return { type, value: it.system?.actions?.value ?? null };
}

function glyphOf(cost: Cost): string | null {
  if (!cost) return null;
  if (cost.type === "reaction") return "reaction";
  if (cost.type === "free") return "free";
  return cost.value ? String(cost.value) : null;
}

function toView(it: ActionItemLike, cost: Cost): ActionItemView {
  const f = it.system?.frequency;
  return {
    id: it.id,
    name: it.name,
    img: it.img,
    glyph: glyphOf(cost),
    traits: it.system?.traits?.value ?? [],
    frequency: f && typeof f.value === "number" && typeof f.max === "number"
      ? { value: f.value, max: f.max, per: f.per ?? "" }
      : null,
  };
}

/** Pure: group an actor's actions/activities the way PF2e's sheet does
 *  (`character/sheet.ts:400-464`): encounter (by cost type) / exploration / downtime,
 *  each sorted by name. Action items are always kept (even passive); feats only with
 *  an action cost; suppressed items are skipped. */
export function buildActionsView(actor: ActionsActorLike): ActionsView {
  const buckets: Record<string, ActionItemView[]> = { action: [], reaction: [], free: [], exploration: [], downtime: [] };
  const explorationIds = actor.system?.exploration ?? [];
  void explorationIds; // active/other split is a desktop nicety; mobile lists exploration flat

  const consider = (it: ActionItemLike, isFeat: boolean) => {
    if (it.suppressed) return;
    const cost = actionCost(it);
    if (isFeat && !cost) return; // feats: only with an action cost
    const traits = it.system?.traits?.value ?? [];
    if (traits.includes("exploration")) buckets.exploration.push(toView(it, cost));
    else if (traits.includes("downtime")) buckets.downtime.push(toView(it, cost));
    else buckets[cost?.type ?? "free"].push(toView(it, cost));
  };
  (actor.itemTypes?.action ?? []).forEach((it) => consider(it, false));
  (actor.itemTypes?.feat ?? []).forEach((it) => consider(it, true));

  const order: { key: string; label: string }[] = [
    { key: "action", label: "Actions" },
    { key: "reaction", label: "Reactions" },
    { key: "free", label: "Free Actions" },
    { key: "exploration", label: "Exploration" },
    { key: "downtime", label: "Downtime" },
  ];
  const byName = (a: ActionItemView, b: ActionItemView) => a.name.localeCompare(b.name);
  return order
    .map(({ key, label }) => ({ key, label, actions: buckets[key].sort(byName) }))
    .filter((g) => g.actions.length > 0);
}
```

- [ ] **Step 5: Run — verify pass** (`npm test -- actionsView`) and **typecheck** (`npm run typecheck`).

- [ ] **Step 6: Commit** — `Phase 4 (Task 1): buildActionsView (grouped actions/activities mapper)`.

---

### Task 2: Toggles mapper + `setToggle`

**Files:** Create `src/foundry/actor/toggles.ts`; modify `src/foundry/actor/types.ts`; Test `tests/togglesView.test.ts`, `tests/toggles.test.ts`.

- [ ] **Step 1: Add types** to `src/foundry/actor/types.ts`:

```ts
// ---------- Toggles (Phase 4 Slice B) ----------

/** One combat roll-option toggle (Rage / Panache / stance …). */
export interface ToggleView { domain: string; option: string; itemId: string; label: string; checked: boolean; enabled: boolean; }
export type TogglesView = ToggleView[];

export interface RollOptionToggleLike {
  itemId?: string; label?: string; placement?: string; domain?: string; option?: string;
  checked?: boolean; enabled?: boolean; alwaysActive?: boolean;
}
export interface TogglesActorLike {
  synthetics?: { toggles?: Record<string, Record<string, RollOptionToggleLike>> };
}
```

- [ ] **Step 2: Write failing tests** `tests/togglesView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTogglesView } from "../src/foundry/actor/toggles";
import type { TogglesActorLike } from "../src/foundry/actor/types";

describe("buildTogglesView", () => {
  it("flattens actions-placement toggles across domains, mapping checked/enabled", () => {
    const actor: TogglesActorLike = {
      synthetics: {
        toggles: {
          "all": { "rage": { itemId: "i1", label: "Rage", placement: "actions", domain: "all", option: "rage", checked: true, enabled: true } },
          "attack-roll": { "panache": { itemId: "i2", label: "Panache", placement: "actions", domain: "attack-roll", option: "panache", checked: false, enabled: true } },
        },
      },
    };
    expect(buildTogglesView(actor)).toEqual([
      { domain: "all", option: "rage", itemId: "i1", label: "Rage", checked: true, enabled: true },
      { domain: "attack-roll", option: "panache", itemId: "i2", label: "Panache", checked: false, enabled: false ? false : true },
    ]);
  });

  it("excludes non-actions placements and tolerates missing synthetics", () => {
    const actor: TogglesActorLike = {
      synthetics: { toggles: { "d": { "x": { itemId: "i", label: "X", placement: "encounter", domain: "d", option: "x", checked: false, enabled: true } } } },
    };
    expect(buildTogglesView(actor)).toEqual([]);
    expect(buildTogglesView({})).toEqual([]);
  });
});
```

- [ ] **Step 3: Write failing test** `tests/toggles.test.ts` (guarded `setToggle`):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setToggle } from "../src/foundry/actor/toggles";

interface Call { args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const actor = { toggleRollOption: (...args: unknown[]) => { calls.push({ args }); return Promise.resolve(true); } };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("setToggle", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("calls actor.toggleRollOption(domain, option, itemId, value)", async () => {
    await setToggle("a", "all", "rage", "i1", true);
    expect(calls[0].args).toEqual(["all", "rage", "i1", true]);
  });

  it("never throws when the actor is gone", async () => {
    (globalThis as { game?: unknown }).game = { actors: { get: () => undefined } };
    await expect(setToggle("a", "all", "rage", "i1", false)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Run — verify both fail** (`npm test -- togglesView toggles`).

- [ ] **Step 5: Implement** `src/foundry/actor/toggles.ts`:

```ts
import type { TogglesActorLike, TogglesView } from "./types";

/** Pure: flatten `actor.synthetics.toggles[domain][option]` (mirrors the sheet's
 *  `actor/sheet/base.ts:149-153`) to the actions-placement combat toggles. */
export function buildTogglesView(actor: TogglesActorLike): TogglesView {
  const domains = actor.synthetics?.toggles ?? {};
  const out: TogglesView = [];
  for (const byOption of Object.values(domains)) {
    for (const t of Object.values(byOption ?? {})) {
      if ((t.placement ?? "actions") !== "actions") continue;
      out.push({
        domain: t.domain ?? "",
        option: t.option ?? "",
        itemId: t.itemId ?? "",
        label: t.label ?? "",
        checked: !!t.checked,
        enabled: t.alwaysActive ? false : t.enabled !== false,
      });
    }
  }
  return out;
}

interface ToggleActor { toggleRollOption(domain: string, option: string, itemId: string | null, value: boolean): Promise<unknown>; }

/** Guarded: flip a roll-option toggle (mirrors the sheet handler `sheet/base.ts:472`). */
export function setToggle(actorId: string, domain: string, option: string, itemId: string, value: boolean): Promise<void> {
  return (async () => {
    try {
      const actor = (game as any)?.actors?.get(actorId) as ToggleActor | undefined;
      if (!actor?.toggleRollOption) throw new Error(`actor ${actorId} cannot toggle`);
      await actor.toggleRollOption(domain, option, itemId || null, value);
    } catch (err) {
      console.error("[pf2e-mobile] setToggle failed", err);
      (ui as any)?.notifications?.error?.("Toggle failed — see console.");
    }
  })();
}
```

> Note: `enabled` is mapped to **false** for `alwaysActive` toggles (always-on → not user-changeable), matching how PF2e renders them disabled-checked. The `buildTogglesView` test's `panache` row expects `enabled: true` (not always-active).

- [ ] **Step 6: Run pass + typecheck**, then **Commit** — `Phase 4 (Task 2): buildTogglesView + setToggle (combat roll-option toggles)`.

---

### Task 3: `useAction` — frequency decrement + `toMessage`

**Files:** Create `src/foundry/actor/actionUse.ts`; Test `tests/actionUse.test.ts`.

- [ ] **Step 1: Write the failing test** `tests/actionUse.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAction } from "../src/foundry/actor/actionUse";

interface Call { method: string; args: unknown[]; }

function stub(freq?: { value: number; max: number; per: string }): Call[] {
  const calls: Call[] = [];
  const item = {
    system: { frequency: freq ?? null },
    update: (...args: unknown[]) => { calls.push({ method: "update", args }); return Promise.resolve(); },
    toMessage: (...args: unknown[]) => { calls.push({ method: "toMessage", args }); return Promise.resolve({}); },
  };
  const actor = { items: { get: (id: string) => (id === "i1" ? item : undefined) } };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("useAction", () => {
  let calls: Call[];

  it("posts the action card (no frequency → no update)", async () => {
    calls = stub();
    await useAction("a", "i1");
    expect(calls.map((c) => c.method)).toEqual(["toMessage"]);
  });

  it("decrements a limited frequency before posting", async () => {
    calls = stub({ value: 2, max: 3, per: "day" });
    await useAction("a", "i1");
    expect(calls[0]).toEqual({ method: "update", args: [{ "system.frequency.value": 1 }] });
    expect(calls[1].method).toBe("toMessage");
  });

  it("does not decrement an exhausted frequency (value 0) but still posts", async () => {
    calls = stub({ value: 0, max: 1, per: "day" });
    await useAction("a", "i1");
    expect(calls.map((c) => c.method)).toEqual(["toMessage"]);
  });

  it("never throws when the item is gone", async () => {
    calls = stub();
    await expect(useAction("a", "missing")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — verify fail** (`npm test -- actionUse`).

- [ ] **Step 3: Implement** `src/foundry/actor/actionUse.ts`:

```ts
type Dict = Record<string, unknown>;

interface UsableItem {
  system?: { frequency?: { value?: number } | null };
  update(data: Dict): Promise<unknown>;
  toMessage(event?: unknown, opts?: Dict): Promise<unknown>;
}

/** Guarded: use an action/activity. Mirrors PF2e's `createUseActionMessage`
 *  (`chat-message/helpers.ts:18-46`): decrement a limited `system.frequency.value`
 *  first, then post the action card via `item.toMessage()`. (selfEffect/crafting
 *  branches are deferred — most actions just post their description card.) */
export function useAction(actorId: string, itemId: string): Promise<void> {
  return (async () => {
    try {
      const item = (game as any)?.actors?.get(actorId)?.items?.get(itemId) as UsableItem | undefined;
      if (!item?.toMessage) throw new Error(`no usable item ${itemId} on actor ${actorId}`);
      const value = item.system?.frequency?.value;
      if (typeof value === "number" && value > 0) {
        await item.update({ "system.frequency.value": value - 1 });
      }
      await item.toMessage();
    } catch (err) {
      console.error("[pf2e-mobile] useAction failed", err);
      (ui as any)?.notifications?.error?.("Action failed — see console.");
    }
  })();
}
```

- [ ] **Step 4: Run pass + typecheck**, then **Commit** — `Phase 4 (Task 3): useAction (frequency decrement + toMessage)`.

---

### Task 4: Hooks + UI + `ActionsTab` wiring

**Files:** Create `src/app/actions/useActionsList.ts`, `useToggles.ts`, `ActionsList.tsx`, `ToggleBar.tsx`; modify `src/app/tabs/ActionsTab.tsx`. Verified by typecheck + build + live.

- [ ] **Step 1: Sync hooks** (mirror `useStrikes`). `src/app/actions/useActionsList.ts`:

```ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildActionsView } from "../../foundry/actor/actions";
import type { ActionsActorLike, ActionsView } from "../../foundry/actor/types";

/** Live grouped actions for the active actor (sync data-prep, like useStrikes). */
export function useActionsList(actorId: string): ActionsView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onActor = useCallback((doc: any) => { if (doc?.id === actorId) bump(); }, [actorId]);
  const onItem = useCallback((doc: any) => { if ((doc?.parent?.id ?? doc?.actor?.id) === actorId) bump(); }, [actorId]);
  useFoundryHook("updateActor", onActor);
  useFoundryHook("createItem", onItem);
  useFoundryHook("updateItem", onItem);
  useFoundryHook("deleteItem", onItem);
  return useMemo(() => {
    const actor = (game as any).actors.get(actorId);
    if (!actor) return null;
    return buildActionsView(actor as ActionsActorLike);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
```

`src/app/actions/useToggles.ts` — identical shape, calling `buildTogglesView` → `TogglesView`.

- [ ] **Step 2: `ToggleBar.tsx`** (pinned strip; checkbox = `<label>`+`<input>`, NOT a bordered `<button>` per the Tailwind-v4 gotcha):

```tsx
import type { ToggleView } from "../../foundry/actor/types";

export function ToggleBar({ toggles, onToggle }: {
  toggles: ToggleView[];
  onToggle: (t: ToggleView, value: boolean) => void;
}) {
  if (toggles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      {toggles.map((t) => (
        <label
          key={`${t.domain}:${t.option}:${t.itemId}`}
          className={`flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium ${t.enabled ? "cursor-pointer text-zinc-100" : "cursor-not-allowed text-zinc-500"}`}
        >
          <input
            type="checkbox"
            checked={t.checked}
            disabled={!t.enabled}
            onChange={(e) => onToggle(t, e.target.checked)}
            className="h-3.5 w-3.5 accent-indigo-500"
          />
          <span>{t.label}</span>
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `ActionsList.tsx`** (grouped; row = glyph + name (tap → detail) + frequency pill + Use):

```tsx
import type { ActionsView } from "../../foundry/actor/types";
import { ActionGlyph } from "../sheet/parts/ActionGlyph";

export function ActionsList({ groups, onUse, onShowDetail }: {
  groups: ActionsView;
  onUse: (id: string) => void;
  onShowDetail: (id: string) => void;
}) {
  if (groups.length === 0) return <div className="p-4 text-sm text-zinc-500">No actions.</div>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{g.label}</h3>
          <div className="divide-y divide-zinc-800">
            {g.actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                {a.img && <img src={a.img} alt="" className="h-7 w-7 rounded object-cover" />}
                <button onClick={() => onShowDetail(a.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                  {a.name}
                </button>
                {a.frequency && (
                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {a.frequency.value}/{a.frequency.max}
                  </span>
                )}
                <ActionGlyph code={a.glyph} />
                <button
                  onClick={() => onUse(a.id)}
                  className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire `ActionsTab.tsx`** — add the pinned `ToggleBar` (always visible), render `ActionsList` for the Actions segment, own a `detailId` for `DetailModal`. Add imports:

```tsx
import { useToggles } from "../actions/useToggles";
import { useActionsList } from "../actions/useActionsList";
import { ToggleBar } from "../actions/ToggleBar";
import { ActionsList } from "../actions/ActionsList";
import { DetailModal } from "../sheet/DetailModal";
import { setToggle } from "../../foundry/actor/toggles";
import { useAction } from "../../foundry/actor/actionUse";
```

Add state + hooks inside the component (after the existing `strikes`):

```tsx
  const toggles = useToggles(actorId ?? "");
  const actionsList = useActionsList(actorId ?? "");
  const [detailId, setDetailId] = useState<string | null>(null);
```

Render the pinned strip **above** the segmented nav, the Actions segment, and the detail modal. Replace the existing Actions-segment placeholder block:

```tsx
      {toggles && toggles.length > 0 && (
        <ToggleBar toggles={toggles} onToggle={(t, value) => void setToggle(actorId, t.domain, t.option, t.itemId, value)} />
      )}
```
(place this immediately inside the root `<div>`, before `<nav>`), and

```tsx
      {section === "actions" &&
        (actionsList === null ? (
          <div className="p-4 text-sm text-zinc-500">Loading actions…</div>
        ) : (
          <ActionsList
            groups={actionsList}
            onUse={(id) => void useAction(actorId, id)}
            onShowDetail={(id) => setDetailId(id)}
          />
        ))}

      {detailId && <DetailModal actorId={actorId} itemId={detailId} onClose={() => setDetailId(null)} />}
```
(replacing the `section === "actions"` "coming next" placeholder).

- [ ] **Step 5: Typecheck** (`npm run typecheck`) → clean.
- [ ] **Step 6: Production build** (`npm run build`) → succeeds.
- [ ] **Step 7: Full test run** (`npm test`) → green.
- [ ] **Step 8: Commit** — `Phase 4 (Task 4): Actions list + Toggles bar UI (hooks, ToggleBar, ActionsList, tab wiring)`.

---

## Live verification (after Task 4)

`npm run dev`; Player1 @ mobile width; a martial actor (Valeros) and ideally a Barbarian/Swashbuckler (for a combat toggle). Confirm:
1. **Actions** segment lists actions grouped Actions/Reactions/Free/Exploration/Downtime; names + glyphs + frequency pills correct.
2. **Use** posts the action's card to Chat; a limited-frequency action's pill drops by 1 (and persists).
3. Tap an action **name** → the detail popup shows its rules text.
4. **Toggles strip** shows combat toggles (Rage/Panache/stance); toggling one flips it (verify it sticks + affects a subsequent roll's breakdown); `alwaysActive` ones render checked+disabled.

---

## Self-review

- **Spec coverage** — Slice B spec §"Actions list" → Tasks 1, 3, 4; §"Toggles bar" → Tasks 2, 4. Grouping mirrors `sheet.ts:400-464`; use mirrors `createUseActionMessage`; toggles mirror `sheet/base.ts:149-153,472` + `toggleRollOption`.
- **Type consistency** — `buildActionsView(ActionsActorLike): ActionsView`; `buildTogglesView(TogglesActorLike): TogglesView`; `useAction(actorId,itemId)`; `setToggle(actorId,domain,option,itemId,value)`; `ToggleView`/`ActionItemView` used identically in mappers, hooks, and components.
- **Placeholders** — none; all steps show code + commands.
- **Deferred (noted, not blockers)** — toggle **suboptions** (stance variants), action **selfEffect/crafting** branches, kineticist elemental-blast de-dupe, exploration active/other split. Each is a niche path; v1 covers the common case and degrades cleanly.
