import type {
  SceneDimensionsLike, SceneLike, SceneView, SceneViewContext, TokenLike, TokenView,
} from "./types";
import type { ConditionView, EffectView, ConditionLike, EffectLike } from "../actor/types";
import { effectBadgeLabel } from "../actor/view";

/** PF2e creature size → grid cells the token's art should span. Large/Huge/Gargantuan
 *  match their multi-cell footprint; tiny/small render smaller than their 1-cell
 *  footprint (and get centred in it by the sprite). Tokens with no PF2e size (loot,
 *  hazards, generic) fall back to the token's own grid width/height. */
const SIZE_CELLS: Record<string, number> = { tiny: 0.25, sm: 0.5, med: 1, lg: 2, huge: 3, grg: 4 };

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
    const canIdentifyEffects = ctx.isGM || t.actor?.isOwner === true;
    const conditions = mapTokenConditions(t.actor?.conditions?.active ?? []);
    const effects = mapTokenEffects(t.actor?.itemTypes?.effect ?? [], canIdentifyEffects);

    // Visible art size from PF2e creature size; the grid footprint stays the token's
    // own width/height so sub-cell tokens (tiny/small) can be centred in their cell.
    const sizeKey = t.actor?.system?.traits?.size?.value;
    const cells = sizeKey != null ? SIZE_CELLS[sizeKey] : undefined;

    tokens.push({
      id: t.id,
      name: canSeeName ? t.name : "",
      img: t.texture?.src ?? null,
      left: t.x,
      top: t.y,
      width: (cells ?? t.width) * dims.size,
      height: (cells ?? t.height) * dims.size,
      footprintW: t.width * dims.size,
      footprintH: t.height * dims.size,
      scaleX: t.texture?.scaleX ?? 1,
      scaleY: t.texture?.scaleY ?? 1,
      isMine,
      isCurrent: t.id === ctx.currentTokenId,
      targeted: targeted.has(t.id),
      hidden: t.hidden,
      disposition: t.disposition ?? 0,
      hp,
      conditions,
      effects,
    });
  }

  return { id: scene.id, background: scene.background?.src ?? null, grid: scene.grid ?? null, dims, tokens, hasScene: true };
}

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
