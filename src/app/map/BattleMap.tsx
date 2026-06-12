import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenSprite } from "./TokenSprite";
import { screenToScene, type ViewTransform } from "../../foundry/scene/geometry";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** The battle map: a transformed "stage" the size of the padded scene, holding
 *  the background image and one positioned token per visible token, over the live
 *  `game.scenes.active` documents (no PIXI canvas). Supports one-finger pan and
 *  two-finger pinch-zoom (and wheel-zoom for desktop testing); drag-to-move and
 *  tap-for-info arrive in later tasks. */
export function BattleMap() {
  const actorId = useAppStore((s) => s.actorId);
  const view = useScene(actorId);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<ViewTransform | null>(null);
  const tRef = useRef<ViewTransform | null>(null);
  const applyT = useCallback((next: ViewTransform) => {
    tRef.current = next;
    setT(next);
  }, []);

  // Active pointers + the current gesture anchor (last midpoint + pinch distance).
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const anchor = useRef<{ x: number; y: number; dist: number } | null>(null);

  // Fit the whole scene into the viewport on mount / scene-dimension change.
  const dimsKey = view ? `${view.dims.width}x${view.dims.height}` : "none";
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || !view) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (!vw || !vh) return;
    const zoom = Math.min(vw / view.dims.width, vh / view.dims.height);
    applyT({ zoom, panX: (vw - view.dims.width * zoom) / 2, panY: (vh - view.dims.height * zoom) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimsKey]);

  const localPoint = (e: ReactPointerEvent) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** Midpoint + finger-distance of the currently-down pointers (dist 0 for one). */
  const gestureState = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dist: 0 };
    const [a, b] = pts;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, localPoint(e));
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gestureState();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cur0 = tRef.current;
    if (!pointers.current.has(e.pointerId) || !cur0 || !anchor.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const prev = anchor.current;
    const cur = gestureState();
    if (pointers.current.size >= 2 && prev.dist > 0) {
      // Pinch: scale around the midpoint, keeping the scene point under the old
      // midpoint fixed under the new one (handles two-finger pan + zoom together).
      const newZoom = clampZoom(cur0.zoom * (cur.dist / prev.dist));
      const s = screenToScene(prev.x, prev.y, cur0);
      applyT({ zoom: newZoom, panX: cur.x - s.x * newZoom, panY: cur.y - s.y * newZoom });
    } else {
      // Pan by the pointer delta.
      applyT({ zoom: cur0.zoom, panX: cur0.panX + (cur.x - prev.x), panY: cur0.panY + (cur.y - prev.y) });
    }
    anchor.current = cur;
  };
  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    anchor.current = pointers.current.size ? gestureState() : null;
  };
  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const cur0 = tRef.current;
    if (!cur0) return;
    const r = viewportRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const newZoom = clampZoom(cur0.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    const s = screenToScene(mx, my, cur0);
    applyT({ zoom: newZoom, panX: mx - s.x * newZoom, panY: my - s.y * newZoom });
  };

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
    <div
      ref={viewportRef}
      className="relative h-full w-full touch-none overflow-hidden bg-black"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
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
