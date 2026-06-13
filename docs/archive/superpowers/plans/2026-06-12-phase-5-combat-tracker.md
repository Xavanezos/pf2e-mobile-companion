# Phase 5 — Initiative & Combat Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, player-facing **Combat** tab that mirrors what Foundry's stock encounter tracker shows a player — the initiative order (portraits, names, initiative, HP), the round number, whose turn it is — plus a Roll Initiative button, an End My Turn button, and a vibrate buzz when the active character's turn begins.

**Architecture:** Follows the established codebase pattern — a **pure sync mapper** (`buildEncounterView`) reads `game.combat` + a `{ isGM, characterActorId }` context and owns every visibility rule, a **version-bumped hook** (`useEncounter`) re-preps on the six combat document hooks, **guarded actions** (`rollInitiative` / `endTurn`) re-read the live encounter and dispatch through the system API, and **thin UI** (`CombatTab` + `CombatantRow`) renders it. A separate always-on hook (`useTurnAlert`, mounted in `Shell`) buzzes on the transition into your turn. No live objects held in React state; Foundry owns data, permissions, and chat output.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Tailwind v4 (no preflight), Foundry VTT v14 + PF2e v8.2 live API.

**Spec:** `docs/superpowers/specs/2026-06-12-phase-5-combat-tracker-design.md`

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/foundry/combat/types.ts` | View + source-shape types (`EncounterView`, `CombatantView`, `EncounterViewContext`, `EncounterLike`, `CombatantLike`) | 1 |
| `src/foundry/combat/view.ts` | pure `buildEncounterView(encounter, ctx)` — visibility filter, name blanking, image fallback, HP gating, current/mine flags, derived `canRollInitiative`/`isMyTurn` | 1 |
| `tests/encounterView.test.ts` | unit tests for the pure mapper | 1 |
| `src/app/combat/useEncounter.ts` | sync refresh hook (useMemo + version bump on the six combat hooks) | 2 |
| `src/app/combat/CombatantRow.tsx` | presentational row: portrait + name + initiative + HP bar; current/▶, "You", defeated styling | 2 |
| `src/app/combat/CombatTab.tsx` | the tab: empty state / round header + your-turn pill / order list (T2); footer Roll-Init / End-Turn controls (T3) | 2, 3 |
| `src/app/TabContent.tsx` *(edit)* | route `"combat"` → `<CombatTab />` | 2 |
| `src/foundry/combat/actions.ts` | guarded `rollInitiative(combatantId)` + `endTurn(actorId)` | 3 |
| `tests/combatActions.test.ts` | unit tests for the guarded actions | 3 |
| `src/app/combat/useTurnAlert.ts` | always-on buzz hook (ref-diff current combatant on `updateCombat`, `navigator.vibrate`) | 4 |
| `src/app/Shell.tsx` *(edit)* | call `useTurnAlert(actorId)` beside `useChatFeed()` | 4 |

**Testing convention (follow it):** the project unit-tests **pure logic** (mappers, like `tests/togglesView.test.ts`) and **guarded actions** (stubbing `globalThis.game`/`ui`, like `tests/executeMacro.test.ts`). Hooks and components are **not** unit-tested — they're verified by `npm run typecheck` + `npm run build` + a manual live checklist (`useToggles`/`ToggleBar` have no tests). So Task 1 tests the mapper, Task 3 tests the actions; Tasks 2 and 4 (hooks/components/wiring) have no test files — do not invent hook/component tests.

**Commit convention:** commit per task directly to `main`, subject `Phase 5 (Task M): …`, with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Task 1: Combat types + pure `buildEncounterView` mapper

**Files:**
- Create: `src/foundry/combat/types.ts`
- Create: `src/foundry/combat/view.ts`
- Test: `tests/encounterView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/encounterView.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildEncounterView } from "../src/foundry/combat/view";
import type { CombatantLike, EncounterLike, EncounterViewContext } from "../src/foundry/combat/types";

/** A combatant fixture with sensible defaults; override per case. Note: passing
 *  `actor` or `token` REPLACES the default object (no deep merge). */
