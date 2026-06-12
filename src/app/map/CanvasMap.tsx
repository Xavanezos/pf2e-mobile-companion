// src/app/map/CanvasMap.tsx
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenInfoPopup } from "./TokenInfoPopup";
import { useCanvasLifecycle } from "./useCanvasLifecycle";
import { panForDrag, panForFocalZoom, clampScale } from "../../foundry/canvas/view";
import { tokenIdAtScreenPoint } from "../../foundry/canvas/hitTest";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const TAP_SLOP = 6;

function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}
/** Current canvas pan center (world) + scale, or null if the canvas isn't ready. */
function readPan(): { x: number; y: number; scale: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  return { x: cv.stage.pivot.x, y: cv.stage.pivot.y, scale: cv.stage.scale.x };
}
function applyPan(p: { x: number; y: number; scale: number }): void {
  liveCanvas()?.pan?.(p);
}
function screenCenter(): { x: number; y: number } {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
/** Screen (client px) → world (scene px) via the stage transform; null if off. */
function worldAt(clientX: number, clientY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const local = cv.stage.toLocal(P ? new P(clientX, clientY) : { x: clientX, y: clientY });
  return { x: local.x, y: local.y };
}

interface PressState {
  pointerId: number;
  tokenId: string | null;
  x: number; y: number; // press origin (client px)
  moved: boolean;
}

/** The Map tab's canvas renderer: a transparent input layer over Foundry's
 *  `#board`. Gestures drive `canvas.pan`; a tap opens the token info popup
 *  (→ targeting). The canvas itself draws the scene, walls, lighting, fog, and
 *  tokens natively. `useScene` supplies the popup's per-token display data. */
export function CanvasMap() {
  useCanvasLifecycle();
  const actorId = useAppStore((s) => s.actorId);
  const view = useScene(actorId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const anchor = useRef<{ x: number; y: number; dist: number } | null>(null);
  const pressRef = useRef<PressState | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);

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
  // Gesture midpoint (viewport-local) → window/client coords for focal-zoom math.
  const toClient = (lx: number, ly: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: lx + r.left, y: ly + r.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const lp = localPoint(e);
    pressRef.current = {
      pointerId: e.pointerId,
      tokenId: tokenIdAtScreenPoint(e.clientX, e.clientY),
      x: e.clientX, y: e.clientY, moved: false,
    };
    pointers.current.set(e.pointerId, lp);
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gestureState();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = readPan();
    if (!pan) return;
    const pr = pressRef.current;
    if (pr && pr.pointerId === e.pointerId && !pr.moved) {
      if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > TAP_SLOP) pr.moved = true;
    }
    if (!pointers.current.has(e.pointerId) || !anchor.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const prev = anchor.current;
    const cur = gestureState();
    if (pointers.current.size >= 2 && prev.dist > 0) {
      const newScale = clampScale(pan.scale * (cur.dist / prev.dist), MIN_ZOOM, MAX_ZOOM);
      const focal = toClient(cur.x, cur.y); // gesture midpoint in window coords
      const world = worldAt(focal.x, focal.y) ?? { x: pan.x, y: pan.y };
      const center = panForFocalZoom(world, focal, screenCenter(), newScale);
      applyPan({ x: center.x, y: center.y, scale: newScale });
    } else {
      const center = panForDrag(pan.x, pan.y, pan.scale, cur.x - prev.x, cur.y - prev.y);
      applyPan({ x: center.x, y: center.y, scale: pan.scale });
    }
    anchor.current = cur;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pr = pressRef.current;
    const isTap = !!pr && pr.pointerId === e.pointerId && !pr.moved && !!pr.tokenId;
    if (isTap && pr?.tokenId) setInfoId(pr.tokenId);
    pointers.current.delete(e.pointerId);
    anchor.current = pointers.current.size ? gestureState() : null;
    if (pr?.pointerId === e.pointerId) pressRef.current = null;
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const pan = readPan();
    if (!pan) return;
    const newScale = clampScale(pan.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM, MAX_ZOOM);
    const world = worldAt(e.clientX, e.clientY) ?? { x: pan.x, y: pan.y };
    const center = panForFocalZoom(world, { x: e.clientX, y: e.clientY }, screenCenter(), newScale);
    applyPan({ x: center.x, y: center.y, scale: newScale });
  };

  const infoToken = infoId && view ? view.tokens.find((tk) => tk.id === infoId) ?? null : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Transparent input layer over #board: captures all touches (so Foundry's
          native canvas interaction never competes) and drives canvas.pan. */}
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      />
      {infoToken && <TokenInfoPopup token={infoToken} onClose={() => setInfoId(null)} />}
    </div>
  );
}
