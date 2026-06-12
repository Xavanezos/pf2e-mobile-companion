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
const PLAYER: SceneViewContext = { isGM: false, characterActorId: "hero", currentTokenId: null, targetedIds: [] };
const GM: SceneViewContext = { isGM: true, characterActorId: null, currentTokenId: null, targetedIds: [] };

describe("buildSceneView", () => {
  it("maps fields and converts grid units to px", () => {
    const v = buildSceneView(scene([token({ x: 100, y: 200, width: 2, height: 1 })]), DIMS, GM);
    expect(v.id).toBe("s1");
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

  it("shows HP only to the GM / owning player", () => {
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
    const v = buildSceneView(scene(ts), DIMS, { isGM: false, characterActorId: "hero", currentTokenId: "c1", targetedIds: [] });
    expect(v.tokens[0]).toMatchObject({ isMine: true, isCurrent: true });
    expect(v.tokens[1]).toMatchObject({ isMine: false, isCurrent: false });
  });

  it("flags targeted tokens from targetedIds", () => {
    const ts = [token({ id: "t1" }), token({ id: "t2" })];
    const v = buildSceneView(scene(ts), DIMS, { ...GM, targetedIds: ["t2"] });
    expect(v.tokens.map((t) => t.targeted)).toEqual([false, true]);
  });

  it("accepts scene.tokens as an array or a {contents} collection", () => {
    const arr = scene([token({ id: "a" })]);
    const coll = { id: "s1", background: { src: "bg.webp" }, tokens: { contents: [token({ id: "b" })] } } as unknown as SceneLike;
    expect(buildSceneView(arr, DIMS, GM).tokens[0].id).toBe("a");
    expect(buildSceneView(coll, DIMS, GM).tokens[0].id).toBe("b");
  });

  it("passes the scene grid info through", () => {
    const v = buildSceneView(
      { id: "s1", background: { src: "bg" }, grid: { type: 1, color: "#abcdef", alpha: 0.3, distance: 5 }, tokens: [] },
      DIMS,
      GM,
    );
    expect(v.grid).toEqual({ type: 1, color: "#abcdef", alpha: 0.3, distance: 5 });
  });

  it("handles an empty scene", () => {
    const v = buildSceneView(scene([]), DIMS, PLAYER);
    expect(v.tokens).toEqual([]);
    expect(v.hasScene).toBe(true);
  });
});