function combatant(over: Partial<CombatantLike> = {}): CombatantLike {
  return {
    id: "c1",
    name: "Goblin",
    initiative: 10,
    hidden: false,
    defeated: false,
    playersCanSeeName: true,
    img: null,
    token: null,
    actor: { id: "a1", img: null, hasPlayerOwner: false, system: { attributes: { hp: { value: 5, max: 5 } } } },
    ...over,
  };
}

function encounter(turns: CombatantLike[], over: Partial<EncounterLike> = {}): EncounterLike {
  return { round: 1, started: true, combatant: null, turns, ...over };
}

const PLAYER: EncounterViewContext = { isGM: false, characterActorId: "hero" };
const GM: EncounterViewContext = { isGM: true, characterActorId: null };

describe("buildEncounterView", () => {
  it("preserves turn order and maps the basic fields", () => {
    const view = buildEncounterView(
      encounter([
        combatant({ id: "c1", name: "Ezren", initiative: 22 }),
        combatant({ id: "c2", name: "Goblin", initiative: 15 }),
      ]),
      GM,
    );
    expect(view.combatants.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(view.combatants[0]).toMatchObject({ name: "Ezren", initiative: 22 });
    expect(view.round).toBe(1);
    expect(view.started).toBe(true);
  });

  it("omits GM-hidden combatants for a player but keeps them for the GM", () => {
    const turns = [combatant({ id: "vis" }), combatant({ id: "secret", hidden: true })];
    expect(buildEncounterView(encounter(turns), PLAYER).combatants.map((c) => c.id)).toEqual(["vis"]);
    expect(buildEncounterView(encounter(turns), GM).combatants.map((c) => c.id)).toEqual(["vis", "secret"]);
  });

  it("blanks the name to 'Unknown' when the player may not see it", () => {
    const hidden = [combatant({ id: "c1", name: "Dragon", playersCanSeeName: false })];
    expect(buildEncounterView(encounter(hidden), PLAYER).combatants[0].name).toBe("Unknown");
    expect(buildEncounterView(encounter(hidden), GM).combatants[0].name).toBe("Dragon"); // GM sees real name
    const shown = [combatant({ name: "Bob", playersCanSeeName: true })];
    expect(buildEncounterView(encounter(shown), PLAYER).combatants[0].name).toBe("Bob");
  });

  it("resolves the portrait via token.texture.src → actor.img → combatant.img → null", () => {
    const tok = combatant({ id: "t", token: { texture: { src: "tok.webp" } }, actor: { id: "a", img: "act.webp" } });
    const act = combatant({ id: "a", token: null, actor: { id: "a", img: "act.webp" } });
    const cmb = combatant({ id: "c", token: null, actor: null, img: "cmb.webp" });
    const none = combatant({ id: "n", token: null, actor: null, img: null });
    const view = buildEncounterView(encounter([tok, act, cmb, none]), GM);
    expect(view.combatants.map((c) => c.img)).toEqual(["tok.webp", "act.webp", "cmb.webp", null]);
  });

  it("shows HP only where the viewer may see it (own/party for players, all for GM)", () => {
    const pc = combatant({ id: "pc", actor: { id: "hero", hasPlayerOwner: true, system: { attributes: { hp: { value: 30, max: 40 } } } } });
    const npc = combatant({ id: "npc", actor: { id: "x", hasPlayerOwner: false, system: { attributes: { hp: { value: 8, max: 8 } } } } });
    const playerView = buildEncounterView(encounter([pc, npc]), PLAYER);
    expect(playerView.combatants[0].hp).toEqual({ value: 30, max: 40 }); // own/party PC visible
    expect(playerView.combatants[1].hp).toBeNull();                       // NPC hidden from player
    expect(buildEncounterView(encounter([pc, npc]), GM).combatants[1].hp).toEqual({ value: 8, max: 8 }); // GM sees all
  });

  it("returns null HP when the hp shape is missing", () => {
    const c = combatant({ actor: { id: "a", hasPlayerOwner: true, system: {} } });
    expect(buildEncounterView(encounter([c]), GM).combatants[0].hp).toBeNull();
  });

  it("flags the current combatant and the active character's own combatant", () => {
    const turns = [
      combatant({ id: "c1", actor: { id: "hero", hasPlayerOwner: true } }),
      combatant({ id: "c2", actor: { id: "foe" } }),
    ];
    const view = buildEncounterView(encounter(turns, { combatant: { id: "c1" } }), PLAYER);
    expect(view.combatants[0]).toMatchObject({ isCurrent: true, isMine: true });
    expect(view.combatants[1]).toMatchObject({ isCurrent: false, isMine: false });
    expect(view.myCombatantId).toBe("c1");
    expect(view.isMyTurn).toBe(true);
  });

  it("canRollInitiative is true only when my combatant exists and has no initiative", () => {
    const mineUnrolled = encounter([combatant({ id: "c1", initiative: null, actor: { id: "hero", hasPlayerOwner: true } })]);
    expect(buildEncounterView(mineUnrolled, PLAYER).canRollInitiative).toBe(true);
    const mineRolled = encounter([combatant({ id: "c1", initiative: 18, actor: { id: "hero", hasPlayerOwner: true } })]);
    expect(buildEncounterView(mineRolled, PLAYER).canRollInitiative).toBe(false);
    const notMine = encounter([combatant({ id: "c1", initiative: null, actor: { id: "foe" } })]);
    expect(buildEncounterView(notMine, PLAYER).canRollInitiative).toBe(false);
  });

  it("handles an empty encounter", () => {
    const view = buildEncounterView(encounter([]), PLAYER);
    expect(view.combatants).toEqual([]);
    expect(view.myCombatantId).toBeNull();
    expect(view.canRollInitiative).toBe(false);
    expect(view.isMyTurn).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/encounterView.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/combat/view` / `buildEncounterView is not a function`.

- [ ] **Step 3: Create the types**

Create `src/foundry/combat/types.ts`:

```ts
// Type contract for the combat tracker: the view the UI renders, plus the
// structural shapes of the live Encounter + Combatant documents the mapper reads.

/** One row in the initiative order. */
export interface CombatantView {
  id: string;
  name: string;                 // "Unknown" when the player may not see the real name
  img: string | null;
  initiative: number | null;    // null = not yet rolled → renders "–"
  isCurrent: boolean;           // this is game.combat.combatant
  isMine: boolean;              // belongs to the active character
  defeated: boolean;
  hp: { value: number; max: number } | null; // null when not visible to the viewer
}

/** What the Combat tab renders. */
export interface EncounterView {
  round: number;
  started: boolean;
  combatants: CombatantView[];  // turn order (already initiative-sorted by PF2e)
  myCombatantId: string | null; // the active character's combatant, if present
  canRollInitiative: boolean;   // mine exists && initiative == null
  isMyTurn: boolean;            // current combatant is the active character
}

/** Viewer context the mapper needs to apply visibility rules. */
export interface EncounterViewContext {
  isGM: boolean;
  characterActorId: string | null;
}

// ---------- Source (the live documents, structurally) ----------

/** A live CombatantPF2e — only the fields the mapper reads. */
export interface CombatantLike {
  id: string;
  name: string;
  initiative: number | null;
  hidden: boolean;
  defeated?: boolean;
  playersCanSeeName?: boolean;  // PF2e getter on the live combatant
  img?: string | null;          // Foundry Combatant#img fallback
  token?: { texture?: { src?: string | null } } | null;
  actor?: {
    id: string;
    img?: string | null;
    hasPlayerOwner?: boolean;
    system?: { attributes?: { hp?: { value?: number; max?: number } } };
  } | null;
}

/** The live EncounterPF2e — only the fields the mapper reads. */
export interface EncounterLike {
  round: number;
  started: boolean;
  combatant?: { id?: string } | null; // the current-turn combatant
  turns: CombatantLike[];             // ordered turn list
}
```

- [ ] **Step 4: Implement the pure mapper**

Create `src/foundry/combat/view.ts`:

```ts
import type {
  CombatantView, EncounterLike, EncounterView, EncounterViewContext,
} from "./types";

/** Pure: build the player-facing encounter view from the live `game.combat`.
 *  Mirrors what Foundry's stock tracker shows a player — GM-hidden combatants
 *  omitted, names blanked when the player may not see them, NPC HP hidden — so
 *  the mapper (not the UI) owns every visibility rule and stays unit-testable.
 *  `turns` is already initiative-sorted by PF2e; we preserve that order. */
export function buildEncounterView(
  encounter: EncounterLike,
  ctx: EncounterViewContext,
): EncounterView {
  const currentId = encounter.combatant?.id ?? null;
  const combatants: CombatantView[] = [];
  let myCombatantId: string | null = null;

  for (const c of encounter.turns ?? []) {
    if (c.hidden && !ctx.isGM) continue; // players never see GM-hidden combatants

    const canSeeName = ctx.isGM || c.playersCanSeeName !== false;
    const isMine = !!c.actor && c.actor.id === ctx.characterActorId;
    const canSeeHp = ctx.isGM || c.actor?.hasPlayerOwner === true;
    const hpRaw = c.actor?.system?.attributes?.hp;
    const hp =
      canSeeHp && hpRaw && typeof hpRaw.value === "number" && typeof hpRaw.max === "number"
        ? { value: hpRaw.value, max: hpRaw.max }
        : null;

    if (isMine) myCombatantId = c.id;
    combatants.push({
      id: c.id,
      name: canSeeName ? c.name : "Unknown",
      img: c.token?.texture?.src ?? c.actor?.img ?? c.img ?? null,
      initiative: c.initiative ?? null,
      isCurrent: c.id === currentId,
      isMine,
      defeated: c.defeated ?? false,
      hp,
    });
  }

  const mine = combatants.find((c) => c.id === myCombatantId) ?? null;
  return {
    round: encounter.round,
    started: encounter.started,
    combatants,
    myCombatantId,
    canRollInitiative: !!mine && mine.initiative == null,
    isMyTurn: !!mine && mine.isCurrent,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/encounterView.test.ts`
Expected: PASS — 9 passed.

- [ ] **Step 6: Commit**

```bash
git add src/foundry/combat/types.ts src/foundry/combat/view.ts tests/encounterView.test.ts
git commit -m "Phase 5 (Task 1): buildEncounterView mapper + combat types" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `useEncounter` hook + `CombatTab`/`CombatantRow` UI + route (render-only)

**Files:**
- Create: `src/app/combat/useEncounter.ts`
- Create: `src/app/combat/CombatantRow.tsx`
- Create: `src/app/combat/CombatTab.tsx`
- Modify: `src/app/TabContent.tsx`

No unit tests (hooks/components — verified by typecheck + build + manual). `useEncounter` mirrors `src/app/actions/useToggles.ts`.

- [ ] **Step 1: Create the live hook**

Create `src/app/combat/useEncounter.ts`:

```ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildEncounterView } from "../../foundry/combat/view";
import type { EncounterLike, EncounterView } from "../../foundry/combat/types";

/** Live encounter view for the active character. Synchronous data-prep (like
 *  `useToggles`/`useHotbar`): re-preps on every combat document hook so round,
 *  turn, roster, and initiative changes reflect within ~1s. Returns null when
 *  there is no active encounter (`game.combat` is null) → the tab's empty state. */
export function useEncounter(actorId: string | null): EncounterView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onCombat = useCallback(() => bump(), []);

  useFoundryHook("updateCombat", onCombat);
  useFoundryHook("createCombat", onCombat);
  useFoundryHook("deleteCombat", onCombat);
  useFoundryHook("createCombatant", onCombat);
  useFoundryHook("updateCombatant", onCombat);
  useFoundryHook("deleteCombatant", onCombat);

  return useMemo(() => {
    const combat = (game as any)?.combat as EncounterLike | null | undefined;
    if (!combat) return null;
    const isGM = !!(game as any)?.user?.isGM;
    return buildEncounterView(combat, { isGM, characterActorId: actorId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, actorId]);
}
```

- [ ] **Step 2: Create the row component**

Create `src/app/combat/CombatantRow.tsx`:

```tsx
import type { CombatantView } from "../../foundry/combat/types";

/** One row in the initiative order: portrait, name, initiative, and an HP bar
 *  when the viewer may see it. The current-turn row is ringed with a ▶ marker;
 *  the active character's own row is tagged "You"; defeated rows are dimmed and
 *  struck. Non-interactive for v1 (tap-for-detail is Phase 7). Uses bg/ring, not
 *  `border`, per the Tailwind-v4 reset gotchas. */
export function CombatantRow({ c }: { c: CombatantView }) {
  const hpPct = c.hp && c.hp.max > 0 ? Math.max(0, Math.min(100, (c.hp.value / c.hp.max) * 100)) : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 ${
        c.isCurrent ? "bg-indigo-950/60 ring-2 ring-inset ring-indigo-400" : ""
      } ${c.defeated ? "opacity-50" : ""}`}
    >
      <span className="flex w-4 shrink-0 justify-center text-indigo-400">
        {c.isCurrent && <i className="fas fa-caret-right" aria-hidden="true" />}
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-800">
        {c.img ? (
          <img src={c.img} alt="" className="h-full w-full object-cover" />
        ) : (
          <i className="fas fa-user text-zinc-500" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${c.defeated ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
            {c.name}
          </span>
          {c.isMine && (
            <span className="shrink-0 rounded bg-indigo-600 px-1 text-[10px] font-semibold text-white">You</span>
          )}
        </span>
        {c.hp && (
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <span className={`block h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-xl font-bold tabular-nums text-zinc-200">{c.initiative ?? "–"}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create the tab (render-only — no footer controls yet)**

Create `src/app/combat/CombatTab.tsx`:

```tsx
import { useAppStore } from "../store";
import { useEncounter } from "./useEncounter";
import { CombatantRow } from "./CombatantRow";

/** The Combat tab — a live, player-facing initiative tracker mirroring what the
 *  stock encounter tracker shows a player. Render-only here; the Roll Initiative
 *  / End My Turn controls are wired in Task 3. */
export function CombatTab() {
  const actorId = useAppStore((s) => s.actorId);
  const encounter = useEncounter(actorId);

  if (!encounter) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-dice-d20 text-3xl" aria-hidden="true" />
        <div className="text-sm">No active encounter.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="text-sm font-semibold text-zinc-200">
          {encounter.started ? `Round ${encounter.round}` : "Not started"}
        </span>
        {encounter.isMyTurn && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Your turn</span>
        )}
      </header>
      <div className="min-h-0 flex-1 divide-y divide-zinc-800 overflow-y-auto">
        {encounter.combatants.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No combatants.</div>
        ) : (
          encounter.combatants.map((c) => <CombatantRow key={c.id} c={c} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Route the `combat` tab to `CombatTab`**

In `src/app/TabContent.tsx`, add the import after the existing tab imports:

```tsx
import { CombatTab } from "./combat/CombatTab";
```

Then replace the `combat` case:

```tsx
    case "combat":
      return <Placeholder title="Combat Tracker" phase="Coming in Phase 5" />;
```

with:

```tsx
    case "combat":
      return <CombatTab />;
```

(Leave the `Placeholder` import — `journal` still uses it.)

- [ ] **Step 5: Verify it typechecks and builds**

Run: `npm run typecheck`
Expected: PASS — no errors (`tsc --noEmit` exits 0).

Run: `npm run build`
Expected: PASS — `vite build` completes, no errors, emits `dist/`.

- [ ] **Step 6: Commit**

```bash
git add src/app/combat/useEncounter.ts src/app/combat/CombatantRow.tsx src/app/combat/CombatTab.tsx src/app/TabContent.tsx
git commit -m "Phase 5 (Task 2): Combat tab renders the live initiative order" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: CHECKPOINT — live-look review**

Pause here for the user to eyeball the tab in Foundry (GM on desktop starts an encounter that includes the player's character; Player1 at mobile width opens the **Combat** tab). Confirm: the order, portraits, names, initiative values, HP bars (own/party only), current-turn ring + ▶, "You" tag, and round header all look right; no active encounter shows "No active encounter." The footer controls and buzz arrive in Tasks 3–4.

---

## Task 3: Guarded `rollInitiative` / `endTurn` actions + footer controls

**Files:**
- Create: `src/foundry/combat/actions.ts`
- Test: `tests/combatActions.test.ts`
- Modify: `src/app/combat/CombatTab.tsx` (add the footer)

- [ ] **Step 1: Write the failing test**

Create `tests/combatActions.test.ts` (stubs `globalThis.game`/`ui`, like `tests/executeMacro.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { rollInitiative, endTurn } from "../src/foundry/combat/actions";

/** Stub the Foundry globals with a live combat. `currentActorId` sets whose turn
 *  it is (omit → no current combatant); `rejectNext` makes nextTurn() reject (a
 *  permission failure); `noCombat` makes game.combat null. */
function stub(opts: { currentActorId?: string | null; rejectNext?: boolean; noCombat?: boolean } = {}) {
  const calls = { rolled: [] as string[][], next: 0 };
  const combat = {
    combatant: "currentActorId" in opts ? { actor: { id: opts.currentActorId } } : null,
    rollInitiative: (ids: string[]) => { calls.rolled.push(ids); return Promise.resolve(true); },
    nextTurn: () => { calls.next += 1; return opts.rejectNext ? Promise.reject(new Error("no permission")) : Promise.resolve(true); },
  };
  (globalThis as { game?: unknown }).game = { combat: opts.noCombat ? null : combat };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("rollInitiative", () => {
  it("calls combat.rollInitiative with the combatant id", async () => {
    const calls = stub();
    await rollInitiative("c1");
    expect(calls.rolled).toEqual([["c1"]]);
  });
  it("never throws when there is no active encounter", async () => {
    stub({ noCombat: true });
    await expect(rollInitiative("c1")).resolves.toBeUndefined();
  });
});

describe("endTurn", () => {
  it("advances the turn when it is the actor's turn", async () => {
    const calls = stub({ currentActorId: "hero" });
    await endTurn("hero");
    expect(calls.next).toBe(1);
  });
  it("does nothing when it is not the actor's turn", async () => {
    const calls = stub({ currentActorId: "foe" });
    await endTurn("hero");
    expect(calls.next).toBe(0);
  });
  it("swallows a permission rejection (toast, no throw)", async () => {
    stub({ currentActorId: "hero", rejectNext: true });
    await expect(endTurn("hero")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/combatActions.test.ts`
Expected: FAIL — cannot resolve `../src/foundry/combat/actions` / `rollInitiative is not a function`.

- [ ] **Step 3: Implement the guarded actions**

Create `src/foundry/combat/actions.ts`:

```ts
/** Guarded combat dispatches. Thin glue over the live `game.combat`; a rejected
 *  call (e.g. a player lacking turn-control permission) surfaces via Foundry's
 *  toast and never throws into React — same contract as `rolls.ts`/`hotbar.ts`. */

interface LiveEncounter {
  combatant?: { actor?: { id?: string } | null } | null;
  rollInitiative?(ids: string[]): Promise<unknown>;
  nextTurn?(): Promise<unknown>;
}

function activeEncounter(): LiveEncounter | undefined {
  return (game as any)?.combat as LiveEncounter | undefined;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] combat action failed", err);
    (ui as any)?.notifications?.error?.("Action failed — see console.");
  }
}

/** Roll a combatant's initiative — PF2e rolls the actor's chosen statistic
 *  (perception or a skill) and updates the tracker, exactly like the stock
 *  tracker's roll button. */
export function rollInitiative(combatantId: string): Promise<void> {
  return guard(async () => {
    const combat = activeEncounter();
    if (!combat?.rollInitiative) throw new Error("no active encounter");
    await combat.rollInitiative([combatantId]);
  });
}

/** End the active character's turn by advancing the encounter. Only fires when
 *  it is actually that character's turn; Foundry permission-checks the update
 *  server-side, so a player without turn-control permission gets a toast. */
export function endTurn(actorId: string | null): Promise<void> {
  return guard(async () => {
    const combat = activeEncounter();
    if (!combat?.nextTurn) throw new Error("no active encounter");
    if ((combat.combatant?.actor?.id ?? null) !== actorId) return; // not your turn → no-op
    await combat.nextTurn();
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/combatActions.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Wire the footer controls into `CombatTab`**

Replace the entire contents of `src/app/combat/CombatTab.tsx` with (adds the action imports + a footer; the empty-state and the header/list above it are unchanged):

```tsx
import { useAppStore } from "../store";
import { useEncounter } from "./useEncounter";
import { CombatantRow } from "./CombatantRow";
import { rollInitiative, endTurn } from "../../foundry/combat/actions";

/** The Combat tab — a live, player-facing initiative tracker mirroring what the
 *  stock encounter tracker shows a player. Footer gives the two player actions:
 *  Roll Initiative (when in the encounter but unrolled) and End My Turn (enabled
 *  only on your turn; attempts nextTurn(), which Foundry permission-checks). */
export function CombatTab() {
  const actorId = useAppStore((s) => s.actorId);
  const encounter = useEncounter(actorId);

  if (!encounter) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-dice-d20 text-3xl" aria-hidden="true" />
        <div className="text-sm">No active encounter.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="text-sm font-semibold text-zinc-200">
          {encounter.started ? `Round ${encounter.round}` : "Not started"}
        </span>
        {encounter.isMyTurn && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Your turn</span>
        )}
      </header>

      <div className="min-h-0 flex-1 divide-y divide-zinc-800 overflow-y-auto">
        {encounter.combatants.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No combatants.</div>
        ) : (
          encounter.combatants.map((c) => <CombatantRow key={c.id} c={c} />)
        )}
      </div>

      {encounter.myCombatantId && (
        <footer className="flex shrink-0 gap-2 border-t border-zinc-800 bg-zinc-900 px-3 py-2">
          {encounter.canRollInitiative ? (
            <button
              onClick={() => void rollInitiative(encounter.myCombatantId!)}
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white"
            >
              Roll Initiative
            </button>
          ) : (
            <button
              onClick={() => void endTurn(actorId)}
              disabled={!encounter.isMyTurn}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                encounter.isMyTurn ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-500"
              }`}
            >
              End My Turn
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify it typechecks and builds**

Run: `npm run typecheck`
Expected: PASS — no errors.

Run: `npm run build`
Expected: PASS — `vite build` completes cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/foundry/combat/actions.ts tests/combatActions.test.ts src/app/combat/CombatTab.tsx
git commit -m "Phase 5 (Task 3): Roll Initiative + End My Turn controls" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `useTurnAlert` buzz + Shell wiring

**Files:**
- Create: `src/app/combat/useTurnAlert.ts`
- Modify: `src/app/Shell.tsx`

No unit test (hook/wiring — verified by typecheck + build + manual; `navigator.vibrate` only works on a real Android device).

- [ ] **Step 1: Create the buzz hook**

Create `src/app/combat/useTurnAlert.ts`:

```ts
import { useCallback, useRef } from "react";
import { useFoundryHook } from "../useFoundryHook";

const BUZZ_MS = [120, 60, 120]; // short double-buzz pattern

/** Always-on (mounted in Shell): vibrate the phone once when the active
 *  character's turn begins. Watches `updateCombat` and ref-diffs the current
 *  combatant id, so it buzzes only on the transition INTO your turn — not on
 *  every combat update during it. `navigator.vibrate` is feature-detected
 *  (absent on desktop Chrome / iOS Safari → no-op). No render, no state. */
export function useTurnAlert(actorId: string | null): void {
  const lastCurrentId = useRef<string | null>(null);

  const onCombat = useCallback(() => {
    const current = (game as any)?.combat?.combatant ?? null;
    const currentId: string | null = current?.id ?? null;
    if (currentId === lastCurrentId.current) return; // current combatant unchanged → no buzz
    lastCurrentId.current = currentId;
    if (actorId && current?.actor?.id === actorId) {
      (navigator as any)?.vibrate?.(BUZZ_MS);
    }
  }, [actorId]);

  useFoundryHook("updateCombat", onCombat);
}
```

- [ ] **Step 2: Call it in `Shell`**

In `src/app/Shell.tsx`, add the import after the existing chat imports:

```tsx
import { useTurnAlert } from "./combat/useTurnAlert";
```

Then, immediately after the existing `useChatFeed();` line, add:

```tsx
  useTurnAlert(actorId);
```

(`actorId` is already read above via `const actorId = useAppStore((s) => s.actorId);` — do not re-declare it.)

- [ ] **Step 3: Verify it typechecks and builds**

Run: `npm run typecheck`
Expected: PASS — no errors.

Run: `npm run build`
Expected: PASS — `vite build` completes cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/combat/useTurnAlert.ts src/app/Shell.tsx
git commit -m "Phase 5 (Task 4): vibrate on your turn" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Full verification + live checklist

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite and confirm the count grew**

Run: `npm run test`
Expected: PASS — all test files pass; total = the prior baseline (**162**) **+ 14** new (9 from `encounterView` + 5 from `combatActions`) = **176**. Confirm the **count**, not just "all green" (a batched edit once skipped new cases — see the Phase 4 handoff). If the number differs, reconcile before proceeding.

- [ ] **Step 2: Typecheck + production build**

Run: `npm run typecheck` → exits 0.
Run: `npm run build` → completes cleanly. (Test the **production** build, not only `npm run dev` — the dev server has masked broken bundles before.)

- [ ] **Step 3: Manual live checklist** (Foundry running; GM in desktop Chrome + **Player1**, no password, mobile-width viewport. GM starts an encounter that includes Player1's character, at least one visible NPC, and one **GM-hidden** combatant; roll some initiatives, leave Player1 unrolled at first.)

  - [ ] **Empty state:** with no active encounter, the Combat tab shows "No active encounter."
  - [ ] **Order & fields:** once combat starts, the tab lists combatants in the same initiative order as the desktop tracker, with portraits, names, and initiative values (unrolled = "–").
  - [ ] **Visibility:** the GM-hidden combatant does **not** appear for Player1; if the world hides NPC names, that NPC shows "Unknown".
  - [ ] **HP bars:** Player1's own character (and party members) show an HP bar; NPC rows show **no** HP bar.
  - [ ] **Current turn:** the active combatant's row is ringed with a ▶; when the GM advances the turn on desktop, the highlight moves on the phone within ~1s; the round number updates on a new round.
  - [ ] **Buzz (Android):** when the GM advances to Player1's turn, the phone vibrates from whatever tab is open; it does **not** re-buzz on other combat updates during the same turn.
  - [ ] **Roll Initiative:** while Player1 is unrolled, the footer shows **Roll Initiative**; tapping it rolls the character's initiative (chosen statistic), posts the check card to Chat, and the button is replaced by **End My Turn** as the value populates.
  - [ ] **End My Turn:** ⚠️ enabled only on Player1's turn; tapping it advances the encounter **if** the world permits player turn control, otherwise an "Action failed" toast appears. **Record which behavior occurs** — it decides whether we keep the button enabled, gate it behind a setting, or hide it in a follow-up.
  - [ ] **Teardown:** the GM ending/deleting the encounter returns the tab to "No active encounter."

- [ ] **Step 4: Report**

Summarize to the user: tests green with the new count (176), typecheck/build clean, and which live checks passed vs. are pending — calling out the **End My Turn permission** result specifically. No code changes in this task.

---

## Self-review notes (for the implementer)

- **Spec coverage:** read `game.combat` order/current/round (Task 1 mapper + Task 2 hook) · portraits/names/initiative render (Task 2) · visibility — hidden omitted, name blanked, NPC HP hidden (Task 1, asserted in tests) · your-turn highlight + buzz (Task 2 ring/pill + Task 4 vibrate) · Roll Initiative (Task 3) · End Turn permission-guarded (Task 3) · hooks `updateCombat`/`create|update|deleteCombatant`/`create|deleteCombat` (Task 2) + buzz on `updateCombat` (Task 4). Every spec section maps to a task.
- **Type consistency:** `EncounterView { round, started, combatants, myCombatantId, canRollInitiative, isMyTurn }` and `CombatantView { id, name, img, initiative, isCurrent, isMine, defeated, hp }` are produced by `buildEncounterView` (T1) and consumed unchanged by `useEncounter` (T2), `CombatTab` (T2/T3), and `CombatantRow` (T2). Action signatures `rollInitiative(combatantId: string)` and `endTurn(actorId: string | null)` are identical in `actions.ts` (T3), the test, and the `CombatTab` call sites (T3).
- **Render-only checkpoint:** Task 2 deliberately ships the tab without footer actions so the live look can be reviewed before the permission-sensitive `endTurn` lands. The full `CombatTab` is repeated verbatim in Task 3 Step 5 (not a diff) so it can be applied without reading Task 2.
- **Live-API caution:** the mapper and tests are pure; the live shapes (`game.combat.turns`/`.combatant`/`.round`/`.started`, `combatant.playersCanSeeName`/`hidden`/`initiative`/`actor.hasPlayerOwner`, `actor.system.attributes.hp`, `combat.rollInitiative([id])`, `combat.nextTurn()`) are grounded in the spec against the cloned PF2e source but only confirmed by the Task 5 live checklist. If a path is wrong in play, fix the thin glue (`useEncounter` read / `actions.ts`), not the tested mapper. The two items that can only be confirmed live are **`nextTurn()` permission** and the **vibrate**.
```
