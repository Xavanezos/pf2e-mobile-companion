# Phase 7 — Lightweight battle map — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Commit per task to `main`, subject `Phase 7 (Task M): …` + the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Typecheck + prod build + tests green at each task.

**Goal:** Fill the Map tab's `flex-1` area (above the pinned macro bar) with a custom DOM battle map over `game.scenes.active`: background image + positioned token divs, pinch/pan zoom, drag-your-own-token to move (`scene.tokens.get(id).update({x,y})`), a current-turn ring, and a tap-for-info popup. No PIXI canvas (`core.noCanvas` stays on).

**Architecture:** the established pure-mapper → version-bumped hook → guarded-action → thin-UI pattern (mirrors `combat/*`). `buildSceneView` is pure + unit-tested; `scene.dimensions` (canvas-free) and grid-snapping (`scene.grid.getTopLeftPoint`) come from the live glue. **Spec:** `docs/superpowers/specs/2026-06-12-phase-7-battle-map-design.md`. **API grounding:** confirmed against the cloned PF2e + fvtt-types (see spec §Live-API).

**Testing convention:** unit-test **pure logic** (`buildSceneView`, the transform helpers) and **guarded actions** (`moveToken`, stubbing globals). Hooks/components/gestures = typecheck + build + live checklist. Baseline **177 tests**.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/foundry/scene/types.ts` | `SceneView`, `TokenView`, `SceneDimensionsLike`, `SceneLike`, `TokenLike`, `SceneViewContext` | 1 |
| `src/foundry/scene/view.ts` | pure `buildSceneView(scene, dims, ctx)` | 1 |
| `tests/sceneView.test.ts` | mapper unit tests | 1 |
| `src/foundry/scene/geometry.ts` | pure `screenToScene`/`sceneToScreen` + `ViewTransform` | 2 |
| `tests/sceneGeometry.test.ts` | transform round-trip tests | 2 |
| `src/app/map/useScene.ts` | version-bumped hook → `SceneView \| null` | 3 |
| `src/app/map/TokenSprite.tsx` | one positioned token (portrait, ring, tint, nameplate) | 3 |
| `src/app/map/BattleMap.tsx` | viewport + transformed stage + background + tokens; fit-on-mount (T3), gestures (T4), drag (T5), tap (T6) | 3–6 |
| `src/app/tabs/MapTab.tsx` *(edit)* | swap the `<Placeholder>` for `<BattleMap />` | 3 |
| `src/foundry/scene/actions.ts` | guarded `moveToken(sceneId, tokenId, x, y)` | 5 |
| `tests/moveToken.test.ts` | action unit tests | 5 |
| `src/app/map/TokenInfoPopup.tsx` | tap popup (name + HP), reuses `Modal` | 6 |

---

## Task 1 — Types + pure `buildSceneView` (TDD)

**`tests/sceneView.test.ts`:**

```ts
import { describe, it, expect } from "vitest";
import { buildSceneView } from "../src/foundry/scene/view";
import type { SceneLike, TokenLike, SceneDimensionsLike, SceneViewContext } from "../src/foundry/scene/types";

function token(over: Partial<TokenLike> = {}): TokenLike {
  return {
    id: "t1", name: "Goblin", x: 100, y: 200, width: 1, height: 1,
    hidden: false, disposition: -1, isSecret: false, playersCanSeeName: true,
    texture: { src: "gob.webp" },
    actor: { id: "a1", hasPlayerOwner: false, system: { attributes: { hp: { value: 5, max: 5 } } } },
    ...over,
  };
}
function scene(tokens: TokenLike[], over: Partial<SceneLike> = {}): SceneLike {
  return { id: "s1", background: { src: "bg.webp" }, tokens, ...over };
}
const DIMS: SceneDimensionsLike = { width: 4500, height: 3500, size: 100, sceneX: 250, sceneY: 250, sceneWidth: 4000, sceneHeight: 3000 };
const PLAYER: SceneViewContext = { isGM: false, characterActorId: "hero", currentTokenId: null };
const GM: SceneViewContext = { isGM: true, characterActorId: null, currentTokenId: null };

