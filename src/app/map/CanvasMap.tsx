// src/app/map/CanvasMap.tsx
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenInfoPopup } from "./TokenInfoPopup";
import { useCanvasLifecycle } from "./useCanvasLifecycle";
import { panForDrag, panForFocalZoom, clampScale } from "../../foundry/canvas/view";
import { tokenIdAtScreenPoint } from "../../foundry/canvas/hitTest";
import { moveToken } from "../../foundry/scene/actions";
import { clearTargets } from "../../foundry/scene/targeting";
import { snapToCenter, measureDistance, type GridSpec, type Point } from "../../foundry/scene/ruler";
import { useFoundryHook } from "../useFoundryHook";

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
/** World (scene px) → screen (client px) via the stage transform; null if off. */
function screenAt(worldX: number, worldY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const g = cv.stage.toGlobal(P ? new P(worldX, worldY) : { x: worldX, y: worldY });
  return { x: g.x, y: g.y };
}

interface PressState {
  pointerId: number;
  tokenId: string | null;
  x: number; y: number; // press origin (client px)
  moved: boolean;
}

interface DragState {
  pointerId: number;
  id: string;
  offX: number; offY: number; // world offset from token origin to the grab point
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
  const dragRef = useRef<DragState | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [rulerMode, setRulerMode] = useState(false);
  const rulerModeRef = useRef(false);
  const [rulerLine, setRulerLine] = useState<{ a: Point; b: Point } | null>(null);
  const rulerRef = useRef<{ pointerId: number; a: Point; b: Point } | null>(null);
  // Bump on canvas pan so the screen-space ruler overlay re-projects with the view.
  const [, setPanTick] = useState(0);
  const onCanvasPan = useCallback(() => setPanTick((n) => n + 1), []);
  useFoundryHook("canvasPan", onCanvasPan);

  const gridSpec = (): GridSpec => {
    const cv = liveCanvas();
    const grid = cv?.scene?.grid;
    return { size: grid?.size ?? 100, distance: grid?.distance ?? 5, square: (grid?.type ?? 1) === 1 };
  };
  const toggleRuler = () => {
    const next = !rulerModeRef.current;
    rulerModeRef.current = next;
    setRulerMode(next);
    rulerRef.current = null;
    setRulerLine(null);
    if (next) setInfoId(null);
  };

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
    if (rulerModeRef.current) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        const p = snapToCenter(gridSpec(), w.x, w.y);
        rulerRef.current = { pointerId: e.pointerId, a: p, b: p };
        setRulerLine({ a: p, b: p });
        viewportRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
    // While a token drag is in progress, ignore any additional pointers so a
    // second finger can't overwrite the press/anchor state mid-drag.
    if (dragRef.current) return;
    const lp = localPoint(e);
    pressRef.current = {
      pointerId: e.pointerId,
      tokenId: tokenIdAtScreenPoint(e.clientX, e.clientY),
      x: e.clientX, y: e.clientY, moved: false,
    };
    // Start a token drag if the press landed on one of MY tokens (single pointer).
    const tokenId = pressRef.current.tokenId;
    const tok = tokenId && view ? view.tokens.find((t) => t.id === tokenId) : null;
    if (tok?.isMine && pointers.current.size === 0) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        dragRef.current = { pointerId: e.pointerId, id: tok.id, offX: w.x - tok.left, offY: w.y - tok.top };
        viewportRef.current?.setPointerCapture(e.pointerId);
        return; // a drag suppresses pan/pinch for this pointer
      }
    }
    pointers.current.set(e.pointerId, lp);
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gestureState();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = readPan();
    if (!pan) return;
    const r = rulerRef.current;
    if (r && r.pointerId === e.pointerId) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) { r.b = snapToCenter(gridSpec(), w.x, w.y); setRulerLine({ a: r.a, b: r.b }); }
      return;
    }
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const pr2 = pressRef.current;
      if (pr2 && !pr2.moved && Math.hypot(e.clientX - pr2.x, e.clientY - pr2.y) > TAP_SLOP) pr2.moved = true;
      return; // no live preview in v1; the canvas updates when the move round-trips
    }
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
    if (rulerRef.current && rulerRef.current.pointerId === e.pointerId) {
      rulerRef.current = null; // leave the measured line on screen
      return;
    }
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const moved = pressRef.current?.moved;
      if (moved && view) {
        const w = worldAt(e.clientX, e.clientY);
        if (w) void moveToken(view.id, d.id, w.x - d.offX, w.y - d.offY);
      }
      dragRef.current = null;
      if (pressRef.current?.pointerId === e.pointerId) pressRef.current = null;
      pointers.current.delete(e.pointerId);
      return; // a real drag is not a tap
    }
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
  const targetCount = view ? view.tokens.filter((tk) => tk.targeted).length : 0;
  const aScreen = rulerLine ? screenAt(rulerLine.a.x, rulerLine.a.y) : null;
  const bScreen = rulerLine ? screenAt(rulerLine.b.x, rulerLine.b.y) : null;
  const rulerMeas = rulerLine ? measureDistance(gridSpec(), rulerLine.a, rulerLine.b) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      />
      {aScreen && bScreen && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <line x1={aScreen.x} y1={aScreen.y} x2={bScreen.x} y2={bScreen.y} stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />
          <circle cx={aScreen.x} cy={aScreen.y} r={5} fill="#fbbf24" />
          <circle cx={bScreen.x} cy={bScreen.y} r={5} fill="#fbbf24" />
        </svg>
      )}
      {bScreen && rulerMeas && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow"
          style={{ left: bScreen.x, top: bScreen.y }}
        >
          {Math.round(rulerMeas.feet)} ft
        </div>
      )}
      {targetCount > 0 && (
        <button
          onClick={() => clearTargets()}
          className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white shadow"
        >
          <i className="fas fa-crosshairs" aria-hidden="true" />
          {targetCount} target{targetCount > 1 ? "s" : ""}
          <i className="fas fa-xmark" aria-hidden="true" />
        </button>
      )}
      <button
        onClick={toggleRuler}
        aria-pressed={rulerMode}
        className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow ${rulerMode ? "bg-amber-500 text-black" : "bg-zinc-800/90 text-zinc-200"}`}
        title={rulerMode ? "Exit ruler" : "Measure distance"}
      >
        <i className="fas fa-ruler" aria-hidden="true" />
      </button>
      {infoToken && <TokenInfoPopup token={infoToken} onClose={() => setInfoId(null)} />}
    </div>
  );
}
