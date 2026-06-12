# Map Token Conditions & Effects — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Context:** Phase 7 battle map ([[phase-7-progress]]). Surfaces a token's active
conditions and effects on the Map tab.

## Goal

Let a player see, at a glance, the conditions and effects on a token on the battle map —
the same information the character sheet already shows for the active character
(`VitalsPanel` → `Chip`/`EffectChip`), but now for **every visible token** on the map. Two
surfaces: small status icons on the token sprite itself, and a labeled list in the
tap-for-info popup.

## Decisions (from brainstorming)

- **Surfaces:** **both** — status icons on the token sprite *and* a labeled
  Conditions/Effects list in the existing `TokenInfoPopup`. The data plumbing is shared, so
  the marginal cost of the second surface is small.
- **Visibility:** **all visible tokens** — players see conditions/effects on allies *and*
  enemies, mirroring Foundry's native token icons and normal tabletop play. (GM-hidden and
  PF2e-secret tokens are already omitted entirely for players upstream, so this only affects
  tokens the player can already see.) No HP-style owner gating.
- **Sprite detail:** value badge on valued conditions (e.g. "Frightened 2"); icon row
  **capped at 4**, then a "+N" pill; conditions rendered before effects.
- **Popup:** **read-only** chips — no long-press-to-remove (removal is a character-sheet
  action, and a player can't edit an enemy's conditions).
- **Unidentified effects:** an effect flagged unidentified is shown with a neutral "Effect"
  label to viewers who are neither GM nor the actor's owner, so its real name isn't leaked.
  Conditions have no unidentified concept and are always shown by name.

## Architecture

Follows the established Phase 7 / project pattern: a **pure, unit-tested mapper**
(`foundry/scene/view.ts`) owns all data prep and visibility rules; the React renderer owns
none. No PIXI canvas. Reuses the existing display types and components from the character
sheet so conditions/effects look and read the same everywhere.

### 1. Types — `src/foundry/scene/types.ts`

Reuse the existing display types from `actor/types` rather than defining parallel ones:

```ts
import type { ConditionView, EffectView } from "../actor/types";
```

Extend the source shape `TokenLike.actor` with the two collections the mapper will read
(both optional — an actor may be absent or expose neither):

```ts
actor?: {
  id: string;
  hasPlayerOwner?: boolean;
  isOwner?: boolean;                 // viewer owns this actor (for unidentified-effect rule)
  system?: { attributes?: { hp?: { value?: number; max?: number } } };
  conditions?: { active: ConditionLike[] };
  itemTypes?: { effect: EffectLike[] };
} | null;
```

Add to the output `TokenView`:

```ts
conditions: ConditionView[];   // { slug, name, value, img?, locked }
effects: EffectView[];         // { id?, name, img?, badge }
```

`ConditionLike` / `EffectLike` are imported from `actor/types` (single source of truth;
`EffectLike` gains an optional `unidentified?: boolean`).

### 2. Mapper — `src/foundry/scene/view.ts`

For every token already passing the visibility filter (i.e. every token in the output),
map its actor's collections. No owner/HP gating — conditions/effects show on all visible
tokens.

```ts
const conditions = mapTokenConditions(t.actor);
const effects = mapTokenEffects(t.actor, ctx.isGM);
```

- `mapTokenConditions(actor)` → `actor.conditions?.active ?? []` mapped to `ConditionView`
  (`slug, name, value, img, locked: isLocked ?? false`) — mirrors the sheet's
  `mapConditions`.
- `mapTokenEffects(actor, isGM)` → `actor.itemTypes?.effect ?? []` mapped to `EffectView`
  (`id, name, img, badge: effectBadgeLabel(e.badge)`) — mirrors the sheet's `mapEffects`,
  reusing the exported `effectBadgeLabel` helper. **Unidentified rule:** when
  `e.unidentified === true` and the viewer is neither GM nor owner
  (`!isGM && !actor.isOwner`), substitute `name: "Effect"` and drop the badge so no detail
  leaks.

Empty collections → empty arrays (never null), so the renderer can branch on `.length`.

### 3. Live updates — `src/app/map/useScene.ts`

