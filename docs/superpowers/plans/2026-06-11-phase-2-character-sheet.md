# Phase 2 — Comprehensive Character Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 `SheetTab` placeholder with a comprehensive, live-mirroring PF2e character sheet — sub-tabs under a sticky vitals header — with play-time edits (HP, conditions, hero/dying/wounded, initiative statistic, equip/invest); rolling deferred to Phase 3.

**Architecture:** A new pure mapper `buildCharacterView(actor: CharacterLike): CharacterView` (in `src/foundry/actor/`) projects the live `CharacterPF2e` into a plain typed snapshot; thin async mutation helpers wrap `actor.update`/`item.update`/the conditions API; a `useActor(actorId)` hook re-reads the view on filtered document hooks. React components are purely presentational, fed the view + callbacks. This extends the Phase 1 adapter/app split.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Tailwind v4 (utilities only, no preflight), Vitest (node env, pure-logic TDD; components verified by typecheck/build + manual checklist), Foundry's bundled Font Awesome. `fvtt-types` globals (`game`, `Hooks`).

**Spec:** `docs/superpowers/specs/2026-06-11-phase-2-character-sheet-design.md`

**Conventions for every task:**
- Imports are **relative** (no path aliases). Reads of Foundry globals match Phase 1: `(game as any).actors.get(id)`.
- Pure modules are **TDD** (failing test → run → implement → pass). Components/hooks/mutations are verified by `npm run typecheck` (+ `npm run build` for components) and a **manual checklist** in live/emulated mobile Foundry — mirroring Phase 1.
- Run one test file: `npx vitest run tests/<file>.test.ts`. Full suite: `npm run test`. Types: `npm run typecheck`. Build: `npm run build`.
- Commit messages follow the project style `Phase 2 (Task N): <summary>` and end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **DRY / YAGNI / frequent commits.** One commit per task unless noted.

---

## Execution status (2026-06-11)

**Phase 2 is COMPLETE (Tasks 2–24) and verified live on 2026-06-11.** The pure data layer (`src/foundry/actor/{types,view,hp,mutations}.ts`) and the full live sheet (`src/app/useActor.ts` + `src/app/sheet/*`) shipped to `main`. Polish and fixes continued in **Phase 2.1** (`docs/superpowers/specs|plans/2026-06-11-phase-2.1-character-sheet-enhancements*`). The deviation notes below are historical.

**Deviations applied during execution (committed; these SUPERSEDE the matching snippets above):**
1. **Inventory bulk** — the real API is `actor.inventory.bulk` (`InventoryBulk`: `.value.normal` / `.max` / `.isEncumbered`), **not** `inventory.totalBulk` (the Explore note was wrong and crashed render). Task 2's `CharacterLike.inventory` type and Task 7's `mapInventory` were updated accordingly; the unused `attributes.encumbered` field was removed.
2. **Speeds** — `mapDefenses` whitelists real movement types (land/fly/swim/climb/burrow); PF2e also stuffs a derived `travel` speed into `system.movement.speeds`, now excluded.
3. **Character selector (unplanned add)** — `resolveCharacter` now returns `{ defaultId, candidates }` (defaults to the assigned/sole PC but always lists every owned PC); `SheetTab` was rewritten with a `picking` flag; new `src/app/CharacterPicker.tsx`. **`CharacterSheet`'s `onSwitch?` prop interface is unchanged**, so Tasks 17–23 apply cleanly on top of the committed Task 16 `CharacterSheet`.

**To resume (new session or this one):** treat the committed source as the source of truth, then apply **Tasks 17 → 24 in order**. They modify the committed `CharacterSheet.tsx` (still the Task 16 version) and add new panel/modal files. The data-layer snippets above that mention `totalBulk` are historical — don't reapply them.

---

## Task 1: API probe — confirm live getters (manual, de-risk)

The mappers depend on live derived getters. Confirm their shape ONCE on a real PC before coding. No code change; this validates the `CharacterLike` contract in Task 2.

**Files:** none (console only).

- [ ] **Step 1: Run the probe in desktop Foundry**

Open the dev world in desktop Chrome, F12 console, with a test character named `Valeros` (or change the name). Paste:

```js
const a = game.actors.getName("Valeros");
console.log("skills sample", a.skills.athletics);                 // {slug,label,mod,rank,armor,lore?}
console.log("saves.fortitude", a.system.saves.fortitude);         // {value,rank,...}
console.log("perception", a.system.perception);                   // {value,rank,senses}
console.log("initiative", a.system.initiative);                   // {totalModifier,statistic}
console.log("ac", a.system.attributes.ac, "shield", a.system.attributes.shield);
console.log("hp/dying/wounded", a.system.attributes.hp, a.system.attributes.dying, a.system.attributes.wounded);
console.log("hero", a.system.resources.heroPoints, "abilities", a.system.abilities.str);
console.log("speeds", a.system.movement?.speeds, "classDCs", a.system.proficiencies?.classDCs);
console.log("iwr", a.system.attributes.immunities, a.system.attributes.resistances, a.system.attributes.weaknesses);
console.log("conditions.active[0]", a.conditions.active[0]);      // {slug,name,value,img,isLocked,badge?}
console.log("inventory.contents[0]", a.inventory.contents[0]);   // {id,name,img,quantity,type,system.equipped,...}
console.log("inventory.currency/totalBulk", a.inventory.currency, a.inventory.totalBulk);
console.log("item.bulk[0]", a.inventory.contents[0]?.bulk);      // confirm .value exists
console.log("feat[0]", a.itemTypes.feat[0]?.system);             // {category,level,actionType,actions,traits}
console.log("ancestry/class", a.ancestry?.name, a.class?.name, a.background?.name, a.heritage?.name, a.deity?.name);
```

- [ ] **Step 2: Reconcile**

For any field whose real shape differs from Task 2's `CharacterLike`, note it and adjust the corresponding mapper read + the interface in Task 2 when you reach it. Pay special attention to `item.bulk` (confirm `.value`) and `conditions.active[].badge`. No commit.

---

## Task 2: Type contract — `CharacterView` + `CharacterLike`

**Files:**
- Create: `src/foundry/actor/types.ts`

- [ ] **Step 1: Create the view + source types**

```ts
// src/foundry/actor/types.ts

/** Proficiency rank: Untrained..Legendary. */
export type Rank = 0 | 1 | 2 | 3 | 4;

// ---------- View (what the UI renders) ----------

export interface HpView { value: number; temp: number; max: number; }
export interface HeroPointsView { value: number; max: number; }

export interface HeaderView {
  name: string;
  img?: string;
  level: number;
  /** e.g. "Human Fighter" — ancestry + class, blanks collapsed. */
  ancestryClassLine: string;
  heroPoints: HeroPointsView;
  hp: HpView;
  dying: { value: number; max: number };
  wounded: number;
  ac: number;
  perceptionMod: number;
  speed: number;
}

export interface SaveView { slug: "fortitude" | "reflex" | "will"; label: string; mod: number; rank: Rank; }
export interface SenseView { label: string; }
export interface SpeedView { type: string; label: string; value: number; }
export interface ClassDcView { slug: string; label: string; value: number; rank: Rank; primary: boolean; }
export interface ShieldView { ac: number; hp: { value: number; max: number }; hardness: number; broken: boolean; raised: boolean; }
export interface InitiativeOption { value: string; label: string; }
export interface InitiativeView { mod: number; statistic: string; options: InitiativeOption[]; }

export interface DefensesView {
  ac: number;
  shield?: ShieldView;
  saves: SaveView[];
  perception: { mod: number; rank: Rank; senses: SenseView[] };
  initiative: InitiativeView;
  classDCs: ClassDcView[];
  speeds: SpeedView[];
}

export interface AbilityView { slug: string; label: string; mod: number; key: boolean; }

/** Immunity/resistance/weakness — PF2e precomposes `.label` (incl. value). */
export interface IwrView { label: string; }
export interface TraitsView { size: string; immunities: IwrView[]; resistances: IwrView[]; weaknesses: IwrView[]; }

export interface SkillView { slug: string; label: string; mod: number; rank: Rank; armor: boolean; lore: boolean; }

export interface ConditionView { slug: string; name: string; value: number | null; img?: string; locked: boolean; }
export interface EffectView { name: string; img?: string; badge: string | null; }

export interface CoinsView { cp: number; sp: number; gp: number; pp: number; }
export interface InventoryItemView {
  id: string;
  name: string;
  img?: string;
  quantity: number;
  bulkLabel: string;
  priceLabel: string;
  /** "worn" | "held" | "stowed" | "dropped". */
  carryType: string;
  handsHeld: number;
  /** null = not investable. */
  invested: boolean | null;
  equipped: boolean;
  isContainer: boolean;
  containerId: string | null;
}
export interface InventoryCategoryView { key: string; label: string; items: InventoryItemView[]; }
export interface InventoryView { categories: InventoryCategoryView[]; currency: CoinsView; bulkLabel: string; encumbered: boolean; }

export interface FeatView { id: string; name: string; img?: string; actionGlyph: string | null; traits: string[]; level: number; }
export interface FeatGroupView { key: string; label: string; feats: FeatView[]; }

export interface ProficiencyView { label: string; rank: Rank; }
export interface BioView {
  ancestry?: string; heritage?: string; background?: string; className?: string; deity?: string;
  size: string;
  languages: string[];
  attacks: ProficiencyView[];
  defenses: ProficiencyView[];
  appearance?: string;
  backstory?: string;
}

export interface CharacterView {
  id: string;
  header: HeaderView;
  defenses: DefensesView;
  abilities: AbilityView[];
  traits: TraitsView;
  skills: SkillView[];
  conditions: ConditionView[];
  effects: EffectView[];
  inventory: InventoryView;
  featGroups: FeatGroupView[];
  bio: BioView;
}
```

- [ ] **Step 2: Append the structural source interface**

```ts
// src/foundry/actor/types.ts (append)

// ---------- Source (the live actor, structurally) ----------
// Only the members the mappers read. The real CharacterPF2e satisfies this
// via `actor as unknown as CharacterLike` at the call site.

export interface IwrLike { label: string; value?: number; }
export interface SkillLike { slug: string; label: string; mod: number; rank: number; armor: boolean; lore?: boolean; }
export interface ConditionLike { slug: string; name: string; value: number | null; img?: string; isLocked?: boolean; }
export interface EffectLike { name: string; img?: string; badge?: { value?: number; label?: string } | null; }

export interface InventoryItemLike {
  id: string;
  name: string;
  img?: string;
  quantity: number;
  type: string;
  bulk?: { value: number };
  isContainer?: boolean;
  container?: { id: string } | null;
  system: {
    bulk?: { value: number };
    price?: { value: { cp?: number; sp?: number; gp?: number; pp?: number } };
    equipped: { carryType: string; handsHeld?: number; invested?: boolean | null };
  };
}

export interface FeatLike {
  id: string;
  name: string;
  img?: string;
  system: {
    category: string;
    level?: { value: number };
    actionType?: { value: string | null };
    actions?: { value: number | null };
    traits?: { value: string[] };
  };
}

export interface CharacterLike {
  id: string;
  name: string;
  img?: string;
  system: {
    details: {
      level: { value: number };
      languages?: { value: string[] };
      keyability?: { value: string };
      biography?: { appearance?: string; backstory?: string };
    };
    attributes: {
      hp: { value: number; temp: number; max: number };
      ac: { value: number };
      dying: { value: number; max: number };
      wounded: { value: number };
      shield?: { itemId: string | null; ac: number; hp: { value: number; max: number }; hardness: number; broken: boolean; raised?: boolean };
      immunities?: IwrLike[];
      resistances?: IwrLike[];
      weaknesses?: IwrLike[];
    };
    saves: Record<"fortitude" | "reflex" | "will", { value: number; rank: number }>;
    perception: { value: number; rank: number; senses: { label?: string; type?: string }[] };
    initiative: { totalModifier: number; statistic: string };
    movement?: { speeds: Record<string, { value: number } | undefined> };
    abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", { mod: number }>;
    resources: { heroPoints: { value: number; max: number } };
    proficiencies?: {
      classDCs?: Record<string, { value: number; rank: number; slug: string; primary: boolean; label: string }>;
      attacks?: Record<string, { label: string; rank: number; visible?: boolean }>;
      defenses?: Record<string, { label: string; rank: number; visible?: boolean }>;
    };
    traits: { size: { value: string } };
  };
  skills: Record<string, SkillLike>;
  conditions: { active: ConditionLike[] };
  itemTypes: { effect: EffectLike[]; feat: FeatLike[] };
  inventory: { contents: InventoryItemLike[]; currency: CoinsView; totalBulk: { value: number } };
  attributes?: { encumbered?: boolean };
  ancestry?: { name: string } | null;
  heritage?: { name: string } | null;
  background?: { name: string } | null;
  class?: { name: string } | null;
  deity?: { name: string } | null;
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run typecheck` — Expected: PASS (no emit; types only).
```bash
git add src/foundry/actor/types.ts
git commit -m "Phase 2 (Task 2): CharacterView + CharacterLike type contract"
```

