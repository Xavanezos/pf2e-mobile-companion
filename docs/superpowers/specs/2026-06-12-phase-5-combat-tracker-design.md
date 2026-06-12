# Phase 5 — Initiative & combat tracker — Design

**Status:** Specced and approved in brainstorming (2026-06-12); ready for an implementation plan. A single phase, built in four commit-per-task slices. Live-API paths are grounded against the cloned PF2e checkout (`E:/React Projects/pf2e/src/module/encounter/*`, `src/module/actor/initiative.ts`) and its vendored Foundry types; confirm in play (see **Live-API assumptions**).

The bottom **Combat** tab (today a bare `Placeholder`, "Combat Tracker — coming in Phase 5") becomes a live, player-facing initiative tracker that mirrors exactly what Foundry's stock encounter tracker shows a *player*: the initiative order (portraits, names, initiative values), whose turn it is, and the round number. It adds the two player-facing actions — **roll initiative** and **end my turn** — and **buzzes** the phone (`navigator.vibrate`) when the active character's turn begins. As everywhere else in the app, Foundry owns the data and permissions; we only render the live `game.combat` and dispatch through the system API.

**Why a custom renderer (not the stock tracker HTML):** the stock `CombatTracker` markup is desktop-oriented, fights our CSS takeover, and isn't touch-friendly. We render a custom mobile list from the live Documents — the same decision we made for the sheet, strikes, and toggles. (Chat cards stay real HTML because the system *writes* them; the tracker is ours to draw.)

**Out of scope (YAGNI / deferred):**

- **GM controls** — add/remove combatants, manual `setInitiative`, next/previous round, roll-all/roll-NPC, tie-break reordering, toggling defeated or name-visibility. The mobile app is player-facing; the GM drives encounter flow from desktop.
- **Tap-a-combatant detail card** (name/HP popup) — deferred to Phase 7's token tap, which covers the same need from the map.
- **Vibration on/off setting** — the buzz is unconditional (feature-detected) for now; Phase 8 adds the setting alongside default-tab and font-size.
- **Unlinked-token actors** — combatants whose `actor` is a synthetic token-actor (PCs use linked tokens). "Is this mine?" keys off the linked actor id; unlinked NPC tokens are never "mine" anyway.
- **Templates / measurement** — Phase 7 territory at the earliest; explicitly out for v1.

---

## Decisions (approved)

