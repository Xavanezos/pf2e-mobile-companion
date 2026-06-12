import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenSprite } from "./TokenSprite";
import { screenToScene, type ViewTransform } from "../../foundry/scene/geometry";
import { moveToken } from "../../foundry/scene/actions";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

interface DragState {
  pointerId: number;
  id: string;
  offX: number; // scene-space offset from the token origin to the grab point
  offY: number;
  left: number; // latest optimistic token origin (scene px)
  top: number;
}

/** The battle map: a transformed "stage" the size of the padded scene, holding
 *  the background image and one positioned token per visible token, over the live
 *  `game.scenes.active` documents (no PIXI canvas). One-finger pan, two-finger
 *  pinch-zoom (+ wheel for desktop), and drag-your-own-token to move it
 *  (`moveToken` → Foundry validates ownership server-side; the optimistic position
 *  is replaced by the snapped truth on the next `updateToken`). */
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

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const anchor = useRef<{ x: number; y: number; dist: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<{ id: string; left: number; top: number } | null>(null);

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
  const gestureState = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dist: 0 };
    const [a, b] = pts;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return; // ignore extra pointers mid-drag
    const lp = localPoint(e);
    const cur0 = tRef.current;
    // Start a token drag if the press landed on one of MY tokens (single pointer).
    const tokenEl = (e.target as HTMLElement).closest("[data-token-id]") as HTMLElement | null;
    if (tokenEl?.dataset.mine && cur0 && view && pointers.current.size === 0) {
      const id = tokenEl.dataset.tokenId!;
      const tok = view.tokens.find((tk) => tk.id === id);
      if (tok) {
        const sp = screenToScene(lp.x, lp.y, cur0);
        dragRef.current = { pointerId: e.pointerId, id, offX: sp.x - tok.left, offY: sp.y - tok.top, left: tok.left, top: tok.top };
        setDrag({ id, left: tok.left, top: tok.top });
        viewportRef.current?.setPointerCapture(e.pointerId);
        return;
      }
    }
    // Otherwise pan / pinch.
    pointers.current.set(e.pointerId, lp);
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gestureState();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cur0 = tRef.current;
    if (!cur0) return;
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const lp = localPoint(e);
      const sp = screenToScene(lp.x, lp.y, cur0);
      d.left = sp.x - d.offX;
      d.top = sp.y - d.offY;
      setDrag({ id: d.id, left: d.left, top: d.top });
      return;
    }
    if (!pointers.current.has(e.pointerId) || !anchor.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const prev = anchor.current;
    const cur = gestureState();
    if (pointers.current.size >= 2 && prev.dist > 0) {
      const newZoom = clampZoom(cur0.zoom * (cur.dist / prev.dist));
      const s = screenToScene(prev.x, prev.y, cur0);
      applyT({ zoom: newZoom, panX: cur.x - s.x * newZoom, panY: cur.y - s.y * newZoom });
    } else {
      applyT({ zoom: cur0.zoom, panX: cur0.panX + (cur.x - prev.x), panY: cur0.panY + (cur.y - prev.y) });
    }
    anchor.current = cur;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      if (view) void moveToken(view.id, d.id, d.left, d.top);
      dragRef.current = null;
      setDrag(null);
      return;
    }
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
          {view.tokens.map((tok) => {
            const dragging = drag?.id === tok.id;
            const shown = dragging && drag ? { ...tok, left: drag.left, top: drag.top } : tok;
            return <TokenSprite key={tok.id} token={shown} showLabel={showLabels} dragging={dragging} />;
          })}
        </div>
      )}
    </div>
  );
}