---

## Task 3: Test fixture factory + Header mapper

**Files:**
- Create: `tests/fixtures/characterLike.ts`
- Create: `src/foundry/actor/view.ts`
- Create: `tests/characterView.header.test.ts`

- [ ] **Step 1: Create the fixture factory** (shared by all mapper tests — DRY)

```ts
// tests/fixtures/characterLike.ts
import type { CharacterLike } from "../../src/foundry/actor/types";

/** A minimal valid CharacterLike; tests override slices. */
export function makeCharacterLike(over: Partial<CharacterLike> = {}): CharacterLike {
  const base: CharacterLike = {
    id: "actor1",
    name: "Valeros",
    img: "valeros.webp",
    system: {
      details: { level: { value: 5 }, languages: { value: ["common"] }, keyability: { value: "str" },
        biography: { appearance: "", backstory: "" } },
      attributes: {
        hp: { value: 58, temp: 5, max: 72 },
        ac: { value: 24 },
        dying: { value: 0, max: 4 },
        wounded: { value: 1 },
        shield: { itemId: null, ac: 0, hp: { value: 0, max: 0 }, hardness: 0, broken: false, raised: false },
        immunities: [], resistances: [], weaknesses: [],
      },
      saves: {
        fortitude: { value: 13, rank: 2 },
        reflex: { value: 11, rank: 2 },
        will: { value: 9, rank: 1 },
      },
      perception: { value: 12, rank: 2, senses: [{ type: "low-light-vision", label: "Low-Light Vision" }] },
      initiative: { totalModifier: 12, statistic: "perception" },
      movement: { speeds: { land: { value: 25 } } },
      abilities: { str: { mod: 4 }, dex: { mod: 3 }, con: { mod: 3 }, int: { mod: 0 }, wis: { mod: 1 }, cha: { mod: 1 } },
      resources: { heroPoints: { value: 2, max: 3 } },
      proficiencies: { classDCs: { fighter: { value: 24, rank: 2, slug: "fighter", primary: true, label: "Fighter" } },
        attacks: {}, defenses: {} },
      traits: { size: { value: "med" } },
    },
    skills: {
      athletics: { slug: "athletics", label: "Athletics", mod: 13, rank: 2, armor: true },
      acrobatics: { slug: "acrobatics", label: "Acrobatics", mod: 11, rank: 2, armor: true },
    },
    conditions: { active: [] },
    itemTypes: { effect: [], feat: [] },
    inventory: { contents: [], currency: { cp: 0, sp: 0, gp: 0, pp: 0 }, totalBulk: { value: 0 } },
    attributes: { encumbered: false },
    ancestry: { name: "Human" },
    heritage: { name: "Versatile Heritage" },
    background: { name: "Field Medic" },
    class: { name: "Fighter" },
    deity: null,
  };
  return { ...base, ...over } as CharacterLike;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/characterView.header.test.ts
import { describe, it, expect } from "vitest";
import { mapHeader } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapHeader", () => {
  it("projects identity, hero points, hp and the stat strip", () => {
    const h = mapHeader(makeCharacterLike());
    expect(h.name).toBe("Valeros");
    expect(h.level).toBe(5);
    expect(h.ancestryClassLine).toBe("Human Fighter");
    expect(h.heroPoints).toEqual({ value: 2, max: 3 });
    expect(h.hp).toEqual({ value: 58, temp: 5, max: 72 });
    expect(h.dying).toEqual({ value: 0, max: 4 });
    expect(h.wounded).toBe(1);
    expect(h.ac).toBe(24);
    expect(h.perceptionMod).toBe(12);
    expect(h.speed).toBe(25);
  });

  it("collapses a missing ancestry/class to a clean line", () => {
    const h = mapHeader(makeCharacterLike({ ancestry: null, class: { name: "Wizard" } }));
    expect(h.ancestryClassLine).toBe("Wizard");
  });
});
```

- [ ] **Step 3: Run → fail**

Run: `npx vitest run tests/characterView.header.test.ts` — Expected: FAIL ("mapHeader is not a function" / no export).

- [ ] **Step 4: Implement `mapHeader`**

```ts
// src/foundry/actor/view.ts
import type { CharacterLike, HeaderView } from "./types";

export function mapHeader(a: CharacterLike): HeaderView {
  const s = a.system;
  const ancestryClassLine = [a.ancestry?.name, a.class?.name].filter(Boolean).join(" ");
  return {
    name: a.name,
    img: a.img,
    level: s.details.level.value,
    ancestryClassLine,
    heroPoints: { value: s.resources.heroPoints.value, max: s.resources.heroPoints.max },
    hp: { value: s.attributes.hp.value, temp: s.attributes.hp.temp, max: s.attributes.hp.max },
    dying: { value: s.attributes.dying.value, max: s.attributes.dying.max },
    wounded: s.attributes.wounded.value,
    ac: s.attributes.ac.value,
    perceptionMod: s.perception.value,
    speed: s.movement?.speeds.land?.value ?? 0,
  };
}
```

- [ ] **Step 5: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.header.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.header.test.ts tests/fixtures/characterLike.ts
git commit -m "Phase 2 (Task 3): header mapper + test fixture factory"
```

---

## Task 4: Defenses, abilities & traits mappers

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.stats.test.ts
import { describe, it, expect } from "vitest";
import { mapDefenses, mapAbilities, mapTraits, initiativeOptions } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("initiativeOptions", () => {
  it("is perception followed by each skill slug", () => {
    const opts = initiativeOptions(makeCharacterLike());
    expect(opts[0]).toEqual({ value: "perception", label: "Perception" });
    expect(opts.map((o) => o.value)).toEqual(["perception", "athletics", "acrobatics"]);
  });
});

describe("mapDefenses", () => {
  it("maps saves, perception, initiative, ac, class DCs and speeds", () => {
    const d = mapDefenses(makeCharacterLike());
    expect(d.ac).toBe(24);
    expect(d.saves).toEqual([
      { slug: "fortitude", label: "Fortitude", mod: 13, rank: 2 },
      { slug: "reflex", label: "Reflex", mod: 11, rank: 2 },
      { slug: "will", label: "Will", mod: 9, rank: 1 },
    ]);
    expect(d.perception).toEqual({ mod: 12, rank: 2, senses: [{ label: "Low-Light Vision" }] });
    expect(d.initiative.mod).toBe(12);
    expect(d.initiative.statistic).toBe("perception");
    expect(d.classDCs).toEqual([{ slug: "fighter", label: "Fighter", value: 24, rank: 2, primary: true }]);
    expect(d.speeds).toEqual([{ type: "land", label: "Land", value: 25 }]);
    expect(d.shield).toBeUndefined();
  });

  it("includes a shield only when one is equipped (itemId set)", () => {
    const a = makeCharacterLike();
    a.system.attributes.shield = { itemId: "sh1", ac: 2, hp: { value: 12, max: 12 }, hardness: 5, broken: false, raised: true };
    const d = mapDefenses(a);
    expect(d.shield).toEqual({ ac: 2, hp: { value: 12, max: 12 }, hardness: 5, broken: false, raised: true });
  });

  it("lists every present movement speed", () => {
    const a = makeCharacterLike();
    a.system.movement = { speeds: { land: { value: 25 }, fly: { value: 30 }, swim: undefined } };
    expect(mapDefenses(a).speeds).toEqual([
      { type: "land", label: "Land", value: 25 },
      { type: "fly", label: "Fly", value: 30 },
    ]);
  });
});

describe("mapAbilities", () => {
  it("maps six modifiers and marks the key ability", () => {
    const abilities = mapAbilities(makeCharacterLike());
    expect(abilities).toHaveLength(6);
    expect(abilities[0]).toEqual({ slug: "str", label: "STR", mod: 4, key: true });
    expect(abilities.find((x) => x.slug === "dex")).toEqual({ slug: "dex", label: "DEX", mod: 3, key: false });
  });
});

describe("mapTraits", () => {
  it("maps size and IWR labels, omitting empties", () => {
    const a = makeCharacterLike();
    a.system.attributes.resistances = [{ label: "Fire 5", value: 5 }];
    a.system.attributes.weaknesses = [{ label: "Cold 5", value: 5 }];
    a.system.attributes.immunities = [{ label: "Disease" }];
    const t = mapTraits(a);
    expect(t.size).toBe("Medium");
    expect(t.resistances).toEqual([{ label: "Fire 5" }]);
    expect(t.weaknesses).toEqual([{ label: "Cold 5" }]);
    expect(t.immunities).toEqual([{ label: "Disease" }]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.stats.test.ts` — Expected: FAIL (exports missing).

- [ ] **Step 3: Implement the mappers** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type {
  AbilityView, DefensesView, InitiativeOption, Rank, SaveView, SpeedView, TraitsView,
} from "./types";

const SAVE_LABELS: Record<SaveView["slug"], string> = { fortitude: "Fortitude", reflex: "Reflex", will: "Will" };
const ABILITY_LABELS: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const SPEED_LABELS: Record<string, string> = { land: "Land", fly: "Fly", swim: "Swim", climb: "Climb", burrow: "Burrow" };
const SIZE_LABELS: Record<string, string> = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };

export function initiativeOptions(a: CharacterLike): InitiativeOption[] {
  const skills = Object.values(a.skills).map((s) => ({ value: s.slug, label: s.label }));
  return [{ value: "perception", label: "Perception" }, ...skills];
}

export function mapDefenses(a: CharacterLike): DefensesView {
  const s = a.system;
  const sh = s.attributes.shield;
  const saves: SaveView[] = (["fortitude", "reflex", "will"] as const).map((slug) => ({
    slug, label: SAVE_LABELS[slug], mod: s.saves[slug].value, rank: s.saves[slug].rank as Rank,
  }));
  const speeds: SpeedView[] = Object.entries(s.movement?.speeds ?? {})
    .filter(([, v]) => v && typeof v.value === "number")
    .map(([type, v]) => ({ type, label: SPEED_LABELS[type] ?? type, value: (v as { value: number }).value }));
  const classDCs = Object.values(s.proficiencies?.classDCs ?? {}).map((c) => ({
    slug: c.slug, label: c.label, value: c.value, rank: c.rank as Rank, primary: c.primary,
  }));
  return {
    ac: s.attributes.ac.value,
    shield: sh && sh.itemId
      ? { ac: sh.ac, hp: { value: sh.hp.value, max: sh.hp.max }, hardness: sh.hardness, broken: sh.broken, raised: sh.raised ?? false }
      : undefined,
    saves,
    perception: { mod: s.perception.value, rank: s.perception.rank as Rank,
      senses: s.perception.senses.map((x) => ({ label: x.label ?? x.type ?? "" })).filter((x) => x.label) },
    initiative: { mod: s.initiative.totalModifier, statistic: s.initiative.statistic, options: initiativeOptions(a) },
    classDCs,
    speeds,
  };
}