1. **Custom mobile list over `game.combat`**, mirroring the player's view of the stock tracker — not the stock HTML.
2. **Turn alert = vibrate + in-list highlight only.** When the active character's turn begins, `navigator.vibrate(...)` buzzes the phone from any tab; the current combatant's row glows with a ▶ marker on the Combat tab. **No cross-tab banner/toast.**
3. **Row content = portrait, name, initiative, HP bar.** The HP bar shows **only where the player may see it** (own/party actors always; NPC HP hidden from players — mirrors PF2e's resource-visibility). Defeated rows are dimmed + struck; hidden combatants are omitted for players.
4. **Player-only controls.** A **Roll Initiative** button when the character is in the encounter but hasn't rolled; an **End My Turn** button enabled only when it is actually the character's turn. GM-only round/turn navigation is out of scope.
5. **Read-only mirror + guarded dispatch.** The tab reflects the live encounter and re-preps on combat hooks; the only writes are `rollInitiative` / `nextTurn`, both guarded (failure → Foundry toast), both permission-enforced by Foundry server-side.
6. **`game.combat`, never `canvas`.** With `core.noCanvas` on, canvas globals are absent; `game.combat` / `game.combats` are game-level and present regardless, and combat hooks fire on every client independent of canvas.

---

## Architecture & data flow

Follows the established pattern exactly (pure sync mapper → version-bumped hook → guarded actions → thin UI), the same shape as `useToggles`/`toggles.ts` and `useHotbar`/`hotbar.ts`.

```
Combat tab  (CombatTab: header [round + your-turn pill] + order list + footer [Roll Init / End Turn])
   │
   ├─ useEncounter(actorId) → buildEncounterView(game.combat, ctx)      [pure, SYNC]
   │      reads game.combat.turns  (CombatantPF2e[], initiative-sorted)
   │      ctx = { isGM: game.user.isGM, characterActorId: actorId }
   │      per combatant:
   │        • hidden && !isGM            → omit            (player can't see it)
   │        • name = canSeeName ? name : "Unknown"
   │        • img  = token.texture.src ?? actor.img ?? combatant.img
   │        • hp   = (isGM || actor.hasPlayerOwner) ? {value,max} : null
   │        • isCurrent = id === combat.combatant?.id ;  isMine = actor.id === actorId
   │      → EncounterView { round, started, combatants[], myCombatantId, canRollInitiative, isMyTurn }
   │      re-preps on  updateCombat / createCombat / deleteCombat
   │                   / createCombatant / updateCombatant / deleteCombatant
   │      → null when there is no active encounter (empty state)
   │
   ├─ tap "Roll Initiative"  → src/foundry/combat/actions.ts  rollInitiative(combatantId)   [guarded]
   │        game.combat.rollInitiative([combatantId])
   │            → PF2e rolls the actor's chosen init statistic, updates the tracker,
   │              posts a check card → existing chat feed
   │
   └─ tap "End My Turn"      → endTurn(actorId)   [guarded]
            if game.combat.combatant?.actor?.id === actorId → game.combat.nextTurn()
            (permission-enforced by Foundry; rejection → toast)            ⚠ highest-risk live path

Shell  (always-on, beside useChatFeed / ChatToast)
   └─ useTurnAlert(actorId)
        on updateCombat: ref-diff current combatant id;
        when it transitions TO the active character → navigator.vibrate(...)   (feature-detected)
```

- **The mapper is synchronous.** `game.combat.turns` is an in-memory ordered array — no async prep. The hook mirrors `useToggles`/`useHotbar`: a `useMemo` invalidated by a version bump, **not** the async `useSpells`.
- **Never hold live objects in React state.** The mapper keeps only ids + display fields; the actions re-read the live `Encounter`/`Combatant` by id at tap time — same discipline as strikes/toggles/macros.
- **Two independent subscriptions, by design.** `useEncounter` lives only while the Combat tab is mounted (renders the list). `useTurnAlert` lives in `Shell`, always mounted, so the buzz fires regardless of which tab is open. Combat hooks are low-frequency, so the duplicate registration is free.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/combat/types.ts` | `EncounterView`, `CombatantView`, structural source types `EncounterLike`/`CombatantLike`, context `EncounterViewContext` |
| `src/foundry/combat/view.ts` | pure `buildEncounterView(encounter, ctx)` — visibility filter, name blanking, image fallback, HP gating, current/mine flags, roll-init/your-turn derivation |
| `src/foundry/combat/actions.ts` | guarded `rollInitiative(combatantId)` and `endTurn(actorId)` (re-read live `game.combat`, dispatch, try/catch → toast) |
| `src/app/combat/useEncounter.ts` | sync refresh hook: `useMemo` over `(version)`, bumped on the six combat hooks; returns `EncounterView \| null` |
| `src/app/combat/useTurnAlert.ts` | always-on buzz hook (mounted in Shell): ref-diffs current combatant on `updateCombat`, `navigator.vibrate` on transition into the player's turn |
| `src/app/combat/CombatTab.tsx` | the tab: empty state / round header + your-turn pill / order list / footer controls; owns the `rollInitiative` + `endTurn` wiring |
| `src/app/combat/CombatantRow.tsx` | presentational row: portrait + name + initiative + HP bar; current-turn ring/▶, "You" tag, defeated styling |

**Edits**

- `src/app/TabContent.tsx` — route `"combat"` → `<CombatTab />` (replacing the inline `<Placeholder title="Combat Tracker" … />`).
- `src/app/Shell.tsx` — call `useTurnAlert(actorId)` beside `useChatFeed()` (always-on subscription).

No change to `store.ts` (`"combat"` is already a `TabId`), no new chat infrastructure (the init check card flows through the Slice-1 feed), no actor/document mutations beyond the two guarded combat dispatches.

### Types (`src/foundry/combat/types.ts`)

```ts
export interface CombatantView {
  id: string;
  name: string;                       // "Unknown" when the player may not see the real name
  img: string | null;
  initiative: number | null;          // null = not yet rolled → renders "–"
  isCurrent: boolean;                 // this is game.combat.combatant
  isMine: boolean;                    // belongs to the active character
  defeated: boolean;
  hp: { value: number; max: number } | null;   // null when not visible to the viewer
}

export interface EncounterView {
  round: number;
  started: boolean;
  combatants: CombatantView[];        // turn order (already initiative-sorted by PF2e)
  myCombatantId: string | null;       // the active character's combatant, if present
  canRollInitiative: boolean;         // mine exists && initiative == null
  isMyTurn: boolean;                  // current combatant is the active character
}

export interface EncounterViewContext {
  isGM: boolean;
  characterActorId: string | null;
}

// ---- Source documents, structurally (only the fields the mapper reads) ----
export interface CombatantLike {
  id: string;
  name: string;
  initiative: number | null;
  hidden: boolean;
  defeated?: boolean;
  playersCanSeeName?: boolean;        // PF2e getter on the live combatant
  img?: string | null;               // Foundry Combatant#img fallback
  token?: { texture?: { src?: string | null } } | null;
  actor?: {
    id: string;
    img?: string | null;
    hasPlayerOwner?: boolean;
    system?: { attributes?: { hp?: { value?: number; max?: number } } };
  } | null;
}
export interface EncounterLike {
  round: number;
  started: boolean;
  combatant?: { id?: string } | null; // the current-turn combatant
  turns: CombatantLike[];             // ordered turn list
}
```

### `buildEncounterView(encounter, ctx)` — pure, sync

```ts
export function buildEncounterView(encounter: EncounterLike, ctx: EncounterViewContext): EncounterView {
  const currentId = encounter.combatant?.id ?? null;
  const combatants: CombatantView[] = [];
  let myCombatantId: string | null = null;

  for (const c of encounter.turns ?? []) {
    if (c.hidden && !ctx.isGM) continue;                 // players don't see GM-hidden combatants

    const canSeeName = ctx.isGM || c.playersCanSeeName !== false;
    const isMine = !!c.actor && c.actor.id === ctx.characterActorId;
    const canSeeHp = ctx.isGM || c.actor?.hasPlayerOwner === true;
    const hpRaw = c.actor?.system?.attributes?.hp;
    const hp = canSeeHp && hpRaw && typeof hpRaw.value === "number" && typeof hpRaw.max === "number"
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

### `rollInitiative` / `endTurn` — guarded (like `setToggle` / `executeMacro`)

```ts
export function rollInitiative(combatantId: string): Promise<void> {
  return guard(async () => {
    const combat = (game as any)?.combat;
    if (!combat?.rollInitiative) throw new Error("no active encounter");
    await combat.rollInitiative([combatantId]);          // PF2e rolls the actor's chosen init statistic + updates tracker
  });
}

export function endTurn(actorId: string | null): Promise<void> {
  return guard(async () => {
    const combat = (game as any)?.combat;
    if (!combat?.nextTurn) throw new Error("no active encounter");
    if (combat.combatant?.actor?.id !== actorId) return;  // only end YOUR turn
    await combat.nextTurn();                               // Foundry permission-checks server-side
  });
}
```

(`guard` = the shared try/catch → `console.error` + `ui.notifications.error("… — see console.")`, identical to `rolls.ts`/`hotbar.ts`.)

### `useEncounter(actorId)` — hook

`useMemo(() => game.combat ? buildEncounterView(game.combat, { isGM: game.user.isGM, characterActorId: actorId }) : null, [version, actorId])`, with `useFoundryHook` registrations that `bump()` on **`updateCombat`** (round/turn/start), **`createCombat`** / **`deleteCombat`** (encounter activated/ended → re-read `game.combat`), and **`createCombatant`** / **`updateCombatant`** / **`deleteCombatant`** (roster + initiative changes). Returns `null` when there is no active encounter → the empty state.

### `useTurnAlert(actorId)` — always-on buzz (Shell)

A `useRef` holds the last-seen current-combatant id. On **`updateCombat`**, read `game.combat?.combatant`; if its id changed **and** the new current combatant's `actor.id === actorId`, call `navigator.vibrate?.(VIBRATE_PATTERN)` (feature-detected — absent on desktop Chrome / iOS, so the call no-ops). Update the ref every time so we only buzz on the *transition into* your turn, not on every combat update during your turn. No render, no state — a pure side-effect hook.

### `CombatTab` + `CombatantRow` — UI

- **`CombatTab`**: `useEncounter(actorId)`.
  - `null` → centered "No active encounter."
  - Header: **"Round N"** (or **"Not started"** when `!started`) + a small **"Your turn"** pill when `isMyTurn`.
  - List: a `CombatantRow` per `combatants` entry, in order.
  - Footer (sticky at the bottom of the tab): **Roll Initiative** button shown when `canRollInitiative` → `rollInitiative(myCombatantId)`; **End My Turn** button shown always but `disabled` unless `isMyTurn` → `endTurn(actorId)`.
- **`CombatantRow`**: a flex row — portrait (`<img>`, ~40px, rounded), name, initiative value (large, tabular-nums; "–" when null), and the HP bar when `hp != null` (a track `<div>` with an inner `<div>` at `width: value/max%`, color by ratio). The current-turn row gets a `ring-2 ring-indigo-400` + a ▶ glyph; `isMine` adds a subtle "You" tag; `defeated` dims the row (`opacity-50`) and line-throughs the name. Follows the Tailwind-v4 button gotchas — **solid `bg`/`ring` fills, never `border`, and `justify-start` on any flex `<button>`** (see [[styling-gotchas]]); the row itself is a non-interactive `<div>` for v1 (tap-for-detail is Phase 7).

---

## Live-API assumptions (verify in play; correct any path on return)

Grounded against the cloned PF2e source and its vendored Foundry types:

1. **`game.combat`** is the active `EncounterPF2e | null`; **`game.combats.active`** is the same encounter (`src/module/actor/.../document.ts` use `game.combats.active`). Present with `core.noCanvas` on (game-level, not canvas-level).
2. **`encounter.turns`** is the initiative-ordered `CombatantPF2e[]`; **`encounter.combatant`** is the current-turn combatant; **`encounter.round`** / **`encounter.started`** are the round number and started flag (`EncounterPF2e extends Combat`, `src/module/encounter/document.ts`).
3. **`combatant.playersCanSeeName`** (PF2e getter, `src/module/encounter/combatant.ts:104-106`) is `true` when the token's `displayName` is ALWAYS/HOVER **or** the actor's alliance is "party". We blank the name to "Unknown" when it's `false` and the viewer isn't GM. **`combatant.hidden`** (GM "hide") omits the row for players.
4. **`combatant.initiative`** is `number | null` (null = unrolled → "–"); **`combatant.defeated`** is the defeated flag; **`combatant.actor`** / **`combatant.token`** resolve the actor/token (with PF2e's `tokens.at(0)` fallback). Portrait: `token.texture.src` (Foundry v10+ TokenDocument) → `actor.img` → `combatant.img`.
5. **`combatant.actor.hasPlayerOwner`** gates HP visibility (true for any PC — your own and party). HP value/max read from `actor.system.attributes.hp` (the same path `mapHeader` uses on the sheet). NPC HP stays `null` for players.
6. **`encounter.rollInitiative([id], options?)`** (`document.ts:140-179`) rolls the combatant's actor initiative via the actor's chosen statistic (`actor.system.initiative.statistic`, perception or a skill) and batch-updates the tracker — exactly what the stock tracker's roll button calls. A player may roll for a combatant they own.
7. **`encounter.nextTurn()`** is inherited from Foundry's `Combat` and **not** overridden by PF2e. ⚠️ **Permission risk:** whether a non-GM may advance their own turn depends on the world's combat-permission configuration; by default the Combat document is GM-owned. `endTurn` attempts it and surfaces a toast on rejection. **This is the highest-risk live item — test with a real player on their turn** (cf. the Phase 4 attack-toggle).
8. **Hooks:** `updateCombat`, `createCombat`, `deleteCombat`, `createCombatant`, `updateCombatant`, `deleteCombatant` are standard Foundry document hooks, fired on all clients regardless of canvas. PF2e also fires `pf2e.startTurn` / `pf2e.endTurn` `(combatant, encounter, userId)` — we rely on the core `updateCombat` for both render and buzz rather than the PF2e-specific pair (simpler, version-robust).

---

## Testing

- **TDD the pure mapper** (`tests/encounterView.test.ts`, Vitest, `hotbarView.test.ts` style — structural fixtures, no globals). Cases:
  - **Order preserved** from `turns` (mapper does not re-sort).
  - **Hidden combatant** omitted when `isGM:false`; **kept** when `isGM:true`.
  - **Name blanking** — `playersCanSeeName:false` → "Unknown" for a player; real name for GM and for `playersCanSeeName:true`.
  - **Image fallback** chain — `token.texture.src` wins; falls back to `actor.img`, then `combatant.img`, then `null`.
  - **HP visibility** — `hasPlayerOwner:true` (and/or GM) → `{value,max}`; NPC (`hasPlayerOwner:false`, player viewer) → `null`; missing hp shape → `null`.
  - **Flags** — `isCurrent` matches `encounter.combatant.id`; `isMine` matches `characterActorId`; `isMyTurn` true only when my combatant is current; `canRollInitiative` true only when my combatant exists and `initiative == null` (and false once rolled / when I'm not in the encounter).
  - **Empty `turns`** → empty `combatants`, `myCombatantId:null`, both derived flags false.
- **Guarded actions, the hooks, and the UI** are thin glue over live objects — covered by `npm run typecheck` + `npm run build` (test the **production** build, not only `npm run dev` — see [[phase-3-progress]]) and a manual live checklist (GM on desktop + **Player1** at mobile width, an encounter with the player's character + at least one NPC and one GM-hidden combatant):
  - Order, portraits, names, and initiative values match the desktop tracker; the GM-hidden combatant does **not** appear for the player; an un-renamed NPC shows "Unknown" if the world hides NPC names.
  - HP bars show for the player's own character and party members; NPC rows show no HP bar.
  - The current-turn row is ringed with a ▶; advancing the turn on desktop moves the highlight on the phone within ~1s; the round number updates on round change.
  - **Buzz:** when the GM advances to the player's turn, the phone vibrates (Android Chrome) from whatever tab is open; it does **not** re-buzz on other combat updates during the same turn.
  - **Roll Initiative:** shown when the character hasn't rolled; tapping it rolls the character's initiative (chosen statistic), posts the check card to Chat, and the button disappears as the value populates.
  - **End My Turn:** ⚠️ enabled only on the player's turn; tapping advances the encounter **if** the world permits player turn control, otherwise a toast appears (record which, to inform whether we keep/hide the button).
  - **Empty state:** no active encounter → "No active encounter."; deleting/ending the encounter on desktop returns the tab to the empty state.

---

## Execution

Per [[execution-workflow]]: inline batched execution, **commit per task directly to `main`**, messages `Phase 5 (Task M): …` with the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer. Four tasks:

1. **Types + pure mapper** `buildEncounterView` (TDD: write `tests/encounterView.test.ts`, then `view.ts`/`types.ts`).
2. **Hook + UI + route** — `useEncounter`, `CombatTab`, `CombatantRow`, route `"combat"` in `TabContent`. *Render-only* — **live-look checkpoint** (log in as Player1, mobile width, with an active encounter).
3. **Guarded actions** — `rollInitiative` / `endTurn` wired to the footer buttons.
4. **Buzz** — `useTurnAlert` in Shell.

Typecheck + prod build + tests green at each task; live-Foundry checkpoints after Task 2 and at the end (the `nextTurn` permission path and the vibrate are the two items that can only be confirmed in play).
