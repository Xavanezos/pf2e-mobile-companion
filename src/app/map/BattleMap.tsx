import { useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenSprite } from "./TokenSprite";
import type { ViewTransform } from "../../foundry/scene/geometry";

/** The battle map: a transformed "stage" the size of the padded scene, holding
 *  the background image and one positioned token per visible token. Static this
 *  task — fits the scene into the viewport on mount / scene change; pan/zoom and
 *  drag-to-move arrive in later tasks. No PIXI canvas: it draws DOM over the live
 *  `game.scenes.active` documents (canvas stays disabled). */
export function BattleMap() {
  const actorId = useAppStore((s) => s.actorId);
  const view = useScene(actorId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<ViewTransform | null>(null);

  // Fit the whole scene into the viewport once we know both sizes (and refit when
  // the active scene's dimensions change).
  const dimsKey = view ? `${view.dims.width}x${view.dims.height}` : "none";
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || !view) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (!vw || !vh) return;
    const zoom = Math.min(vw / view.dims.width, vh / view.dims.height);
    setT({
      zoom,
      panX: (vw - view.dims.width * zoom) / 2,
      panY: (vh - view.dims.height * zoom) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimsKey]);

  if (!view) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-map text-3xl" aria-hidden="true" />
        <div className="text-sm">No active scene.</div>
      </div>
    );
  }

  const showLabels = !!t && t.zoom >= 0.35;

  return (
    <div ref={viewportRef} className="relative h-full w-full touch-none overflow-hidden bg-black">
      {t && (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: view.dims.width,
            height: view.dims.height,
            transform: `translate3d(${t.panX}px, ${t.panY}px, 0) scale(${t.zoom})`,
          }}
        >
          {view.background && (
            <img
              src={view.background}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                left: view.dims.sceneX,
                top: view.dims.sceneY,
                width: view.dims.sceneWidth,
                height: view.dims.sceneHeight,
              }}
            />
          )}
          {view.tokens.map((tok) => (
            <TokenSprite key={tok.id} token={tok} showLabel={showLabels} />
          ))}
        </div>
      )}
    </div>
  );
}
