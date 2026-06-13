// Token targeting for Foundry v14 + PF2e v8.2, in BOTH map modes.
//
// Canvas mode (real `#board` up): we drive Foundry's NATIVE `Token#setTarget` on
// the live placeable. It sets `token.targeted`, draws the reticle, and broadcasts
// — and crucially puts REAL `Token` objects in `game.user.targets`. Adding a fake
// stand-in there instead crashes the canvas's native reticle render loop (it runs
// in the PIXI ticker, outside any try/catch, and dereferences `.object` / PIXI
// internals on each target). The `sceneId` handshake below is unneeded here: in
// canvas mode our `viewedScene` is set, so the GM honors the broadcast.
//
// Lite / no-canvas mode: `setTarget` no-ops (it's canvas-bound) and there is no
// placeable, so we drive the two canvas-FREE primitives directly (both
// source-verified against Foundry 14.364):
//   • game.user.targets.add/delete/clear — pure Set ops + a `targetToken` hook.
//     Populating this makes strikes/spells rolled FROM mobile resolve vs the
//     target's AC: PF2e reads only `target.document` / `target.actor` (actor data),
//     and guards all distance/flanking geometry on `target.object` (absent here).
//   • game.user.broadcastActivity({ sceneId, targets }) — no canvas guard; the
//     GM's canvas turns the broadcast token ids into reticles. The `sceneId` is
//     MANDATORY: without it the GM clears our targets (our `viewedScene` stays
//     null on its copy → users.mjs scene-match guard).

import { isCanvasReady } from "../canvas/lifecycle";

interface TokenStandIn {
  id: string;
  document: unknown;
  actor: unknown;
  scene: unknown;
}

function activeScene(): any {
  return (game as any)?.scenes?.active ?? null;
}

/** A PF2e-compatible target stand-in built from a token id on the active scene.
 *  PF2e reads `.document`/`.actor`; we omit `object` so its geometry stays dormant. */
function standInFor(scene: any, tokenId: string): TokenStandIn | null {
  const doc = scene?.tokens?.get(tokenId);
  if (!doc) return null;
  return { id: doc.id, document: doc, actor: doc.actor, scene: doc.parent };
}

function guard(run: () => void): void {
  try {
    run();
  } catch (err) {
    console.error("[pf2e-mobile] targeting failed", err);
    (ui as any)?.notifications?.error?.("Targeting failed — see console.");
  }
}

/** Current target token ids (from `game.user.targets`). */
export function getTargetIds(): string[] {
  return ((game as any)?.user?.targets?.ids ?? []) as string[];
}

/** Set the user's targets to exactly `tokenIds` (ids of tokens on the active
 *  scene). Updates `game.user.targets` locally (so mobile rolls hit the target)
 *  and broadcasts to the table (so the GM sees reticles). Ids not on the active
 *  scene are dropped. */
export function setTargets(tokenIds: string[]): void {
  guard(() => {
    const user = (game as any)?.user;
    const scene = activeScene();
    if (!user?.targets || !scene) return;
    const desired = new Set(tokenIds.filter((id) => scene.tokens?.get(id)));

    // Canvas mode: native setTarget on the real placeables (reticle + broadcast).
    // Putting a stand-in in game.user.targets here would crash the reticle loop.
    if (isCanvasReady()) {
      for (const t of Array.from(user.targets as Set<any>)) {
        if (!desired.has((t as any).id)) (t as any).setTarget?.(false, { releaseOthers: false });
      }
      for (const id of desired) {
        scene.tokens?.get(id)?.object?.setTarget?.(true, { releaseOthers: false });
      }
      return;
    }

    // Lite / no-canvas: drive the canvas-free primitives with a stand-in.
    const targets = user.targets as Set<any> & { add(x: unknown): unknown; delete(x: unknown): boolean };
    // Remove stale targets (delete = Set.delete + targetToken hook).
    for (const existing of Array.from(targets)) {
      if (!desired.has((existing as any).id)) targets.delete(existing);
    }
    // Add new ones not already present by id (add = Set.add + targetToken hook).
    const present = new Set(Array.from(targets).map((t: any) => t.id));
    for (const id of desired) {
      if (present.has(id)) continue;
      const standIn = standInFor(scene, id);
      if (standIn) targets.add(standIn);
    }

    // Broadcast — sceneId is required so the GM honors (doesn't clear) our targets.
    user.broadcastActivity?.({ sceneId: scene.id, targets: Array.from(desired) });
  });
}

/** Toggle one token id in the current target set (multi-target friendly). */
export function toggleTarget(tokenId: string): void {
  const ids = new Set(getTargetIds());
  if (ids.has(tokenId)) ids.delete(tokenId);
  else ids.add(tokenId);
  setTargets(Array.from(ids));
}

/** Clear all targets (local + broadcast). */
export function clearTargets(): void {
  guard(() => {
    const user = (game as any)?.user;
    if (!user?.targets) return;
    // Canvas mode: untarget each real placeable (clears its reticle + broadcasts).
    if (isCanvasReady()) {
      for (const t of Array.from(user.targets as Set<any>)) {
        (t as any).setTarget?.(false, { releaseOthers: false });
      }
      return;
    }
    (user.targets as any).clear?.();
    user.broadcastActivity?.({ sceneId: activeScene()?.id ?? null, targets: [] });
  });
}
