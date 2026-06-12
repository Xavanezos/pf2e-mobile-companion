import type {
  SceneDimensionsLike, SceneLike, SceneView, SceneViewContext, TokenLike, TokenView,
} from "./types";

/** Pure: build the player-facing battle-map view from the live active scene.
 *  Owns every visibility rule (GM-hidden + PF2e-secret tokens omitted for
 *  players, names blanked, NPC HP hidden) so the renderer owns none — the same
 *  discipline as `buildEncounterView`. `dims` is `scene.dimensions` (already
 *  canvas-free padded-canvas px); token `x`/`y` are in that same space, and
 *  `width`/`height` are grid units converted to px via `dims.size`. */
export function buildSceneView(
  scene: SceneLike,
  dims: SceneDimensionsLike,
  ctx: SceneViewContext,
): SceneView {
  const raw: TokenLike[] = Array.isArray(scene.tokens) ? scene.tokens : scene.tokens?.contents ?? [];
  const targeted = new Set(ctx.targetedIds);
  const tokens: TokenView[] = [];

  for (const t of raw) {
    if (!ctx.isGM && (t.hidden || t.isSecret === true)) continue; // players never see GM-hidden / secret

    const isMine = !!t.actor && t.actor.id === ctx.characterActorId;
    const canSeeHp = ctx.isGM || t.actor?.hasPlayerOwner === true;
    const hpRaw = t.actor?.system?.attributes?.hp;
    const hp =
      canSeeHp && hpRaw && typeof hpRaw.value === "number" && typeof hpRaw.max === "number"
        ? { value: hpRaw.value, max: hpRaw.max }
        : null;
    const canSeeName = ctx.isGM || t.playersCanSeeName === true;

    tokens.push({
      id: t.id,
      name: canSeeName ? t.name : "",
      img: t.texture?.src ?? null,
      left: t.x,
      top: t.y,
      width: t.width * dims.size,
      height: t.height * dims.size,
      isMine,
      isCurrent: t.id === ctx.currentTokenId,
      targeted: targeted.has(t.id),
      hidden: t.hidden,
      disposition: t.disposition ?? 0,
      hp,
    });
  }

  return { id: scene.id, background: scene.background?.src ?? null, dims, tokens, hasScene: true };
}
