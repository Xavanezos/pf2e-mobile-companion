# Phase 7 — Lightweight battle map — Design

**Status:** Specced 2026-06-12 (built before Phase 6 per the revised build order). Autonomous brainstorming — the user was away; design decisions below are drawn from the master-plan Phase 7 bullets and the established codebase pattern, and are **flagged for review** in the return checklist. Live-API paths (scene dimensions, token coordinate space, move permission) are grounded against Foundry/PF2e knowledge + the cloned checkout but **only confirm in play** — see **Live-API assumptions**.

The bottom **Map** tab today shows a placeholder in its `flex-1` area with the macro bar pinned beneath (Phase 4.1). This phase fills that area with a **lightweight, custom battle map**: the active scene's background image with the visible tokens drawn as absolutely-positioned elements, pan/zoom by touch, and drag-to-move for the player's own token. It is **not** the Foundry PIXI canvas (which stays disabled by `core.noCanvas`) — it is a plain DOM renderer over the live `game.scenes.active` Documents, the same "we draw it ourselves from live data" decision made for the sheet, strikes, toggles, and combat tracker.

**Goal (master plan):** *situational awareness + moving your token, not full fidelity.* The player sees where everyone is, whose turn it is, and can drag their own token; Foundry validates the move server-side and every other client (incl. the GM's canvas) updates live.

**Out of scope (YAGNI / deferred):**

- **Vision, fog of war, lighting, walls.** With the canvas off there is no vision pipeline; v1 shows all non-hidden tokens and relies on GM discipline (master-plan decision). A later setting could gate "players see all non-hidden tokens."
- **Templates / measurement / rulers** — explicitly out for v1 (master plan).
- **Token rotation, elevation editing, multi-select, drawing, notes, tiles, drag-drop of new tokens.** Read + move-own-token only.
- **Non-active scenes / scene navigation.** v1 renders `game.scenes.active` only; "no active scene" is an empty state.
- **Token HUD / status-effect icons / nameplate styling parity.** A tapped token opens a minimal info popup (name + HP where visible); full parity is not a goal.
- **Pinch-zoom of the background as an image page** — that is the *journal* image-page feature (Phase 6); here zoom is part of the map renderer.

---

## Decisions (autonomous — review on return)

1. **Plain DOM renderer, not the PIXI canvas.** A single transformed "stage" `<div>` holds the background `<img>` and one positioned `<div>` per visible token. Chrome-only + touch-only makes hand-rolled pan/zoom cheap and avoids a gesture dependency.
2. **The pure mapper takes pre-resolved `dimensions` as input.** The scene→pixel geometry (`SceneDimensions`: `width/height/sceneX/sceneY/sceneWidth/sceneHeight/size`) is computed by Foundry. **Confirmed by the API research:** `scene.dimensions` is set in `Scene#prepareBaseData()` via `scene.grid.calculateDimensions(...)` — a pure document-layer path with **no canvas dependency**, so it is fully populated with `noCanvas` on (unlike `canvas.dimensions`, which is absent). So `buildSceneView(scene, dimensions, tokens, ctx)` is **pure and unit-tested** over structural fixtures, and the **thin live glue** (`useScene`) reads `scene.dimensions` and hands it in. Keeping `dims` a parameter (not read inside the mapper) is purely for testability + a one-line fix if a field ever differs — not because it is expected to.
3. **Visibility = "skip GM-hidden, show the rest."** Players see every token whose `hidden` is false (crude, per the master plan). The GM sees hidden tokens too (dimmed). Name/HP on the tap-popup follow the token's `displayName`/`displayBars` mode + ownership, mirroring what a player normally sees — same gating as the combat tracker's NPC-HP rule.
4. **Drag moves only your own token.** A token is draggable iff the active character owns its actor (`isMine`). Drag updates a local "optimistic" position for smoothness, snaps to the grid on release, and dispatches one guarded `moveToken(tokenId, {x,y})` → `scene.tokens.get(id).update({x,y})`. Foundry permission-checks server-side; rejection → toast + revert (the next `updateToken`/re-prep restores the true position).
5. **Read-only mirror + guarded dispatch.** The map reflects live Documents and re-preps on token/scene/actor hooks; the only write is the one token move. No canvas, no `game.canvas`, ever — `game.scenes.active` is game-level and present with `noCanvas` on.
6. **Current-turn ring ties into Phase 5.** The active combatant's token (`game.combat?.combatant?.token?.id`) gets a highlight ring, so the map and the Combat tab agree on whose turn it is.
7. **Pan/zoom is local component state, not the store.** Zoom factor + pan offset live in the Map renderer (ephemeral view state); the store keeps only durable UI state, per the project's "store mirrors, Documents own truth" rule. Initial transform = fit-scene-to-viewport.

---

## Architecture & data flow

Follows the established pattern exactly (pure sync mapper → version-bumped hook → guarded action → thin UI), the same shape as `useEncounter`/`combat/view.ts`.

```
Map tab  (MapTab: map area [flex-1] + pinned MacroBar [Phase 4.1, unchanged])
   │
   ├─ useScene(actorId) → buildSceneView(scene, dims, tokens, ctx)        [pure, SYNC]
   │      scene  = game.scenes.active
   │      dims   = scene.dimensions            (SceneDimensions; live glue, fallback-computed)
   │      tokens = scene.tokens                (TokenDocument[])
   │      ctx    = { isGM, characterActorId, currentTokenId }
   │      per token:
   │        • hidden && !isGM            → omit
   │        • left/top  = token.x / token.y                 (scene px, padded-canvas space)
   │        • w/h        = token.width|height * dims.size    (grid units → px)
   │        • img        = token.texture.src
   │        • isMine      = actor owned by characterActorId  → draggable
   │        • isCurrent   = id === ctx.currentTokenId        → turn ring
   │        • name/hp/disposition for the tap popup (hp gated like the tracker)
   │      → SceneView { background, dims, tokens[], hasScene } | null (no active scene → empty state)
   │      re-preps on  updateToken / createToken / deleteToken
   │                   / updateScene / (scene activation) / updateActor (token HP)
   │
   └─ drag own token → onRelease → snapToGrid(x,y,dims) → moveToken(tokenId,{x,y})  [guarded]
            scene.tokens.get(tokenId).update({ x, y })
            (Foundry validates ownership server-side; rejection → toast, optimistic pos reverts)
```

- **Synchronous mapper.** `scene.tokens` is an in-memory collection — no async prep. The hook mirrors `useEncounter`: a `useMemo` invalidated by a version bump on the relevant hooks.
- **Never hold live objects in React state.** The mapper keeps ids + numeric geometry + display fields; the move action re-reads the live `TokenDocument` by id at release time.
- **Coordinate model.** The stage `<div>` is `dims.width × dims.height` px (the full padded scene). The background `<img>` sits at `(dims.sceneX, dims.sceneY)` sized `dims.sceneWidth × dims.sceneHeight`. Each token sits at `(token.x, token.y)` sized to the grid. A single CSS `transform: translate(panX, panY) scale(zoom)` on the stage does all pan/zoom; pointer math converts screen↔scene coordinates by inverting it.

---

## Components & data layer

**New files**

| File | Purpose |
|---|---|
| `src/foundry/scene/types.ts` | `SceneView`, `TokenView`, `SceneDimensionsLike`, source shapes `SceneLike`/`TokenLike`, `SceneViewContext` |
| `src/foundry/scene/view.ts` | pure `buildSceneView(scene, dims, tokens, ctx)` — visibility filter, px geometry, mine/current flags, hp gating |
| `src/foundry/scene/geometry.ts` | pure `screenToScene` / `sceneToScreen` transform helpers (unit-tested); grid-snap is delegated to `scene.grid` in the action |
| `src/foundry/scene/actions.ts` | guarded `moveToken(sceneId, tokenId, x, y)` → re-read live token, snap via `scene.grid.getTopLeftPoint`, `update({x,y})`, try/catch → toast |
| `src/app/map/useScene.ts` | sync refresh hook: `useMemo` over `(version, actorId)`, bumped on the token/scene/actor hooks; resolves `game.scenes.active` + `dimensions`; returns `SceneView | null` |
| `src/app/map/BattleMap.tsx` | the renderer: viewport + transformed stage + background + tokens; owns pan/zoom + drag gestures and the `moveToken` dispatch |
| `src/app/map/TokenSprite.tsx` | presentational token: portrait, turn ring, disposition tint, "mine" affordance, defeated/hidden styling |
| `src/app/map/TokenInfoPopup.tsx` | minimal tap-popup (name + HP bar where visible), reusing `Modal` |

**Edits**

- `src/app/tabs/MapTab.tsx` — replace the `<Placeholder>` in the `flex-1` area with `<BattleMap />`; the pinned `<MacroBar>` stays exactly as is.

No store change (`"map"` is already a `TabId` and already routed). No new chat infra. The only Document mutation is the single guarded token move.

### Types (`src/foundry/scene/types.ts`)

```ts
export interface SceneDimensionsLike {
  width: number;   height: number;    // full padded scene, px
  sceneX: number;  sceneY: number;     // background top-left within the padded scene
  sceneWidth: number; sceneHeight: number; // background size, px
  size: number;                        // px per grid square
}

export interface TokenView {
  id: string;
  name: string;            // "" / hidden when the player may not see it (popup decides display)
  img: string | null;
  left: number; top: number;   // scene px (padded-canvas space) = token.x / token.y
  width: number; height: number; // px (grid units × size)
  isMine: boolean;         // active character owns the actor → draggable
  isCurrent: boolean;      // current combatant's token → turn ring
  hidden: boolean;         // GM-hidden (only present in the list for the GM, rendered dimmed)
  disposition: number;     // CONST.TOKEN_DISPOSITIONS (-2 secret … 1 friendly)
  hp: { value: number; max: number } | null; // null when the viewer may not see it
}

export interface SceneView {
  background: string | null;   // scene.background.src
  dims: SceneDimensionsLike;
  tokens: TokenView[];
  hasScene: true;              // present only when there is an active scene
}

export interface SceneViewContext {
  isGM: boolean;
  characterActorId: string | null;
  currentTokenId: string | null; // game.combat?.combatant?.token?.id
}

// ---- Source documents, structurally (only the fields the mapper reads) ----
export interface TokenLike {
  id: string;
  name: string;
  x: number; y: number;        // top-left, padded-canvas px
  width: number; height: number; // grid units
  hidden: boolean;
  disposition?: number;
  displayName?: number;        // CONST.TOKEN_DISPLAY_MODES
  displayBars?: number;
  texture?: { src?: string | null } | null;
  actor?: {
    id: string;
    isOwner?: boolean;         // active user owns it (we cross-check characterActorId for "mine")
    hasPlayerOwner?: boolean;
    system?: { attributes?: { hp?: { value?: number; max?: number } } };
  } | null;
}
export interface SceneLike {
  background?: { src?: string | null } | null;
  tokens: TokenLike[] | { contents: TokenLike[] };
}
```

### `buildSceneView(scene, dims, tokens, ctx)` — pure, sync

Visibility-filters tokens (`hidden && !isGM` → omit), computes px geometry from `dims.size`, sets `isMine` (`token.actor?.id === characterActorId`), `isCurrent` (`token.id === ctx.currentTokenId`), and gates `hp` exactly like the tracker (`isGM || actor.hasPlayerOwner`). Name display for the popup uses `displayName`/ownership but the *list* always carries the real name for the GM; the popup component blanks it for players when the mode says so. Pure, no globals — unit-tested.

### Transform helpers (`geometry.ts`) — pure, unit-tested

The tested pure part is the **screen↔scene transform** that converts a pointer position into a scene-space coordinate (and back), inverting the stage's `translate(pan) scale(zoom)`:

```ts
export interface ViewTransform { panX: number; panY: number; zoom: number; }
// screen (viewport px) → scene (padded-canvas px)
export function screenToScene(px: number, py: number, t: ViewTransform) {
  return { x: (px - t.panX) / t.zoom, y: (py - t.panY) / t.zoom };
}
export function sceneToScreen(x: number, y: number, t: ViewTransform) {
  return { px: x * t.zoom + t.panX, py: y * t.zoom + t.panY };
}
```

**Grid-snapping is delegated to Foundry, not hand-rolled.** The research confirms `scene.grid.getTopLeftPoint({x,y})` (and `getSnappedPoint`/`getCenterPoint`) are **pure document-layer** helpers that work with `noCanvas` on — authoritative for any grid type, odd-size tokens, and offsets. So the **`moveToken` action snaps via `scene.grid.getTopLeftPoint`** at dispatch time; the drag preview moves freely and lands on the true grid cell once the `update` round-trips. No hand-rolled snap to drift out of sync with Foundry.

### `moveToken` — guarded (like `endTurn` / `executeMacro`)

```ts
export function moveToken(sceneId: string, tokenId: string, x: number, y: number): Promise<void> {
  return guard(async () => {
    const scene = (game as any)?.scenes?.get(sceneId);
    const token = scene?.tokens?.get(tokenId);
    if (!token?.update) throw new Error("no such token");
    const snapped = scene.grid.getTopLeftPoint({ x, y });  // canvas-free grid snap (any grid type)
    await token.update({ x: snapped.x, y: snapped.y });    // Foundry permission-checks server-side
  });
}
```

### `BattleMap` — renderer + gestures

- Resolves `useScene(actorId)`; `null` → centered "No active scene." empty state.
- A `viewport` div (`relative overflow-hidden`, fills the `flex-1` area) containing the `stage` div (`absolute`, sized `dims.width×height`, `transform: translate(pan) scale(zoom)`, `transform-origin: 0 0`).
- **Pan/zoom:** pointer events on the viewport. One pointer = pan (drag background). Two pointers = pinch-zoom around the midpoint. Wheel = zoom (desktop testing). Initial fit computed from viewport vs `dims` on first layout (`ResizeObserver`).
- **Token drag:** `pointerdown` on a `TokenSprite` with `isMine` starts a drag (capture pointer, stop pan); move updates an optimistic `{id,x,y}`; `pointerup` snaps + calls `moveToken`. Non-mine tokens are tap-only (open the info popup).
- **Tap vs drag** disambiguated by a small movement threshold; a tap on any token opens `TokenInfoPopup`.
- Follows the Tailwind-v4 button gotchas (`bg`/`ring`, `justify-start`) per `styling-gotchas`.

---

## Live-API grounding (confirmed by API research 2026-06-12; ⚠ items still confirm in play)

1. ✅ **`game.scenes.active`** is the active `ScenePF2e`, populated with `core.noCanvas` on (scenes are world docs, loaded at world-init independent of the render layer). Use `.active` — **not** `.viewed` (nothing is "viewed" with no canvas). Scene activation = an **`updateScene`** with `changed.active === true` (the previously-active scene gets `changed.active === false`); PF2e's `ScenePF2e._onUpdate` keys off the same flag.
2. ✅ **`scene.dimensions`** yields `{width, height, size, rect, sceneX, sceneY, sceneWidth, sceneHeight, sceneRect, distance, distancePixels, units, rows, columns, …}` **canvas-free** — computed in `prepareBaseData` via `scene.grid.calculateDimensions`. (`canvas.dimensions`/`canvas.grid` are the canvas-bound twins that are absent; do **not** use them.) `useScene` passes `scene.dimensions` to the mapper.
3. ✅ **Token coordinates:** `token.x`/`token.y` are the **top-left in the padded-canvas space** (same space as `dimensions.rect`; a token at the art's corner is at `(sceneX, sceneY)`), so tokens render at raw `(x, y)` with **zero** offset math. `token.width`/`token.height` are in **grid units** → px = `× dims.size`. Confirmed against PF2e's `TokenDocumentPF2e#bounds` getter (`x, y, width*gridSize, height*gridSize`).
4. ✅ **`token.texture.src`** = token image; **`token.hidden`** = GM-hide; **`token.disposition`** ∈ `CONST.TOKEN_DISPOSITIONS` (`SECRET:-2, HOSTILE:-1, NEUTRAL:0, FRIENDLY:1`) and is **already PF2e-alliance-remapped** (color directly: friendly→blue/green, hostile→red, neutral→amber, secret→purple). `displayName`/`displayBars` ∈ `CONST.TOKEN_DISPLAY_MODES` (`NONE:0, CONTROL:10, OWNER_HOVER:20, HOVER:30, OWNER:40, ALWAYS:50`).
5. ✅ **Player visibility = `!token.hidden && !token.isSecret`** (+ GM sees all, hidden ones dimmed). `token.isSecret` is a PF2e getter (SECRET disposition the player can't reveal). Disposition otherwise does **not** gate visibility, only coloring. Name visibility mirrors the tracker via PF2e's **`token.playersCanSeeName`** getter (`displayName` ALWAYS/HOVER **or** actor alliance is party). HP from `token.actor.system.attributes.hp`, gated by `isGM || actor.hasPlayerOwner` — identical to `buildEncounterView`.
6. ✅ **Moving:** `scene.tokens.get(id).update({x,y})`; ownership validated **server-side** (guarded → toast, then the next `updateToken` re-prep restores truth). Snap with `scene.grid.getTopLeftPoint({x,y})` (canvas-free). ⚠️ Whether a **player may move their own token** depends on token/actor ownership in the world — the highest-risk live item (cf. Phase 5's `nextTurn` permission); test with a real player.
7. ✅ **Current combatant's token:** `game.combat?.combatant?.tokenId` (or `.token?.id`); only draw the ring when `combatant.sceneId === scene.id`. Re-prep on `updateCombat`.
8. ✅ **Hooks** fire on all clients with canvas off (document layer, not canvas): `createToken`, `updateToken`, `deleteToken`, `updateScene`, `createScene`, `deleteScene`, `updateActor` (token HP), `updateCombat` (turn ring). Canvas-only hooks (`canvasReady`, `refreshToken`, `hoverToken`) do **not** fire — we use none of them. ⚠️ The **coordinate accuracy over the real background** (esp. odd `padding`/`background.offset` scenes) is the other thing to eyeball live.

---

## Testing

- **TDD the pure pieces** (Vitest, structural fixtures, no globals):
  - `tests/sceneView.test.ts` — `buildSceneView`: GM-hidden omitted for players / kept (dimmed) for GM; px geometry = `x,y` + `w/h×size`; `isMine` by actor id; `isCurrent` by `currentTokenId`; hp gated (own/party/GM vs NPC→null); `background`/empty-token cases; `scene.tokens` accepted as array **or** `{contents}`.
  - `tests/sceneGeometry.test.ts` — `screenToScene`/`sceneToScreen` are exact inverses under a translate+scale (round-trip a few points at zoom≠1, pan≠0). (Grid snapping is `scene.grid`'s job — exercised by the live checklist, not unit-tested.)
- **Hook, renderer, gestures, actions glue** are verified by `npm run typecheck` + `npm run build` (test the **production** build) + a manual live checklist. `moveToken` gets a small guarded-action test (`tests/moveToken.test.ts`, stubbing `game.scenes.active.tokens.get`) like `combatActions`/`executeMacro`.
- **Manual live checklist** (GM on desktop with an active scene + the player's token + an NPC + a GM-hidden token; Player1 at mobile width on the **Map** tab): background renders; tokens are positioned correctly over it; GM-hidden token absent for the player; pinch-zoom + pan work; dragging the player's own token snaps and moves it on the GM's canvas within ~1s (and reverts on a rejected move); a non-owned token is tap-only → info popup with name + HP only where a player may see it; the current combatant's token shows the turn ring; "no active scene" empty state.

---

## Execution

Per `execution-workflow`: inline batched execution, **commit per task to `main`**, messages `Phase 7 (Task M): …` + the `Co-Authored-By: Claude Opus 4.8 (1M context)` trailer.

1. **Types + pure `buildSceneView`** (TDD `sceneView.test.ts`).
2. **Geometry helpers** `screenToScene`/`sceneToScreen` (TDD `sceneGeometry.test.ts`); grid-snap delegated to `scene.grid` in the action.
3. **`useScene` hook + static render** — `BattleMap` + `TokenSprite` showing background + positioned tokens (no gestures yet); route into `MapTab`. *Render-only* — **live-look checkpoint**.
4. **Pan/zoom** gestures (no token drag).
5. **Drag-own-token + `moveToken`** (TDD the action) + optimistic move/revert.
6. **Tap-for-info popup** + **current-turn ring** (the Phase-5 tie-in).

Typecheck + prod build + tests green at each task; live checkpoints after Task 3 (positioning is the make-or-break) and at the end (drag-move permission + coordinate accuracy can only be confirmed in play).