export function mapAbilities(a: CharacterLike): AbilityView[] {
  const key = a.system.details.keyability?.value;
  return (["str", "dex", "con", "int", "wis", "cha"] as const).map((slug) => ({
    slug, label: ABILITY_LABELS[slug], mod: a.system.abilities[slug].mod, key: slug === key,
  }));
}

export function mapTraits(a: CharacterLike): TraitsView {
  const at = a.system.attributes;
  const iwr = (xs?: { label: string }[]) => (xs ?? []).map((x) => ({ label: x.label }));
  return {
    size: SIZE_LABELS[a.system.traits.size.value] ?? a.system.traits.size.value,
    immunities: iwr(at.immunities), resistances: iwr(at.resistances), weaknesses: iwr(at.weaknesses),
  };
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.stats.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.stats.test.ts
git commit -m "Phase 2 (Task 4): defenses, abilities & traits mappers"
```

---

## Task 5: Skills mapper

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.skills.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.skills.test.ts
import { describe, it, expect } from "vitest";
import { mapSkills } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapSkills", () => {
  it("maps skills sorted alphabetically by label", () => {
    const skills = mapSkills(makeCharacterLike());
    expect(skills.map((s) => s.slug)).toEqual(["acrobatics", "athletics"]);
    expect(skills[1]).toEqual({ slug: "athletics", label: "Athletics", mod: 13, rank: 2, armor: true, lore: false });
  });

  it("flags lore skills and still sorts them in", () => {
    const a = makeCharacterLike();
    a.skills = {
      ...a.skills,
      "warfare-lore": { slug: "warfare-lore", label: "Warfare Lore", mod: 8, rank: 1, armor: false, lore: true },
    };
    const lore = mapSkills(a).find((s) => s.slug === "warfare-lore");
    expect(lore).toEqual({ slug: "warfare-lore", label: "Warfare Lore", mod: 8, rank: 1, armor: false, lore: true });
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.skills.test.ts` — Expected: FAIL (export missing).

- [ ] **Step 3: Implement `mapSkills`** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { SkillView } from "./types";

export function mapSkills(a: CharacterLike): SkillView[] {
  return Object.values(a.skills)
    .map((s) => ({ slug: s.slug, label: s.label, mod: s.mod, rank: s.rank as Rank, armor: s.armor, lore: s.lore ?? false }))
    .sort((x, y) => x.label.localeCompare(y.label));
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.skills.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.skills.test.ts
git commit -m "Phase 2 (Task 5): skills mapper"
```

---

## Task 6: Conditions & effects mappers

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.conditions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.conditions.test.ts
import { describe, it, expect } from "vitest";
import { mapConditions, mapEffects, effectBadgeLabel } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapConditions", () => {
  it("maps active conditions with value and lock state", () => {
    const a = makeCharacterLike();
    a.conditions.active = [
      { slug: "frightened", name: "Frightened", value: 1, img: "f.svg", isLocked: false },
      { slug: "clumsy", name: "Clumsy", value: 1, img: "c.svg", isLocked: true },
      { slug: "blinded", name: "Blinded", value: null, img: "b.svg" },
    ];
    expect(mapConditions(a)).toEqual([
      { slug: "frightened", name: "Frightened", value: 1, img: "f.svg", locked: false },
      { slug: "clumsy", name: "Clumsy", value: 1, img: "c.svg", locked: true },
      { slug: "blinded", name: "Blinded", value: null, img: "b.svg", locked: false },
    ]);
  });
});

describe("effectBadgeLabel", () => {
  it("prefers explicit label, else stringifies value, else null", () => {
    expect(effectBadgeLabel({ label: "3 rounds" })).toBe("3 rounds");
    expect(effectBadgeLabel({ value: 2 })).toBe("2");
    expect(effectBadgeLabel(null)).toBeNull();
    expect(effectBadgeLabel(undefined)).toBeNull();
  });
});

describe("mapEffects", () => {
  it("maps non-condition effects with a badge label", () => {
    const a = makeCharacterLike();
    a.itemTypes.effect = [{ name: "Bless", img: "bless.svg", badge: { value: 2 } }];
    expect(mapEffects(a)).toEqual([{ name: "Bless", img: "bless.svg", badge: "2" }]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.conditions.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { ConditionView, EffectView } from "./types";

export function effectBadgeLabel(badge: { value?: number; label?: string } | null | undefined): string | null {
  if (!badge) return null;
  if (badge.label) return badge.label;
  if (typeof badge.value === "number") return String(badge.value);
  return null;
}

export function mapConditions(a: CharacterLike): ConditionView[] {
  return a.conditions.active.map((c) => ({
    slug: c.slug, name: c.name, value: c.value, img: c.img, locked: c.isLocked ?? false,
  }));
}

export function mapEffects(a: CharacterLike): EffectView[] {
  return a.itemTypes.effect.map((e) => ({ name: e.name, img: e.img, badge: effectBadgeLabel(e.badge) }));
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.conditions.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.conditions.test.ts
git commit -m "Phase 2 (Task 6): conditions & effects mappers"
```

---

## Task 7: Inventory mapper (+ bulk/price formatting)

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.inventory.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.inventory.test.ts
import { describe, it, expect } from "vitest";
import { mapInventory, formatBulk, formatPrice } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";
import type { InventoryItemLike } from "../src/foundry/actor/types";

const item = (over: Partial<InventoryItemLike> & { id: string; name: string; type: string }): InventoryItemLike => ({
  quantity: 1,
  bulk: { value: 1 },
  system: { equipped: { carryType: "worn" } },
  ...over,
});

describe("formatBulk", () => {
  it("renders 0 as dash, <1 as L, else the number", () => {
    expect(formatBulk(0)).toBe("—");
    expect(formatBulk(0.1)).toBe("L");
    expect(formatBulk(2)).toBe("2");
  });
});

describe("formatPrice", () => {
  it("renders the highest non-zero denomination", () => {
    expect(formatPrice({ gp: 5, sp: 2 })).toBe("5 gp");
    expect(formatPrice({ cp: 8 })).toBe("8 cp");
    expect(formatPrice({})).toBe("—");
  });
});

describe("mapInventory", () => {
  it("groups items by category and maps equip/invest state", () => {
    const a = makeCharacterLike();
    a.inventory.contents = [
      item({ id: "w1", name: "Longsword", type: "weapon", bulk: { value: 1 },
        system: { equipped: { carryType: "held", handsHeld: 1 }, price: { value: { gp: 1 } } } }),
      item({ id: "a1", name: "Breastplate", type: "armor", bulk: { value: 2 },
        system: { equipped: { carryType: "worn", invested: false } } }),
      item({ id: "p1", name: "Bag", type: "backpack", isContainer: true,
        system: { equipped: { carryType: "worn" } } }),
    ];
    a.inventory.currency = { cp: 0, sp: 5, gp: 12, pp: 0 };
    a.inventory.totalBulk = { value: 3 };
    const inv = mapInventory(a);

    expect(inv.categories.map((c) => c.key)).toEqual(["weapon", "armor", "container"]);
    const sword = inv.categories[0].items[0];
    expect(sword).toMatchObject({ id: "w1", name: "Longsword", carryType: "held", handsHeld: 1, equipped: true, invested: null, bulkLabel: "1", priceLabel: "1 gp" });
    expect(inv.categories[1].items[0]).toMatchObject({ invested: false, equipped: true });
    expect(inv.categories[2].items[0]).toMatchObject({ isContainer: true });
    expect(inv.currency).toEqual({ cp: 0, sp: 5, gp: 12, pp: 0 });
    expect(inv.bulkLabel).toBe("3");
    expect(inv.encumbered).toBe(false);
  });

  it("treats stowed/dropped as not equipped", () => {
    const a = makeCharacterLike();
    a.inventory.contents = [item({ id: "x", name: "Torch", type: "consumable", system: { equipped: { carryType: "stowed" } } })];
    expect(mapInventory(a).categories[0].items[0].equipped).toBe(false);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.inventory.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { CoinsView, InventoryView, InventoryCategoryView, InventoryItemView } from "./types";

const DASH = "—";
/** Maps PF2e item.type → display category key + label + sort order. */
const ITEM_CATEGORY: Record<string, { key: string; label: string; order: number }> = {
  weapon: { key: "weapon", label: "Weapons", order: 0 },
  armor: { key: "armor", label: "Armor", order: 1 },
  equipment: { key: "equipment", label: "Equipment", order: 2 },
  consumable: { key: "consumable", label: "Consumables", order: 3 },
  treasure: { key: "treasure", label: "Treasure", order: 4 },
  backpack: { key: "container", label: "Containers", order: 5 },
};
const OTHER_CATEGORY = { key: "other", label: "Other", order: 6 };

export function formatBulk(value: number): string {
  if (!value) return DASH;
  if (value < 1) return "L";
  return String(Math.round(value * 100) / 100);
}

export function formatPrice(coins: { cp?: number; sp?: number; gp?: number; pp?: number }): string {
  for (const d of ["pp", "gp", "sp", "cp"] as const) {
    const n = coins[d];
    if (n) return `${n} ${d}`;
  }
  return DASH;
}

function mapInventoryItem(it: InventoryItemLike): InventoryItemView {
  const eq = it.system.equipped;
  const bulkValue = it.bulk?.value ?? it.system.bulk?.value ?? 0;
  return {
    id: it.id, name: it.name, img: it.img, quantity: it.quantity,
    bulkLabel: formatBulk(bulkValue),
    priceLabel: formatPrice(it.system.price?.value ?? {}),
    carryType: eq.carryType, handsHeld: eq.handsHeld ?? 0,
    invested: eq.invested ?? null,
    equipped: eq.carryType !== "stowed" && eq.carryType !== "dropped",
    isContainer: it.isContainer ?? false,
    containerId: it.container?.id ?? null,
  };
}

export function mapInventory(a: CharacterLike): InventoryView {
  const groups = new Map<string, InventoryCategoryView>();
  for (const it of a.inventory.contents) {
    const cat = ITEM_CATEGORY[it.type] ?? OTHER_CATEGORY;
    if (!groups.has(cat.key)) groups.set(cat.key, { key: cat.key, label: cat.label, items: [] });
    groups.get(cat.key)!.items.push(mapInventoryItem(it));
  }
  const categories = [...groups.values()].sort(
    (x, y) => (ITEM_CATEGORY[catType(x.key)]?.order ?? OTHER_CATEGORY.order) - (ITEM_CATEGORY[catType(y.key)]?.order ?? OTHER_CATEGORY.order),
  );
  const c = a.inventory.currency;
  const currency: CoinsView = { cp: c.cp ?? 0, sp: c.sp ?? 0, gp: c.gp ?? 0, pp: c.pp ?? 0 };
  return { categories, currency, bulkLabel: formatBulk(a.inventory.totalBulk.value), encumbered: a.attributes?.encumbered ?? false };
}

/** Reverse a display category key back to a representative item.type for ordering. */
function catType(key: string): string {
  return key === "container" ? "backpack" : key;
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.inventory.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.inventory.test.ts
git commit -m "Phase 2 (Task 7): inventory mapper with bulk/price formatting"
```

---

## Task 8: Feats & features mapper

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.feats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.feats.test.ts
import { describe, it, expect } from "vitest";
import { mapFeats, actionGlyph } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";
import type { FeatLike } from "../src/foundry/actor/types";

const feat = (over: Partial<FeatLike> & { id: string; name: string; category: string }): FeatLike => ({
  id: over.id, name: over.name,
  system: { category: over.category, level: over.system?.level ?? { value: 1 },
    actionType: over.system?.actionType, actions: over.system?.actions, traits: over.system?.traits ?? { value: [] } },
});

describe("actionGlyph", () => {
  it("maps action economy to a glyph code", () => {
    expect(actionGlyph({ value: "action" }, { value: 1 })).toBe("1");
    expect(actionGlyph({ value: "action" }, { value: 2 })).toBe("2");
    expect(actionGlyph({ value: "reaction" }, { value: null })).toBe("reaction");
    expect(actionGlyph({ value: "free" }, { value: null })).toBe("free");
    expect(actionGlyph({ value: "passive" }, { value: null })).toBeNull();
    expect(actionGlyph(undefined, undefined)).toBeNull();
  });
});

describe("mapFeats", () => {
  it("groups feats by category in display order, sorted by level", () => {
    const a = makeCharacterLike();
    a.itemTypes.feat = [
      feat({ id: "c2", name: "Sudden Charge", category: "class", system: { category: "class", level: { value: 1 }, actionType: { value: "action" }, actions: { value: 2 }, traits: { value: ["flourish"] } } }),
      feat({ id: "an1", name: "Natural Ambition", category: "ancestry", system: { category: "ancestry", level: { value: 1 } } }),
      feat({ id: "cf1", name: "Attack of Opportunity", category: "classfeature", system: { category: "classfeature", level: { value: 1 }, actionType: { value: "reaction" }, actions: { value: null } } }),
      feat({ id: "c5", name: "Power Attack", category: "class", system: { category: "class", level: { value: 5 } } }),
    ];
    const groups = mapFeats(a);
    expect(groups.map((g) => g.key)).toEqual(["ancestry", "class", "classfeature"]);
    const cls = groups.find((g) => g.key === "class")!;
    expect(cls.label).toBe("Class Feats");
    expect(cls.feats.map((f) => f.name)).toEqual(["Sudden Charge", "Power Attack"]);
    expect(cls.feats[0]).toEqual({ id: "c2", name: "Sudden Charge", img: undefined, actionGlyph: "2", traits: ["flourish"], level: 1 });
  });

  it("omits empty groups", () => {
    expect(mapFeats(makeCharacterLike())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.feats.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { FeatGroupView, FeatView } from "./types";

/** category key → label + display order. Unknown categories fall through to "other". */
const FEAT_GROUPS: Record<string, { label: string; order: number }> = {
  ancestry: { label: "Ancestry Feats", order: 0 },
  background: { label: "Background Feats", order: 1 },
  class: { label: "Class Feats", order: 2 },
  classfeature: { label: "Class Features", order: 3 },
  general: { label: "General Feats", order: 4 },
  skill: { label: "Skill Feats", order: 5 },
  bonus: { label: "Bonus Feats", order: 6 },
};
const OTHER_FEAT_GROUP = { label: "Other", order: 7 };

export function actionGlyph(
  actionType: { value: string | null } | undefined,
  actions: { value: number | null } | undefined,
): string | null {
  const type = actionType?.value;
  if (type === "action") return actions?.value ? String(actions.value) : "1";
  if (type === "reaction") return "reaction";
  if (type === "free") return "free";
  return null;
}

export function mapFeats(a: CharacterLike): FeatGroupView[] {
  const groups = new Map<string, FeatGroupView>();
  for (const f of a.itemTypes.feat) {
    const cat = f.system.category;
    const meta = FEAT_GROUPS[cat] ?? OTHER_FEAT_GROUP;
    const key = FEAT_GROUPS[cat] ? cat : "other";
    if (!groups.has(key)) groups.set(key, { key, label: meta.label, feats: [] });
    const view: FeatView = {
      id: f.id, name: f.name, img: f.img,
      actionGlyph: actionGlyph(f.system.actionType, f.system.actions),
      traits: f.system.traits?.value ?? [],
      level: f.system.level?.value ?? 0,
    };
    groups.get(key)!.feats.push(view);
  }
  for (const g of groups.values()) g.feats.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name));
  return [...groups.values()].sort(
    (x, y) => (FEAT_GROUPS[x.key]?.order ?? OTHER_FEAT_GROUP.order) - (FEAT_GROUPS[y.key]?.order ?? OTHER_FEAT_GROUP.order),
  );
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.feats.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.feats.test.ts
git commit -m "Phase 2 (Task 8): feats & features mapper"
```

---

## Task 9: Bio mapper

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.bio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.bio.test.ts
import { describe, it, expect } from "vitest";
import { mapBio } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapBio", () => {
  it("maps lineage, languages, size and proficiency lists", () => {
    const a = makeCharacterLike();
    a.system.proficiencies = {
      ...a.system.proficiencies,
      attacks: { "simple-melee": { label: "Simple", rank: 2, visible: true }, hidden: { label: "Hidden", rank: 0, visible: false } },
      defenses: { unarmored: { label: "Unarmored", rank: 1 } },
    };
    const bio = mapBio(a);
    expect(bio).toMatchObject({ ancestry: "Human", heritage: "Versatile Heritage", background: "Field Medic", className: "Fighter", size: "Medium" });
    expect(bio.deity).toBeUndefined();
    expect(bio.languages).toEqual(["common"]);
    expect(bio.attacks).toEqual([{ label: "Simple", rank: 2 }]); // hidden filtered out
    expect(bio.defenses).toEqual([{ label: "Unarmored", rank: 1 }]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.bio.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { BioView, ProficiencyView } from "./types";

function mapProficiencies(rec?: Record<string, { label: string; rank: number; visible?: boolean }>): ProficiencyView[] {
  return Object.values(rec ?? {})
    .filter((p) => p.visible !== false)
    .map((p) => ({ label: p.label, rank: p.rank as Rank }));
}

export function mapBio(a: CharacterLike): BioView {
  const s = a.system;
  return {
    ancestry: a.ancestry?.name, heritage: a.heritage?.name, background: a.background?.name,
    className: a.class?.name, deity: a.deity?.name ?? undefined,
    size: SIZE_LABELS[s.traits.size.value] ?? s.traits.size.value,
    languages: s.details.languages?.value ?? [],
    attacks: mapProficiencies(s.proficiencies?.attacks),
    defenses: mapProficiencies(s.proficiencies?.defenses),
    appearance: s.details.biography?.appearance || undefined,
    backstory: s.details.biography?.backstory || undefined,
  };
}
```
> `SIZE_LABELS` is already defined in `view.ts` (Task 4). Reuse it — do not redeclare.

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/characterView.bio.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.bio.test.ts
git commit -m "Phase 2 (Task 9): bio mapper"
```

---

## Task 10: Assemble `buildCharacterView`

**Files:**
- Modify: `src/foundry/actor/view.ts`
- Create: `tests/characterView.build.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/characterView.build.test.ts
import { describe, it, expect } from "vitest";
import { buildCharacterView } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("buildCharacterView", () => {
  it("composes every section into one view keyed by actor id", () => {
    const v = buildCharacterView(makeCharacterLike());
    expect(v.id).toBe("actor1");
    expect(v.header.name).toBe("Valeros");
    expect(v.defenses.ac).toBe(24);
    expect(v.abilities).toHaveLength(6);
    expect(v.skills.map((s) => s.slug)).toContain("athletics");
    expect(v.conditions).toEqual([]);
    expect(v.effects).toEqual([]);
    expect(v.inventory.categories).toEqual([]);
    expect(v.featGroups).toEqual([]);
    expect(v.bio.className).toBe("Fighter");
    expect(v.traits.size).toBe("Medium");
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/characterView.build.test.ts` — Expected: FAIL (export missing).

- [ ] **Step 3: Implement the orchestrator** (append to `view.ts`)

```ts
// src/foundry/actor/view.ts (append)
import type { CharacterView } from "./types";

export function buildCharacterView(a: CharacterLike): CharacterView {
  return {
    id: a.id,
    header: mapHeader(a),
    defenses: mapDefenses(a),
    abilities: mapAbilities(a),
    traits: mapTraits(a),
    skills: mapSkills(a),
    conditions: mapConditions(a),
    effects: mapEffects(a),
    inventory: mapInventory(a),
    featGroups: mapFeats(a),
    bio: mapBio(a),
  };
}
```

- [ ] **Step 4: Run full suite → pass, typecheck, commit**

Run: `npm run test` — Expected: PASS (all mapper suites + Phase 1 tests).
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/view.ts tests/characterView.build.test.ts
git commit -m "Phase 2 (Task 10): assemble buildCharacterView orchestrator"
```

---

## Task 11: HP math helpers (pure)

The numpad needs pure math for Heal/Set (Damage delegates to the engine's `applyDamage`). Keep this testable and separate from the side-effecting wrappers.

**Files:**
- Create: `src/foundry/actor/hp.ts`
- Create: `tests/hpMath.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/hpMath.test.ts
import { describe, it, expect } from "vitest";
import { hpAfterHeal, hpClamped, parseAmount } from "../src/foundry/actor/hp";

describe("hpAfterHeal", () => {
  it("adds healing but never exceeds max", () => {
    expect(hpAfterHeal(58, 72, 10)).toBe(68);
    expect(hpAfterHeal(70, 72, 10)).toBe(72);
    expect(hpAfterHeal(72, 72, 5)).toBe(72);
  });
});

describe("hpClamped", () => {
  it("clamps an absolute value into [0, max]", () => {
    expect(hpClamped(50, 72)).toBe(50);
    expect(hpClamped(-5, 72)).toBe(0);
    expect(hpClamped(99, 72)).toBe(72);
  });
});

describe("parseAmount", () => {
  it("parses a positive integer, else 0", () => {
    expect(parseAmount("12")).toBe(12);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("-3")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount("4.9")).toBe(4);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/hpMath.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/foundry/actor/hp.ts

export function hpClamped(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function hpAfterHeal(current: number, max: number, amount: number): number {
  return hpClamped(current + Math.max(0, amount), max);
}

/** Numpad input → non-negative integer (0 on garbage). */
export function parseAmount(raw: string): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/hpMath.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/hp.ts tests/hpMath.test.ts
git commit -m "Phase 2 (Task 11): pure HP math helpers"
```

---

## Task 12: Mutation helpers (side-effecting wrappers)

Thin async wrappers — the only app code that mutates Foundry. Verified by typecheck (here) and the manual checklist (later tasks); no unit test (they only forward to the live API).

**Files:**
- Create: `src/foundry/actor/mutations.ts`

- [ ] **Step 1: Implement the helpers**

```ts
// src/foundry/actor/mutations.ts

/** Minimal shapes for the live document methods we call. */
interface ActorDoc {
  update(data: Record<string, unknown>): Promise<unknown>;
  applyDamage?(args: { damage: number }): Promise<unknown>;
  toggleCondition?(slug: string): Promise<unknown>;
  increaseCondition?(slug: string): Promise<unknown>;
  decreaseCondition?(slug: string): Promise<unknown>;
  items?: { get(id: string): ItemDoc | undefined };
}
interface ItemDoc { update(data: Record<string, unknown>): Promise<unknown>; }

function getActor(actorId: string): ActorDoc | undefined {
  return (game as any).actors.get(actorId) as ActorDoc | undefined;
}

/** Wrap a mutation so a rejected promise surfaces via Foundry's own toast, never throws to React. */
async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] mutation failed", err);
    (ui as any)?.notifications?.error?.("Action failed — see console.");
  }
}

export function setHp(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.attributes.hp.value": value }));
}
export function setTempHp(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.attributes.hp.temp": value }));
}
export function applyDamageTo(actorId: string, amount: number): Promise<void> {
  return guard(() => {
    const a = getActor(actorId)!;
    return a.applyDamage ? a.applyDamage({ damage: amount }) : a.update({ "system.attributes.hp.value": Math.max(0, amount) });
  });
}
export function setHeroPoints(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.resources.heroPoints.value": value }));
}
export function setInitiativeStatistic(actorId: string, statistic: string): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.initiative.statistic": statistic }));
}
export function setShieldHp(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId)!.update({ "system.attributes.shield.hp.value": value }));
}
export function toggleCondition(actorId: string, slug: string): Promise<void> {
  return guard(() => getActor(actorId)!.toggleCondition!(slug));
}
export function adjustCondition(actorId: string, slug: string, delta: 1 | -1): Promise<void> {
  return guard(() => {
    const a = getActor(actorId)!;
    return delta > 0 ? a.increaseCondition!(slug) : a.decreaseCondition!(slug);
  });
}
export function setEquipped(actorId: string, itemId: string, carryType: string, handsHeld = 0): Promise<void> {
  return guard(() =>
    getActor(actorId)!.items!.get(itemId)!.update({ "system.equipped.carryType": carryType, "system.equipped.handsHeld": handsHeld }),
  );
}
export function setInvested(actorId: string, itemId: string, invested: boolean): Promise<void> {
  return guard(() => getActor(actorId)!.items!.get(itemId)!.update({ "system.equipped.invested": invested }));
}
```
> `game` and `ui` are Foundry globals provided by `fvtt-types`; the `as any` casts match the Phase 1 idiom (PF2e subclass methods aren't in base types).

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/foundry/actor/mutations.ts
git commit -m "Phase 2 (Task 12): actor mutation helpers"
```

---

## Task 13: Store — `sheetSubTab`

**Files:**
- Modify: `src/app/store.ts`
- Modify: `tests/store.test.ts`

- [ ] **Step 1: Add the failing test** (append inside `tests/store.test.ts`'s `describe`)

```ts
// tests/store.test.ts — add these two its, and reset sheetSubTab in beforeEach
  it("defaults the sheet sub-tab to vitals", () => {
    expect(useAppStore.getState().sheetSubTab).toBe("vitals");
  });
  it("switches the sheet sub-tab", () => {
    useAppStore.getState().setSheetSubTab("skills");
    expect(useAppStore.getState().sheetSubTab).toBe("skills");
  });
```
Also update the existing `beforeEach` reset to include the new field:
```ts
  beforeEach(() => useAppStore.setState({ activeTab: "sheet", actorId: null, sheetSubTab: "vitals" }));
```

- [ ] **Step 2: Run → fail**

Run: `npx vitest run tests/store.test.ts` — Expected: FAIL (`sheetSubTab` undefined / `setSheetSubTab` not a function).

- [ ] **Step 3: Implement** (modify `src/app/store.ts`)

```ts
// src/app/store.ts — full file
import { create } from "zustand";

export type TabId = "sheet" | "actions" | "combat" | "journal" | "map";
export type SheetSubTab = "vitals" | "skills" | "items" | "feats" | "bio";

export interface AppState {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  actorId: string | null;
  setActorId: (id: string | null) => void;
  sheetSubTab: SheetSubTab;
  setSheetSubTab: (tab: SheetSubTab) => void;
}

/** Mirrors UI state only; Foundry Documents remain the source of truth. */
export const useAppStore = create<AppState>((set) => ({
  activeTab: "sheet",
  setActiveTab: (tab) => set({ activeTab: tab }),
  actorId: null,
  setActorId: (id) => set({ actorId: id }),
  sheetSubTab: "vitals",
  setSheetSubTab: (tab) => set({ sheetSubTab: tab }),
}));
```

- [ ] **Step 4: Run → pass, typecheck, commit**

Run: `npx vitest run tests/store.test.ts` — Expected: PASS.
Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/app/store.ts tests/store.test.ts
git commit -m "Phase 2 (Task 13): store sheetSubTab state"
```

---

## Task 14: `useActor` live-mirror hook

**Files:**
- Create: `src/app/useActor.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/app/useActor.ts
import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "./useFoundryHook";
import { buildCharacterView } from "../foundry/actor/view";
import type { CharacterLike, CharacterView } from "../foundry/actor/types";

/** Reads the live actor and rebuilds the view whenever a relevant document
 *  hook fires for THIS actor. Returns null if the actor is gone. */
export function useActor(actorId: string): CharacterView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  // Bump when an event targets this actor. Items (incl. conditions/effects)
  // carry their owner as `parent`; actor events carry it as the doc itself.
  const onActor = useCallback(
    (doc: any) => { if (doc?.id === actorId) bump(); },
    [actorId],
  );
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
    return buildCharacterView(actor as unknown as CharacterLike);
    // `version` is an intentional invalidation dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
```
> `useFoundryHook` (Phase 1) re-subscribes when the handler identity changes; the `useCallback`s keep handlers stable except when `actorId` changes. Each handler calls `bump()` to force a re-read — never holds actor data in React state.

- [ ] **Step 2: Typecheck and commit**

Run: `npm run typecheck` — Expected: PASS.
```bash
git add src/app/useActor.ts
git commit -m "Phase 2 (Task 14): useActor live-mirror hook"
```

---

> **Components note (Tasks 15–25):** following the Phase 1 convention, components are verified by `npm run typecheck` + `npm run build` and the manual checklist (Task 26), not unit tests. Use Tailwind utilities and Foundry's Font Awesome exactly as Phase 1 does. Touch targets ≥44px. Each file has one responsibility.

## Task 15: Shared presentational parts

**Files:**
- Create: `src/app/sheet/parts/Chip.tsx`
- Create: `src/app/sheet/parts/RankPip.tsx`
- Create: `src/app/sheet/parts/Pips.tsx`
- Create: `src/app/sheet/parts/StatRow.tsx`
- Create: `src/app/sheet/parts/ActionGlyph.tsx`

- [ ] **Step 1: Implement the parts**

```tsx
// src/app/sheet/parts/Chip.tsx
export function Chip({ children, tone = "default", onClick }: {
  children: React.ReactNode;
  tone?: "default" | "warn";
  onClick?: () => void;
}) {
  const tones = { default: "bg-zinc-800 text-zinc-200", warn: "bg-orange-900 text-orange-200" };
  const cls = `inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${tones[tone]}`;
  return onClick
    ? <button onClick={onClick} className={`${cls} min-h-0`}>{children}</button>
    : <span className={cls}>{children}</span>;
}
```

```tsx
// src/app/sheet/parts/RankPip.tsx
const RANK_LETTER = ["U", "T", "E", "M", "L"] as const;
const RANK_TONE = ["text-zinc-500", "text-zinc-300", "text-sky-300", "text-violet-300", "text-amber-300"] as const;

/** Proficiency rank as a single letter U/T/E/M/L. */
export function RankPip({ rank }: { rank: 0 | 1 | 2 | 3 | 4 }) {
  return <span className={`w-4 text-center text-xs font-bold ${RANK_TONE[rank]}`} title={`Rank ${rank}`}>{RANK_LETTER[rank]}</span>;
}
```

```tsx
// src/app/sheet/parts/Pips.tsx
/** A row of filled/empty pips. Optional onAdjust(delta) wires tap=+1 / long-press handled by caller. */
export function Pips({ value, max, label, onAdjust }: {
  value: number;
  max: number;
  label: string;
  onAdjust?: (delta: 1 | -1) => void;
}) {
  const pips = Array.from({ length: max }, (_, i) => i < value);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <div className="flex items-center gap-1">
        {pips.map((on, i) => (
          <button
            key={i}
            aria-label={`${label} ${i + 1}`}
            disabled={!onAdjust}
            onClick={() => onAdjust?.(i < value ? -1 : 1)}
            className={`h-4 w-4 rounded-full border ${on ? "border-amber-400 bg-amber-400" : "border-zinc-600 bg-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/app/sheet/parts/StatRow.tsx
export function StatRow({ label, value, right, onClick }: {
  label: React.ReactNode;
  value: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="text-zinc-300">{label}</span>
      <span className="flex items-center gap-2 font-semibold tabular-nums">{value}{right}</span>
    </>
  );
  return onClick
    ? <button onClick={onClick} className="flex min-h-11 w-full items-center justify-between px-1 py-2 text-left">{inner}</button>
    : <div className="flex min-h-11 items-center justify-between px-1 py-2">{inner}</div>;
}
```

```tsx
// src/app/sheet/parts/ActionGlyph.tsx
/** Renders a PF2e action-economy glyph from the mapper's code
 *  ("1" | "2" | "3" | "reaction" | "free"). Font-independent fallback. */
export function ActionGlyph({ code }: { code: string | null }) {
  if (!code) return null;
  if (code === "reaction") return <i className="fas fa-bolt text-amber-300" title="Reaction" aria-label="Reaction" />;
  if (code === "free") return <span className="text-xs font-bold text-emerald-300" title="Free action">◇</span>;
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold" title={`${code} actions`}>
      {code}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS (emits `dist/module.js` + `dist/style.css`).
```bash
git add src/app/sheet/parts
git commit -m "Phase 2 (Task 15): shared sheet parts (Chip, RankPip, Pips, StatRow, ActionGlyph)"
```

---

## Task 16: Sticky header + sub-tab bar + sheet shell (first live sheet)

Ships a **read-only but live** sheet: the sticky header reflects the actor in real time, hero/dying/wounded pips are already editable, and the five sub-tabs switch (panels are temporary stubs replaced in Tasks 19–23). HP tap and condition editing arrive in Tasks 17–18 (handlers are optional props, so the header renders non-interactive until then).

**Files:**
- Create: `src/app/sheet/VitalsHeader.tsx`
- Create: `src/app/sheet/SubTabBar.tsx`
- Create: `src/app/sheet/CharacterSheet.tsx`
- Modify: `src/app/SheetTab.tsx`

- [ ] **Step 1: Implement `VitalsHeader`**

```tsx
// src/app/sheet/VitalsHeader.tsx
import type { CharacterView } from "../../foundry/actor/types";
import { Chip } from "./parts/Chip";
import { Pips } from "./parts/Pips";

export function VitalsHeader({ header, conditions, onHpTap, onHeroAdjust, onDyingAdjust, onWoundedAdjust, onConditionTap, onConditionAdd, onSwitch }: {
  header: CharacterView["header"];
  conditions: CharacterView["conditions"];
  onHpTap?: () => void;
  onHeroAdjust?: (delta: 1 | -1) => void;
  onDyingAdjust?: (delta: 1 | -1) => void;
  onWoundedAdjust?: (delta: 1 | -1) => void;
  onConditionTap?: (slug: string) => void;
  onConditionAdd?: () => void;
  onSwitch?: () => void;
}) {
  const hpPct = header.hp.max ? Math.round((header.hp.value / header.hp.max) * 100) : 0;
  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-3 pb-2 pt-2">
      {/* identity + hero points */}
      <div className="flex items-center gap-2">
        {header.img && <img src={header.img} alt="" className="h-9 w-9 rounded object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{header.name}</span>
            {onSwitch && (
              <button onClick={onSwitch} aria-label="Switch character" className="text-zinc-400">
                <i className="fas fa-right-left text-xs" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="truncate text-[11px] text-zinc-400">L{header.level} {header.ancestryClassLine}</div>
        </div>
        <Pips value={header.heroPoints.value} max={header.heroPoints.max} label="Hero" onAdjust={onHeroAdjust} />
      </div>

      {/* HP bar + dying/wounded */}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onHpTap}
          disabled={!onHpTap}
          className="min-w-0 flex-1 text-left"
          aria-label="Edit hit points"
        >
          <div className="flex justify-between text-[11px]">
            <span>HP {header.hp.value} / {header.hp.max}{header.hp.temp ? <span className="text-sky-300"> +{header.hp.temp}</span> : null}</span>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded bg-zinc-700">
            <div className="h-full bg-emerald-500" style={{ width: `${hpPct}%` }} />
          </div>
        </button>
        {header.dying.value > 0 && <Pips value={header.dying.value} max={header.dying.max} label="Dying" onAdjust={onDyingAdjust} />}
        {header.wounded > 0 && <Pips value={header.wounded} max={Math.max(header.wounded, 3)} label="Wnd" onAdjust={onWoundedAdjust} />}
      </div>

      {/* reference strip */}
      <div className="mt-2 flex flex-wrap gap-1">
        <Chip>AC {header.ac}</Chip>
        <Chip>Per {header.perceptionMod >= 0 ? "+" : ""}{header.perceptionMod}</Chip>
        <Chip>Spd {header.speed}</Chip>
      </div>

      {/* conditions */}
      {(conditions.length > 0 || onConditionAdd) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {conditions.map((c) => (
            <Chip key={c.slug} tone="warn" onClick={onConditionTap ? () => onConditionTap(c.slug) : undefined}>
              {c.name}{c.value != null ? ` ${c.value}` : ""}{c.locked ? " 🔒" : ""}
            </Chip>
          ))}
          {onConditionAdd && (
            <button onClick={onConditionAdd} aria-label="Add condition" className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
              <i className="fas fa-plus text-xs" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Implement `SubTabBar`**

```tsx
// src/app/sheet/SubTabBar.tsx
import { useAppStore, type SheetSubTab } from "../store";

const SUB_TABS: { id: SheetSubTab; label: string }[] = [
  { id: "vitals", label: "Vitals" },
  { id: "skills", label: "Skills" },
  { id: "items", label: "Items" },
  { id: "feats", label: "Feats" },
  { id: "bio", label: "Bio" },
];

export function SubTabBar() {
  const active = useAppStore((s) => s.sheetSubTab);
  const setActive = useAppStore((s) => s.setSheetSubTab);
  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-900 px-2 py-1">
      {SUB_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`min-h-11 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
            active === t.id ? "bg-indigo-600 text-white" : "text-zinc-400"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Implement `CharacterSheet`** (panels are stubs for now)

```tsx
// src/app/sheet/CharacterSheet.tsx
import { useCallback } from "react";
import { useAppStore } from "../store";
import { useActor } from "../useActor";
import { useFoundryHook } from "../useFoundryHook";
import { VitalsHeader } from "./VitalsHeader";
import { SubTabBar } from "./SubTabBar";
import { setHeroPoints, adjustCondition } from "../../foundry/actor/mutations";

function PanelStub({ name }: { name: string }) {
  return <div className="p-4 text-sm text-zinc-500">{name} panel — coming in a later task.</div>;
}

export function CharacterSheet({ actorId, onSwitch }: { actorId: string; onSwitch?: () => void }) {
  const subTab = useAppStore((s) => s.sheetSubTab);
  const setActorId = useAppStore((s) => s.setActorId);
  const view = useActor(actorId);

  // Return to the picker/empty state if this actor is deleted.
  const onDelete = useCallback((doc: any) => { if (doc?.id === actorId) setActorId(null); }, [actorId, setActorId]);
  useFoundryHook("deleteActor", onDelete);

  const onHeroAdjust = useCallback((d: 1 | -1) => {
    if (!view) return;
    setHeroPoints(actorId, Math.max(0, Math.min(view.header.heroPoints.max, view.header.heroPoints.value + d)));
  }, [actorId, view]);
  const onDyingAdjust = useCallback((d: 1 | -1) => adjustCondition(actorId, "dying", d), [actorId]);
  const onWoundedAdjust = useCallback((d: 1 | -1) => adjustCondition(actorId, "wounded", d), [actorId]);

  if (!view) {
    return <div className="flex h-full items-center justify-center p-6 text-center text-zinc-400">Character unavailable.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <VitalsHeader
        header={view.header}
        conditions={view.conditions}
        onHeroAdjust={onHeroAdjust}
        onDyingAdjust={onDyingAdjust}
        onWoundedAdjust={onWoundedAdjust}
        onSwitch={onSwitch}
      />
      <SubTabBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {subTab === "vitals" && <PanelStub name="Vitals" />}
        {subTab === "skills" && <PanelStub name="Skills" />}
        {subTab === "items" && <PanelStub name="Items" />}
        {subTab === "feats" && <PanelStub name="Feats" />}
        {subTab === "bio" && <PanelStub name="Bio" />}
      </div>
    </div>
  );
}
```

> **Hooks discipline (applies to Tasks 17, 18, 21 too):** every `useState`/`useCallback`/`useFoundryHook` in `CharacterSheet` MUST sit **above** the `if (!view) return …` guard. Later tasks add hooks to this component — always insert them in the hooks block before that guard. Derived plain consts that read `view` (non-hook) go *after* the guard. The `npm run typecheck` gate plus React's dev warnings catch violations.

- [ ] **Step 4: Wire `SheetTab` to render `CharacterSheet`**

Replace the `if (actorId) { … }` block in `src/app/SheetTab.tsx` (the portrait/name placeholder) with:

```tsx
  if (actorId) {
    return (
      <CharacterSheet
        actorId={actorId}
        onSwitch={resolution.kind === "picker" ? () => setActorId(null) : undefined}
      />
    );
  }
```
And add the import at the top: `import { CharacterSheet } from "./sheet/CharacterSheet";`
(Keep the existing `picker` and `none` branches unchanged.)

- [ ] **Step 5: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/VitalsHeader.tsx src/app/sheet/SubTabBar.tsx src/app/sheet/CharacterSheet.tsx src/app/SheetTab.tsx
git commit -m "Phase 2 (Task 16): sticky header, sub-tab bar, live sheet shell"
```

- [ ] **Step 6: Manual verify** (live/emulated mobile Foundry; rebuild with `npm run build`, reload Foundry)
  1. Sheet tab shows the live header: name, level/ancestry/class, hero pips, HP bar, AC/Per/Spd, conditions.
  2. GM changes the actor's HP on desktop → the phone HP bar updates within ~1s (proves `useActor`).
  3. Tapping a hero pip adds/removes a hero point (persists, GM sees it).
  4. The five sub-tabs switch the stub content; the header stays put while content scrolls.

---

## Task 17: HP numpad modal

**Files:**
- Create: `src/app/sheet/parts/Modal.tsx`
- Create: `src/app/sheet/HpNumpad.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement a reusable bottom-sheet `Modal`**

```tsx
// src/app/sheet/parts/Modal.tsx
export function Modal({ title, onClose, children }: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[110000] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-zinc-700 bg-zinc-900 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">{title}</span>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-zinc-400">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `HpNumpad`**

```tsx
// src/app/sheet/HpNumpad.tsx
import { useState } from "react";
import { Modal } from "./parts/Modal";
import { parseAmount } from "../../foundry/actor/hp";

export type HpMode = "damage" | "heal" | "set";

export function HpNumpad({ hp, onSubmit, onSetTemp, onClose }: {
  hp: { value: number; temp: number; max: number };
  onSubmit: (mode: HpMode, amount: number) => void;
  onSetTemp: (value: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<HpMode>("damage");
  const [raw, setRaw] = useState("");
  const [temp, setTemp] = useState(String(hp.temp));
  const amount = parseAmount(raw);
  const press = (d: string) => setRaw((r) => (r + d).slice(0, 4));
  const modes: HpMode[] = ["damage", "heal", "set"];

  return (
    <Modal title={`Hit Points — ${hp.value}/${hp.max}`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-3 gap-1">
        {modes.map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`min-h-11 rounded-md text-sm font-semibold capitalize ${mode === m ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>
            {m}
          </button>
        ))}
      </div>
      <div className="mb-2 text-center text-3xl font-bold tabular-nums">{raw || "0"}</div>
      <div className="grid grid-cols-3 gap-1">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="min-h-12 rounded-md bg-zinc-800 text-lg font-semibold">{d}</button>
        ))}
        <button onClick={() => setRaw("")} className="min-h-12 rounded-md bg-zinc-800 text-sm">Clr</button>
        <button onClick={() => press("0")} className="min-h-12 rounded-md bg-zinc-800 text-lg font-semibold">0</button>
        <button onClick={() => setRaw((r) => r.slice(0, -1))} aria-label="Backspace" className="min-h-12 rounded-md bg-zinc-800">
          <i className="fas fa-delete-left" aria-hidden="true" />
        </button>
      </div>
      <button onClick={() => { onSubmit(mode, amount); onClose(); }} disabled={amount === 0}
        className="mt-3 min-h-12 w-full rounded-md bg-emerald-600 font-semibold text-white disabled:opacity-40 capitalize">
        Apply {mode}
      </button>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-sm text-zinc-400">Temp HP</label>
        <input inputMode="numeric" value={temp} onChange={(e) => setTemp(e.target.value)}
          className="w-16 rounded-md bg-zinc-800 px-2 py-1 text-center" />
        <button onClick={() => onSetTemp(parseAmount(temp))} className="min-h-11 rounded-md bg-zinc-700 px-3 text-sm">Set</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Wire it into `CharacterSheet`**

Add to `CharacterSheet.tsx`: import `useState`; import `HpNumpad`, `setHp`, `setTempHp`, `applyDamageTo`, `hpAfterHeal`, `hpClamped`. Add state and handlers, pass `onHpTap`, and render the modal:

```tsx
// add imports
import { useState, useCallback } from "react";
import { HpNumpad, type HpMode } from "./HpNumpad";
import { setHeroPoints, adjustCondition, setHp, setTempHp, applyDamageTo } from "../../foundry/actor/mutations";
import { hpAfterHeal, hpClamped } from "../../foundry/actor/hp";

// inside the component, after `view` is defined:
const [hpOpen, setHpOpen] = useState(false);
const onHpSubmit = useCallback((mode: HpMode, amount: number) => {
  if (!view) return;
  if (mode === "damage") applyDamageTo(actorId, amount);
  else if (mode === "heal") setHp(actorId, hpAfterHeal(view.header.hp.value, view.header.hp.max, amount));
  else setHp(actorId, hpClamped(amount, view.header.hp.max));
}, [actorId, view]);

// pass to VitalsHeader:
onHpTap={() => setHpOpen(true)}

// render after the main flex column (inside the returned fragment / wrapper):
{hpOpen && view && (
  <HpNumpad hp={view.header.hp} onSubmit={onHpSubmit} onSetTemp={(n) => setTempHp(actorId, n)} onClose={() => setHpOpen(false)} />
)}
```
> Wrap the returned `<div className="flex h-full flex-col">…</div>` and the modal in a `<>…</>` fragment so both render. Keep the existing `setHeroPoints`/`adjustCondition` import (merge the import lines — do not duplicate).

- [ ] **Step 4: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/parts/Modal.tsx src/app/sheet/HpNumpad.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 17): HP numpad modal (damage/heal/set + temp)"
```

- [ ] **Step 5: Manual verify**
  1. Tap the HP bar → numpad opens. Enter a number, **Damage** → HP drops; with temp HP present, temp absorbs first; on a resistant actor, resistance reduces it (proves `applyDamage`).
  2. **Heal** clamps at max; **Set** sets the absolute value.
  3. Temp HP **Set** updates the `+N` indicator. GM sees all changes.

---

## Task 18: Conditions manager modal

One screen to add, adjust, and remove conditions — opened from the header `[+]` or any condition chip.

**Files:**
- Create: `src/app/sheet/ConditionsModal.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `ConditionsModal`**

```tsx
// src/app/sheet/ConditionsModal.tsx
import { Modal } from "./parts/Modal";
import type { ConditionView } from "../../foundry/actor/types";

/** Player-applicable PF2e conditions. `valued` ones support +/-. */
const CONDITIONS: { slug: string; label: string; valued: boolean }[] = [
  { slug: "blinded", label: "Blinded", valued: false },
  { slug: "clumsy", label: "Clumsy", valued: true },
  { slug: "concealed", label: "Concealed", valued: false },
  { slug: "confused", label: "Confused", valued: false },
  { slug: "controlled", label: "Controlled", valued: false },
  { slug: "dazzled", label: "Dazzled", valued: false },
  { slug: "deafened", label: "Deafened", valued: false },
  { slug: "doomed", label: "Doomed", valued: true },
  { slug: "drained", label: "Drained", valued: true },
  { slug: "encumbered", label: "Encumbered", valued: false },
  { slug: "enfeebled", label: "Enfeebled", valued: true },
  { slug: "fascinated", label: "Fascinated", valued: false },
  { slug: "fatigued", label: "Fatigued", valued: false },
  { slug: "fleeing", label: "Fleeing", valued: false },
  { slug: "frightened", label: "Frightened", valued: true },
  { slug: "grabbed", label: "Grabbed", valued: false },
  { slug: "immobilized", label: "Immobilized", valued: false },
  { slug: "invisible", label: "Invisible", valued: false },
  { slug: "off-guard", label: "Off-Guard", valued: false },
  { slug: "paralyzed", label: "Paralyzed", valued: false },
  { slug: "petrified", label: "Petrified", valued: false },
  { slug: "prone", label: "Prone", valued: false },
  { slug: "quickened", label: "Quickened", valued: false },
  { slug: "restrained", label: "Restrained", valued: false },
  { slug: "sickened", label: "Sickened", valued: true },
  { slug: "slowed", label: "Slowed", valued: true },
  { slug: "stunned", label: "Stunned", valued: true },
  { slug: "stupefied", label: "Stupefied", valued: true },
  { slug: "unconscious", label: "Unconscious", valued: false },
];

export function ConditionsModal({ active, onToggle, onAdjust, onClose }: {
  active: ConditionView[];
  onToggle: (slug: string) => void;
  onAdjust: (slug: string, delta: 1 | -1) => void;
  onClose: () => void;
}) {
  const bySlug = new Map(active.map((c) => [c.slug, c]));
  return (
    <Modal title="Conditions" onClose={onClose}>
      <div className="grid grid-cols-1 gap-1">
        {CONDITIONS.map((c) => {
          const on = bySlug.get(c.slug);
          return (
            <div key={c.slug} className={`flex items-center justify-between rounded-md px-3 py-2 ${on ? "bg-orange-900/40" : "bg-zinc-800"}`}>
              <button onClick={() => onToggle(c.slug)} className="flex-1 text-left text-sm font-medium">
                {c.label}{on?.value != null ? <span className="ml-1 text-orange-300">{on.value}</span> : null}
              </button>
              {on && c.valued && (
                <div className="flex items-center gap-2">
                  <button onClick={() => onAdjust(c.slug, -1)} aria-label={`Decrease ${c.label}`} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-minus text-xs" /></button>
                  <button onClick={() => onAdjust(c.slug, 1)} aria-label={`Increase ${c.label}`} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-plus text-xs" /></button>
                </div>
              )}
              {on && <button onClick={() => onToggle(c.slug)} aria-label={`Remove ${c.label}`} className="ml-2 flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-xmark text-xs" /></button>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
```
> The picker covers the common player-applicable conditions. `dying`/`wounded` are managed via the header pips (Task 16). If Task 1's probe shows a slug you use is spelled differently, fix it here.

- [ ] **Step 2: Wire into `CharacterSheet`**

Add `import { ConditionsModal } from "./ConditionsModal";` and `toggleCondition` is already imported. Add state + handlers, pass header callbacks, render the modal:

```tsx
const [condOpen, setCondOpen] = useState(false);

// pass to VitalsHeader:
onConditionAdd={() => setCondOpen(true)}
onConditionTap={() => setCondOpen(true)}

// render alongside the HP modal:
{condOpen && view && (
  <ConditionsModal
    active={view.conditions}
    onToggle={(slug) => toggleCondition(actorId, slug)}
    onAdjust={(slug, d) => adjustCondition(actorId, slug, d)}
    onClose={() => setCondOpen(false)}
  />
)}
```

- [ ] **Step 3: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/ConditionsModal.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 18): conditions manager modal"
```

- [ ] **Step 4: Manual verify**
  1. Header `[+]` opens the manager; tap a condition → it appears as a chip and on the GM's sheet.
  2. A valued condition (e.g. Frightened) shows +/- and updates its value live.
  3. Tapping the ✕ (or the active row) removes it. Dying/wounded pips still adjust from the header.

---

## Task 19: Vitals panel

**Files:**
- Create: `src/app/sheet/VitalsPanel.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `VitalsPanel`**

```tsx
// src/app/sheet/VitalsPanel.tsx
import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";
import { Chip } from "./parts/Chip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}
const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function VitalsPanel({ view, onInitiativeChange, onShieldHpAdjust, onManageConditions }: {
  view: CharacterView;
  onInitiativeChange: (statistic: string) => void;
  onShieldHpAdjust: (delta: 1 | -1) => void;
  onManageConditions: () => void;
}) {
  const d = view.defenses;
  return (
    <div className="divide-y divide-zinc-800">
      <Section title="Defenses">
        <StatRow label="Armor Class" value={d.ac} />
        {d.saves.map((s) => <StatRow key={s.slug} label={s.label} value={sign(s.mod)} right={<RankPip rank={s.rank} />} />)}
        <StatRow label="Perception" value={sign(d.perception.mod)} right={<RankPip rank={d.perception.rank} />} />
        {d.perception.senses.length > 0 && (
          <div className="px-1 pb-2 text-xs text-zinc-400">Senses: {d.perception.senses.map((x) => x.label).join(", ")}</div>
        )}
        <div className="flex min-h-11 items-center justify-between px-1 py-2">
          <span className="text-zinc-300">Initiative</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{sign(d.initiative.mod)}</span>
            <select
              value={d.initiative.statistic}
              onChange={(e) => onInitiativeChange(e.target.value)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-sm"
            >
              {d.initiative.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {d.shield && (
        <Section title="Shield">
          <StatRow label="Shield AC" value={sign(d.shield.ac)} right={d.shield.broken ? <span className="text-xs text-red-400">broken</span> : d.shield.raised ? <span className="text-xs text-emerald-400">raised</span> : null} />
          <div className="flex min-h-11 items-center justify-between px-1 py-2">
            <span className="text-zinc-300">Shield HP</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onShieldHpAdjust(-1)} aria-label="Shield HP -1" className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-minus text-xs" /></button>
              <span className="w-16 text-center font-semibold tabular-nums">{d.shield.hp.value} / {d.shield.hp.max}</span>
              <button onClick={() => onShieldHpAdjust(1)} aria-label="Shield HP +1" className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-plus text-xs" /></button>
            </div>
          </div>
          <StatRow label="Hardness" value={d.shield.hardness} />
        </Section>
      )}

      {d.speeds.length > 0 && (
        <Section title="Speed">{d.speeds.map((s) => <StatRow key={s.type} label={s.label} value={`${s.value} ft`} />)}</Section>
      )}

      {d.classDCs.length > 0 && (
        <Section title="Class DC">{d.classDCs.map((c) => <StatRow key={c.slug} label={c.label} value={c.value} right={c.primary ? <span className="text-[10px] text-zinc-500">primary</span> : null} />)}</Section>
      )}

      <Section title="Abilities">
        <div className="grid grid-cols-3 gap-2">
          {view.abilities.map((a) => (
            <div key={a.slug} className={`rounded-md bg-zinc-800 p-2 text-center ${a.key ? "ring-1 ring-indigo-500" : ""}`}>
              <div className="text-lg font-bold tabular-nums">{sign(a.mod)}</div>
              <div className="text-[10px] text-zinc-400">{a.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {(view.traits.immunities.length + view.traits.resistances.length + view.traits.weaknesses.length > 0) && (
        <Section title="Defenses & Traits">
          <div className="flex flex-wrap gap-1">
            {view.traits.resistances.map((x, i) => <Chip key={`r${i}`}>Resist {x.label}</Chip>)}
            {view.traits.weaknesses.map((x, i) => <Chip key={`w${i}`} tone="warn">Weak {x.label}</Chip>)}
            {view.traits.immunities.map((x, i) => <Chip key={`i${i}`}>Immune {x.label}</Chip>)}
          </div>
        </Section>
      )}

      <Section title="Conditions & Effects">
        <div className="mb-2 flex flex-wrap gap-1">
          {view.conditions.map((c) => <Chip key={c.slug} tone="warn">{c.name}{c.value != null ? ` ${c.value}` : ""}</Chip>)}
          {view.effects.map((e, i) => <Chip key={`e${i}`}>{e.name}{e.badge ? ` ${e.badge}` : ""}</Chip>)}
          {view.conditions.length === 0 && view.effects.length === 0 && <span className="text-xs text-zinc-500">None.</span>}
        </div>
        <button onClick={onManageConditions} className="min-h-11 rounded-md bg-zinc-800 px-3 text-sm font-medium text-indigo-300">Manage conditions</button>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `CharacterSheet`** (replace the vitals stub)

Add `import { VitalsPanel } from "./VitalsPanel";` and `setInitiativeStatistic, setShieldHp` to the mutations import and `hpClamped` is already imported. Replace the `subTab === "vitals"` line:

```tsx
{subTab === "vitals" && (
  <VitalsPanel
    view={view}
    onInitiativeChange={(stat) => setInitiativeStatistic(actorId, stat)}
    onShieldHpAdjust={(dlt) => view.defenses.shield && setShieldHp(actorId, hpClamped(view.defenses.shield.hp.value + dlt, view.defenses.shield.hp.max))}
    onManageConditions={() => setCondOpen(true)}
  />
)}
```

- [ ] **Step 3: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/VitalsPanel.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 19): vitals panel (defenses, initiative dropdown, abilities, traits)"
```

- [ ] **Step 4: Manual verify**
  1. Vitals shows AC, saves (with ranks), perception + senses, speeds, class DC, abilities, traits.
  2. The **Initiative** dropdown lists Perception + every skill; changing it updates the total and persists (GM sees `system.initiative.statistic`).
  3. With a shield equipped, Shield HP ± steppers change shield HP live.
  4. "Manage conditions" opens the modal.

---

## Task 20: Skills panel

**Files:**
- Create: `src/app/sheet/SkillsPanel.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `SkillsPanel`** (display-only; rolling is Phase 3)

```tsx
// src/app/sheet/SkillsPanel.tsx
import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function SkillsPanel({ view }: { view: CharacterView }) {
  return (
    <div className="divide-y divide-zinc-800 px-3">
      {view.skills.map((s) => (
        <StatRow
          key={s.slug}
          label={
            <span className="flex items-center gap-1">
              {s.label}
              {s.lore && <span className="text-[10px] uppercase text-zinc-500">lore</span>}
              {s.armor && <i className="fas fa-shield-halved text-[9px] text-zinc-600" title="armor check penalty" aria-hidden="true" />}
            </span>
          }
          value={sign(s.mod)}
          right={<RankPip rank={s.rank} />}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `CharacterSheet`** (replace the skills stub)

`import { SkillsPanel } from "./SkillsPanel";` then:
```tsx
{subTab === "skills" && <SkillsPanel view={view} />}
```

- [ ] **Step 3: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/SkillsPanel.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 20): skills panel"
```

- [ ] **Step 4: Manual verify**
  1. Skills tab lists every skill alphabetically with the correct modifier and rank letter; lore skills appear with a "lore" tag.
  2. Values match the desktop PF2e sheet for the same character.

---

## Task 21: Items panel + carry-type menu

**Files:**
- Create: `src/app/sheet/CarryTypeMenu.tsx`
- Create: `src/app/sheet/ItemsPanel.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `CarryTypeMenu`**

```tsx
// src/app/sheet/CarryTypeMenu.tsx
import { Modal } from "./parts/Modal";

const CHOICES: { key: string; label: string; carryType: string; handsHeld: number }[] = [
  { key: "worn", label: "Worn", carryType: "worn", handsHeld: 0 },
  { key: "held1", label: "Held (1 hand)", carryType: "held", handsHeld: 1 },
  { key: "held2", label: "Held (2 hands)", carryType: "held", handsHeld: 2 },
  { key: "stowed", label: "Stowed", carryType: "stowed", handsHeld: 0 },
  { key: "dropped", label: "Dropped", carryType: "dropped", handsHeld: 0 },
];

export function CarryTypeMenu({ itemName, onSelect, onClose }: {
  itemName: string;
  onSelect: (carryType: string, handsHeld: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Carry — ${itemName}`} onClose={onClose}>
      <div className="grid gap-1">
        {CHOICES.map((c) => (
          <button key={c.key} onClick={() => { onSelect(c.carryType, c.handsHeld); onClose(); }}
            className="min-h-12 rounded-md bg-zinc-800 px-3 text-left text-sm font-medium">
            {c.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Implement `ItemsPanel`**

```tsx
// src/app/sheet/ItemsPanel.tsx
import type { CharacterView, InventoryItemView } from "../../foundry/actor/types";

function ItemRow({ item, onEquipTap, onInvestToggle }: {
  item: InventoryItemView;
  onEquipTap: (id: string) => void;
  onInvestToggle: (id: string, next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {item.img && <img src={item.img} alt="" className="h-8 w-8 rounded object-cover" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {item.name}{item.quantity > 1 ? <span className="text-zinc-400"> ×{item.quantity}</span> : null}
          {item.isContainer ? <i className="fas fa-box-archive ml-1 text-[10px] text-zinc-500" aria-hidden="true" /> : null}
        </div>
        <div className="text-[11px] text-zinc-500">Bulk {item.bulkLabel} · {item.priceLabel}</div>
      </div>
      {item.invested !== null && (
        <button onClick={() => onInvestToggle(item.id, !item.invested)}
          aria-label="Toggle invested"
          className={`min-h-9 rounded px-2 text-xs font-semibold ${item.invested ? "bg-amber-700 text-amber-100" : "bg-zinc-800 text-zinc-400"}`}>
          {item.invested ? "Invested" : "Invest"}
        </button>
      )}
      <button onClick={() => onEquipTap(item.id)}
        className={`min-h-9 rounded px-2 text-xs font-semibold ${item.equipped ? "bg-emerald-800 text-emerald-100" : "bg-zinc-800 text-zinc-300"}`}>
        {item.carryType}{item.carryType === "held" && item.handsHeld ? ` ${item.handsHeld}h` : ""}
      </button>
    </div>
  );
}

export function ItemsPanel({ view, onEquipTap, onInvestToggle }: {
  view: CharacterView;
  onEquipTap: (id: string) => void;
  onInvestToggle: (id: string, next: boolean) => void;
}) {
  const inv = view.inventory;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-sm">
        <span className="text-zinc-400">Coins</span>
        <span className="font-semibold tabular-nums">{inv.currency.pp}pp {inv.currency.gp}gp {inv.currency.sp}sp {inv.currency.cp}cp</span>
      </div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-sm">
        <span className="text-zinc-400">Bulk</span>
        <span className={`font-semibold ${inv.encumbered ? "text-orange-300" : ""}`}>{inv.bulkLabel}{inv.encumbered ? " · encumbered" : ""}</span>
      </div>
      {inv.categories.map((cat) => (
        <section key={cat.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{cat.label}</h3>
          <div className="divide-y divide-zinc-800">
            {cat.items.map((it) => <ItemRow key={it.id} item={it} onEquipTap={onEquipTap} onInvestToggle={onInvestToggle} />)}
          </div>
        </section>
      ))}
      {inv.categories.length === 0 && <div className="p-4 text-sm text-zinc-500">No items.</div>}
    </div>
  );
}
```

> **Container nesting (v1 scope):** the spec's "expand/collapse nested containers" is simplified for v1 — containers are flagged with an icon and their contents listed flat within each category (the mapper already carries `containerId` for a later nesting pass). Call this out so it isn't mistaken for a regression.

- [ ] **Step 3: Wire into `CharacterSheet`** (replace the items stub + add the menu)

Add imports `import { ItemsPanel } from "./ItemsPanel";`, `import { CarryTypeMenu } from "./CarryTypeMenu";`, and add `setEquipped, setInvested` to the mutations import. Add state and render. **Put `useState` above the `if (!view)` guard; the derived `equipItem` (it reads `view`) goes below the guard:**

```tsx
const [equipItemId, setEquipItemId] = useState<string | null>(null);
const equipItem = equipItemId
  ? view.inventory.categories.flatMap((c) => c.items).find((i) => i.id === equipItemId) ?? null
  : null;

// replace the items stub:
{subTab === "items" && (
  <ItemsPanel
    view={view}
    onEquipTap={(id) => setEquipItemId(id)}
    onInvestToggle={(id, next) => setInvested(actorId, id, next)}
  />
)}

// render alongside the other modals:
{equipItem && (
  <CarryTypeMenu
    itemName={equipItem.name}
    onSelect={(carryType, hands) => setEquipped(actorId, equipItem.id, carryType, hands)}
    onClose={() => setEquipItemId(null)}
  />
)}
```

- [ ] **Step 4: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/ItemsPanel.tsx src/app/sheet/CarryTypeMenu.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 21): items panel + carry-type menu (equip/invest)"
```

- [ ] **Step 5: Manual verify**
  1. Items tab groups by category with bulk/price; coins and total bulk show; encumbered flags when over limit.
  2. Tapping the carry-type button opens the menu; choosing Held (1/2h)/Worn/Stowed updates the item and the desktop sheet.
  3. Invest toggles on investable items; non-investable items show no invest button.

---

## Task 22: Feats & features panel

**Files:**
- Create: `src/app/sheet/FeatsPanel.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `FeatsPanel`** (read-only)

```tsx
// src/app/sheet/FeatsPanel.tsx
import type { CharacterView } from "../../foundry/actor/types";
import { ActionGlyph } from "./parts/ActionGlyph";

export function FeatsPanel({ view }: { view: CharacterView }) {
  if (view.featGroups.length === 0) return <div className="p-4 text-sm text-zinc-500">No feats or features.</div>;
  return (
    <div>
      {view.featGroups.map((g) => (
        <section key={g.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{g.label}</h3>
          <div className="divide-y divide-zinc-800">
            {g.feats.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2">
                {f.img && <img src={f.img} alt="" className="h-7 w-7 rounded object-cover" />}
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span className="text-[10px] text-zinc-500">Lv {f.level}</span>
                <ActionGlyph code={f.actionGlyph} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `CharacterSheet`** (replace the feats stub)

`import { FeatsPanel } from "./FeatsPanel";` then:
```tsx
{subTab === "feats" && <FeatsPanel view={view} />}
```

- [ ] **Step 3: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/FeatsPanel.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 22): feats & features panel"
```

- [ ] **Step 4: Manual verify**
  1. Feats tab groups Ancestry / Class / Class Features / General / Skill feats, sorted by level, with action glyphs where applicable.
  2. Grouping matches the desktop sheet's feat categories.

---

## Task 23: Bio panel

**Files:**
- Create: `src/app/sheet/BioPanel.tsx`
- Modify: `src/app/sheet/CharacterSheet.tsx`

- [ ] **Step 1: Implement `BioPanel`** (read-only)

```tsx
// src/app/sheet/BioPanel.tsx
import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

export function BioPanel({ view }: { view: CharacterView }) {
  const b = view.bio;
  const lineage: [string, string | undefined][] = [
    ["Ancestry", b.ancestry], ["Heritage", b.heritage], ["Background", b.background],
    ["Class", b.className], ["Deity", b.deity], ["Size", b.size],
  ];
  return (
    <div className="divide-y divide-zinc-800">
      <Section title="Character">
        {lineage.filter(([, v]) => v).map(([k, v]) => <StatRow key={k} label={k} value={v} />)}
      </Section>
      {b.languages.length > 0 && (
        <Section title="Languages"><div className="text-sm text-zinc-300">{b.languages.join(", ")}</div></Section>
      )}
      {(b.attacks.length > 0 || b.defenses.length > 0) && (
        <Section title="Proficiencies">
          {b.attacks.map((p, i) => <StatRow key={`a${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
          {b.defenses.map((p, i) => <StatRow key={`d${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
        </Section>
      )}
      {b.appearance && (
        <Section title="Appearance"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.appearance }} /></Section>
      )}
      {b.backstory && (
        <Section title="Backstory"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.backstory }} /></Section>
      )}
    </div>
  );
}
```
> Biography text is authored HTML from the GM/player on desktop; render it directly (read-only). Full `@UUID`/inline-roll enrichment is a Phase 6 concern.

- [ ] **Step 2: Wire into `CharacterSheet`** (replace the bio stub)

`import { BioPanel } from "./BioPanel";` then:
```tsx
{subTab === "bio" && <BioPanel view={view} />}
```
> After this task the `PanelStub` helper in `CharacterSheet.tsx` is unused — delete it.

- [ ] **Step 3: Typecheck, build, commit**

Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS.
```bash
git add src/app/sheet/BioPanel.tsx src/app/sheet/CharacterSheet.tsx
git commit -m "Phase 2 (Task 23): bio panel"
```

- [ ] **Step 4: Manual verify**
  1. Bio tab shows ancestry/heritage/background/class/deity/size, languages, martial proficiencies (with ranks), and any appearance/backstory text.

---

## Task 24: Final integration, verification & phase close-out

**Files:**
- Modify: `pf2e-mobile-companion-plan.md`
- Modify: `docs/superpowers/specs/2026-06-11-phase-2-character-sheet-design.md` (status note)

- [ ] **Step 1: Green gates**

Run: `npm run test` — Expected: PASS (all `characterView.*`, `hpMath`, `store` suites + Phase 1).
Run: `npm run typecheck` — Expected: PASS.
Run: `npm run build` — Expected: PASS (emits `dist/module.js` + `dist/style.css`).

- [ ] **Step 2: Full manual verification** (live GM-on-desktop + player-on-mobile/emulated, per the spec)

Confirm each, fixing regressions before proceeding:
  1. **Live mirror:** GM changes HP on desktop → phone updates within ~1s. Same for conditions, hero points, AC-affecting changes.
  2. **HP numpad:** Damage respects temp HP and resistances (use a resistant test actor); Heal clamps at max; Set is absolute; temp HP sets.
  3. **Conditions:** add via picker, remove, adjust a valued condition; dying & wounded pips from the header.
  4. **Initiative dropdown:** lists Perception + every skill; selection persists and updates the total.
  5. **Equip/invest:** carry-type menu changes equip state; invest toggles on investable items.
  6. **Sub-tabs:** Vitals/Skills/Items/Feats/Bio all render correct, complete data matching the desktop sheet; sticky header stays while panels scroll; sub-tab bar scrolls horizontally.
  7. **Graceful absence:** a character with no shield / no resistances / no feats / no conditions renders cleanly (no empty headers).
  8. **Resolution & teardown:** picker→select works; switch-character button (multi-actor owners) returns to the picker; deleting the actor on desktop returns the phone to the picker/empty state.
  9. **Desktop GM unaffected** throughout; no `canvas.*` console errors.

- [ ] **Step 3: Mark Phase 2 complete in the project plan**

In `pf2e-mobile-companion-plan.md`, change the Phase 2 header to `## Phase 2 — Character sheet (read + live) ✅ Done (2026-06-11)`, add a spec/plan reference line beneath it mirroring Phase 1's style, and check every Phase 2 `- [ ]` box to `- [x]`. Add a one-line note that rolling is deferred to Phase 3 and build-edits are out of scope (as designed).

- [ ] **Step 4: Note spec status**

In the spec file, under the header, append `**Implemented:** 2026-06-11 — see plan \`docs/superpowers/plans/2026-06-11-phase-2-character-sheet.md\`.`

- [ ] **Step 5: Commit**

```bash
git add pf2e-mobile-companion-plan.md docs/superpowers/specs/2026-06-11-phase-2-character-sheet-design.md
git commit -m "Phase 2: comprehensive live character sheet complete"
```

- [ ] **Step 6: Finish the branch** — invoke `superpowers:finishing-a-development-branch` to choose how to integrate (merge to `main` / PR / keep), matching how Phase 1 was landed.

---

## Appendix: Task dependency & file map

**Pure logic (TDD, Tasks 2–14)** → `src/foundry/actor/{types,view,hp,mutations}.ts`, `src/app/{store,useActor}.ts`, `tests/*`.
**Components (typecheck/build + manual, Tasks 15–23)** → `src/app/sheet/**`.
**Integration (Task 24)** → docs.

Critical path: 2 (types) → 3–10 (mappers) → 11 (hp) → 12 (mutations) → 13 (store) → 14 (useActor) → 15 (parts) → 16 (shell) → 17–18 (modals) → 19–23 (panels) → 24 (close-out). Tasks 3–10 are independent of each other once Task 2 lands; Tasks 19–23 are independent of each other once Task 16 lands.

**Live-API risk (isolated to the cast in `useActor`/`mutations`):** the structural `CharacterLike` is validated by Task 1's console probe and the Task 16/24 manual checks. If a path differs, fix it in the one mapper that reads it (tests stay green because they assert the contract, not the live shape).