describe("buildSceneView", () => {
  it("maps fields and converts grid units to px", () => {
    const v = buildSceneView(scene([token({ x: 100, y: 200, width: 2, height: 1 })]), DIMS, GM);
    expect(v.background).toBe("bg.webp");
    expect(v.dims.size).toBe(100);
    expect(v.tokens[0]).toMatchObject({ left: 100, top: 200, width: 200, height: 100, img: "gob.webp" });
  });
  it("omits hidden + secret tokens for a player, keeps them for the GM", () => {
    const ts = [token({ id: "vis" }), token({ id: "hid", hidden: true }), token({ id: "sec", isSecret: true })];
    expect(buildSceneView(scene(ts), DIMS, PLAYER).tokens.map((t) => t.id)).toEqual(["vis"]);
    expect(buildSceneView(scene(ts), DIMS, GM).tokens.map((t) => t.id)).toEqual(["vis", "hid", "sec"]);
  });
  it("blanks the name when the player may not see it", () => {
    const hidden = [token({ name: "Dragon", playersCanSeeName: false })];
    expect(buildSceneView(scene(hidden), DIMS, PLAYER).tokens[0].name).toBe("");
    expect(buildSceneView(scene(hidden), DIMS, GM).tokens[0].name).toBe("Dragon");
    expect(buildSceneView(scene([token({ name: "Bob", playersCanSeeName: true })]), DIMS, PLAYER).tokens[0].name).toBe("Bob");
  });
  it("shows HP only to GM / owning player", () => {
    const pc = token({ id: "pc", actor: { id: "hero", hasPlayerOwner: true, system: { attributes: { hp: { value: 30, max: 40 } } } } });
    const npc = token({ id: "npc", actor: { id: "x", hasPlayerOwner: false, system: { attributes: { hp: { value: 8, max: 8 } } } } });
    const pv = buildSceneView(scene([pc, npc]), DIMS, PLAYER);
    expect(pv.tokens[0].hp).toEqual({ value: 30, max: 40 });
    expect(pv.tokens[1].hp).toBeNull();
    expect(buildSceneView(scene([npc]), DIMS, GM).tokens[0].hp).toEqual({ value: 8, max: 8 });
  });
  it("returns null hp when the shape is missing", () => {
    expect(buildSceneView(scene([token({ actor: { id: "a", hasPlayerOwner: true, system: {} } })]), DIMS, GM).tokens[0].hp).toBeNull();
  });
  it("flags isMine and isCurrent", () => {
    const ts = [token({ id: "c1", actor: { id: "hero", hasPlayerOwner: true } }), token({ id: "c2", actor: { id: "foe" } })];
    const v = buildSceneView(scene(ts), DIMS, { isGM: false, characterActorId: "hero", currentTokenId: "c1" });
    expect(v.tokens[0]).toMatchObject({ isMine: true, isCurrent: true });
    expect(v.tokens[1]).toMatchObject({ isMine: false, isCurrent: false });
  });
  it("accepts scene.tokens as an array or a {contents} collection", () => {
    const arr = scene([token({ id: "a" })]);
    const coll = { id: "s1", background: { src: "bg.webp" }, tokens: { contents: [token({ id: "b" })] } } as unknown as SceneLike;
    expect(buildSceneView(arr, DIMS, GM).tokens[0].id).toBe("a");
    expect(buildSceneView(coll, DIMS, GM).tokens[0].id).toBe("b");
  });
  it("handles an empty scene", () => {
    const v = buildSceneView(scene([]), DIMS, PLAYER);
    expect(v.tokens).toEqual([]);
    expect(v.hasScene).toBe(true);
  });
});
```

**`src/foundry/scene/types.ts`** — as in the spec (SceneDimensionsLike, TokenView, SceneView, SceneViewContext, TokenLike with `isSecret?`/`playersCanSeeName?`, SceneLike with `id`/`background`/`tokens: TokenLike[] | { contents: TokenLike[] }`).

**`src/foundry/scene/view.ts`:**

```ts
import type { SceneLike, SceneView, SceneViewContext, SceneDimensionsLike, TokenLike, TokenView } from "./types";

/** Pure: build the player-facing battle-map view from the live active scene.
 *  Owns every visibility rule (GM-hidden + PF2e-secret omitted for players, name
 *  blanked, NPC HP hidden) so the UI owns none — same discipline as
 *  buildEncounterView. `dims` (scene.dimensions) and token coords are already in
 *  padded-canvas px; width/height are grid units → px via dims.size. */