Conditions and effects are **embedded items** on the actor, so applying/removing one fires
`createItem` / `deleteItem` and changing a value fires `updateItem` — *not* `updateActor`.
The hook currently listens only to `updateActor`, so the icons would go stale. Add the
three item hooks (the same set `useActor`, `useStrikes`, `useToggles`, `useSpells` already
use):

```ts
useFoundryHook("createItem", onChange);
useFoundryHook("updateItem", onChange);
useFoundryHook("deleteItem", onChange);
```

The `sceneArg` builder also passes the live actor through unchanged — `scene.tokens` is
already the live collection, so `t.actor.conditions` / `t.actor.itemTypes.effect` resolve
live; no extra reads needed in the hook beyond confirming the actor is forwarded (it is,
via the live `scene.tokens`).

### 4. Sprite — `src/app/map/TokenSprite.tsx`

A `pointer-events-none` row of small status icons along the **top edge** of the token,
inside the existing positioned token `<div>` (so it pans/zooms with the token). Conditions
first, then effects; combined and **capped at 4**, with a trailing "+N" pill when there are
more.

- Each icon: a small rounded image (`icon.img`), sized as a fraction of the token
  (~28% width, square) so it scales with token size and zoom — same approach as the HP bar
  / nameplate already on the sprite.
- A valued condition (`value != null`) gets a tiny badge with the number in a corner.
- Missing `img` → a neutral dot/placeholder (never a broken image).
- The row sits just inside the top edge and does not capture pointer events, so token
  drag/tap behavior is unchanged (tap still opens the popup with the full labeled list).

The sprite takes the data from `token.conditions` / `token.effects` (already on
`TokenView`); a small local helper builds the capped `{ img, value }[]` icon list.

### 5. Popup — `src/app/map/TokenInfoPopup.tsx`

Below the HP block, add two optional sections reusing the sheet's `Chip`:

- **Conditions** — `view.conditions` as warn-tone `Chip`s, text `"{name}{ value}"`.
- **Effects** — `view.effects` as `Chip`s, text `"{name}{ badge}"`.

Read-only (no `EffectChip` long-press / no remove). A section is omitted when its array is
empty; when both are empty, render nothing extra (the popup keeps its current portrait + HP
+ Target layout).

## Data flow

`scene.tokens[i].actor` (live `conditions.active` + `itemTypes.effect`) → `buildSceneView`
(pure: map + unidentified rule) → `TokenView.conditions` / `.effects` → (a) `TokenSprite`
icon row, (b) `TokenInfoPopup` chip sections. `useScene` re-preps on
`createItem`/`updateItem`/`deleteItem` so changes reflect within ~1s. No server writes; this
is purely a read/visual feature.

## Testing — `tests/sceneView.test.ts` (extend)

- A token's `actor.conditions.active` maps onto `TokenView.conditions` with `value` carried
  (e.g. Frightened 2).
- `actor.itemTypes.effect` maps onto `TokenView.effects` with `badge` via `effectBadgeLabel`.
- Conditions/effects appear on an **NPC** token for a player (no owner/HP gating) — contrast
  with the existing HP-hidden assertion on the same kind of token.
- Missing `conditions` / `itemTypes` → empty arrays (not null/undefined).
- **Unidentified effect:** name masked to "Effect" + badge dropped for a non-GM non-owner;
  shown in full for the GM and for the owner (`isOwner: true`).
- Existing 206 tests stay green; target ~212–214.

(The pure mapper carries the logic, so it gets the test coverage. `TokenSprite` /
`TokenInfoPopup` are thin presentational glue, verified by live play-test alongside the rest
of Phase 7.)

## Out of scope (v1)

- Tapping an individual sprite icon for that effect's description (the popup already lists
  names; per-icon hit-targets are too small on mobile — tap the token instead).
- Removing/editing conditions from the map (sheet-only action).
- Tooltips / hover labels on sprite icons (no hover on touch).
- A configurable icon cap or per-icon visibility filtering beyond the unidentified rule.
- Hiding conditions on enemies as a GM "fog" option (decided: all visible tokens show them).