export function buildSceneView(scene: SceneLike, dims: SceneDimensionsLike, ctx: SceneViewContext): SceneView {
  const raw: TokenLike[] = Array.isArray(scene.tokens) ? scene.tokens : scene.tokens?.contents ?? [];
  const tokens: TokenView[] = [];
  for (const t of raw) {
    if (!ctx.isGM && (t.hidden || t.isSecret === true)) continue; // players never see GM-hidden / secret
    const isMine = !!t.actor && t.actor.id === ctx.characterActorId;
    const canSeeHp = ctx.isGM || t.actor?.hasPlayerOwner === true;
    const hpRaw = t.actor?.system?.attributes?.hp;
    const hp = canSeeHp && hpRaw && typeof hpRaw.value === "number" && typeof hpRaw.max === "number"
      ? { value: hpRaw.value, max: hpRaw.max } : null;
    const canSeeName = ctx.isGM || t.playersCanSeeName === true;
    tokens.push({
      id: t.id,
      name: canSeeName ? t.name : "",
      img: t.texture?.src ?? null,
      left: t.x, top: t.y,
      width: t.width * dims.size,
      height: t.height * dims.size,
      isMine,
      isCurrent: t.id === ctx.currentTokenId,
      hidden: t.hidden,
      disposition: t.disposition ?? 0,
      hp,
    });
  }
  return { background: scene.background?.src ?? null, dims, tokens, hasScene: true };
}
```

Run `npx vitest run tests/sceneView.test.ts` → 8 pass. Commit `Phase 7 (Task 1): buildSceneView mapper + scene types`.

---

## Task 2 — Geometry transform helpers (TDD)

**`tests/sceneGeometry.test.ts`:**

```ts
import { describe, it, expect } from "vitest";
import { screenToScene, sceneToScreen, type ViewTransform } from "../src/foundry/scene/geometry";

describe("screen/scene transforms", () => {
  const t: ViewTransform = { panX: 40, panY: -25, zoom: 1.5 };
  it("sceneToScreen applies translate+scale", () => {
    expect(sceneToScreen(100, 200, t)).toEqual({ px: 100 * 1.5 + 40, py: 200 * 1.5 - 25 });
  });
  it("screenToScene is the exact inverse", () => {
    for (const [x, y] of [[0, 0], [123, 456], [-30, 999]] as const) {
      const s = sceneToScreen(x, y, t);
      const back = screenToScene(s.px, s.py, t);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });
});
```

**`src/foundry/scene/geometry.ts`** — `ViewTransform { panX, panY, zoom }`, `screenToScene`, `sceneToScreen` (as in the spec). Run the test → pass. Commit `Phase 7 (Task 2): screen/scene transform helpers`.

---

## Task 3 — `useScene` hook + static render (BattleMap + TokenSprite) + route

No unit tests (hook/components). `useScene` mirrors `useEncounter`:

```ts
// src/app/map/useScene.ts
export function useScene(actorId: string | null): SceneView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onChange = useCallback(() => bump(), []);
  for (const h of ["updateToken","createToken","deleteToken","updateScene","createScene","deleteScene","updateActor","updateCombat"]) {
    // NOTE: call useFoundryHook explicitly per hook (hooks can't be in a loop) — unrolled in the real file.
  }
  return useMemo(() => {
    const scene = (game as any)?.scenes?.active;
    if (!scene?.dimensions) return null;
    const isGM = !!(game as any)?.user?.isGM;
    const c = (game as any)?.combat?.combatant;
    const currentTokenId = c && c.sceneId === scene.id ? (c.tokenId ?? c.token?.id ?? null) : null;
    return buildSceneView(scene, scene.dimensions, { isGM, characterActorId: actorId, currentTokenId });
  }, [version, actorId]);
}
```
(Unroll the eight `useFoundryHook("updateToken", onChange)` … calls — do **not** loop hooks.)

**`TokenSprite.tsx`** — `position:absolute; left/top/width/height` (scene px), `<img>` cover, rounded. Disposition tint ring: friendly `ring-sky-400` / hostile `ring-rose-500` / neutral `ring-amber-400` / secret `ring-fuchsia-500`. `isCurrent` → thicker `ring-4 ring-indigo-300` + pulse. `isMine` → subtle `ring-offset` or a dot. `hidden` (GM only) → `opacity-50`. Optional tiny nameplate under the token when `name !== ""` and zoom is large enough (pass zoom or always show; keep simple: show a truncated nameplate). Use `bg`/`ring`, never `border` (styling-gotchas).

**`BattleMap.tsx`** — `useScene(actorId)`; `null` → centered "No active scene." A `viewport` div (`relative h-full w-full overflow-hidden bg-black touch-none`) with a `stage` div (`absolute left-0 top-0`, `width/height = dims`, `transform: translate3d(panX,panY,0) scale(zoom)`, `transformOrigin: "0 0"`). Background `<img>` absolute at `left:sceneX, top:sceneY, width:sceneWidth, height:sceneHeight`. Map `view.tokens` → `<TokenSprite>`. **Fit-on-mount:** a `useState<ViewTransform>`, set once from a `ResizeObserver`/layout effect: `zoom = min(vw/dims.width, vh/dims.height)`, center (`panX=(vw-dims.width*zoom)/2`, `panY=…`). Static this task (no pointer handlers yet).

**`MapTab.tsx` edit** — replace the `<Placeholder title="Battle Map" …/>` with `<BattleMap />`. Keep the `<MacroBar>` exactly. Typecheck + build. Commit `Phase 7 (Task 3): render the active scene with positioned tokens`. **CHECKPOINT — live-look** (positioning over the real background is make-or-break).

---

## Task 4 — Pan/zoom gestures

Add pointer handlers to the `viewport` in `BattleMap`. Track active pointers in a `Map<pointerId, {x,y}>`. One pointer = pan (`pan += delta`). Two pointers = pinch: zoom by the ratio of current/previous pinch distance, anchored at the midpoint (adjust pan so the midpoint stays fixed: `pan = mid - sceneAtMid*newZoom`). `onWheel` = zoom at the cursor (desktop testing). Clamp zoom to e.g. `[0.05, 4]`. `touch-action: none` (already) so the browser doesn't scroll. Commit `Phase 7 (Task 4): pinch-zoom and pan`.

---

## Task 5 — Drag own token + `moveToken` (TDD the action)

**`tests/moveToken.test.ts`** (stubs `game.scenes.get(...).tokens.get(...)` + `scene.grid.getTopLeftPoint`, like `combatActions`):

```ts
import { describe, it, expect } from "vitest";
import { moveToken } from "../src/foundry/scene/actions";

function stub(opts: { reject?: boolean; noToken?: boolean } = {}) {
  const calls = { updated: [] as any[] };
  const token = { update: (p: any) => { calls.updated.push(p); return opts.reject ? Promise.reject(new Error("no perm")) : Promise.resolve(true); } };
  const scene = { grid: { getTopLeftPoint: ({ x, y }: any) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 }) }, tokens: { get: (_: string) => (opts.noToken ? undefined : token) } };
  (globalThis as any).game = { scenes: { get: (_: string) => scene } };
  (globalThis as any).ui = { notifications: { error: () => {} } };
  return calls;
}
describe("moveToken", () => {
  it("snaps to the grid and updates the token", async () => {
    const calls = stub();
    await moveToken("s1", "t1", 138, 271);
    expect(calls.updated).toEqual([{ x: 100, y: 300 }]);
  });
  it("never throws on a rejected (permission) update", async () => {
    stub({ reject: true });
    await expect(moveToken("s1", "t1", 0, 0)).resolves.toBeUndefined();
  });
  it("no-ops when the token is gone", async () => {
    const calls = stub({ noToken: true });
    await moveToken("s1", "t1", 0, 0);
    expect(calls.updated).toEqual([]);
  });
});
```

**`src/foundry/scene/actions.ts`** — guarded `moveToken(sceneId, tokenId, x, y)` per the spec (re-read `game.scenes.get(sceneId).tokens.get(tokenId)`, `scene.grid.getTopLeftPoint`, `update`).

**Drag in `BattleMap`/`TokenSprite`:** `pointerdown` on a token with `isMine` → `setPointerCapture`, mark dragging (suppress pan), track an optimistic `{id, left, top}`. `pointermove` → `screenToScene(delta)` added to the token's scene pos (store optimistic). `pointerup` → `void moveToken(scene.id, id, optimistic.x, optimistic.y)`; clear optimistic (the `updateToken` re-prep lands the snapped truth; on rejection it reverts). Render the dragged token at the optimistic pos when present. Commit `Phase 7 (Task 5): drag your own token to move it`.

---

## Task 6 — Tap-for-info popup + current-turn ring polish

**Tap vs drag:** if pointer moved < ~6px between down and up, treat as a tap → open `TokenInfoPopup` for that token (any token, not just mine). **`TokenInfoPopup.tsx`** — reuse `Modal`; show portrait + `name` (or "Hidden" when `name === ""`) + an HP bar when `hp != null` (same bar as `CombatantRow`) + a disposition label. The current-turn ring/pulse from Task 3 is the Phase-5 tie-in; verify it tracks `updateCombat`. Typecheck + build. Commit `Phase 7 (Task 6): tap a token for info; current-turn ring`.

---

## Task 7 — Verification

`npm run test` (expect **177 + 11** = **188**: 8 sceneView + 3 sceneGeometry + 3 moveToken = 14… adjust to the real count and confirm the number, not just "green"), `npm run typecheck`, `npm run build`. Then the live checklist from the spec. No code changes.

> If the live look shows a constant token offset, the fix is one line in `useScene` (how `dims`/coords are read) — never the tested mapper. If a player can't move their token, it's the world's ownership config (like Phase 5's `nextTurn`); record it for the checklist.
