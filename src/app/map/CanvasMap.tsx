import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenInfoPopup } from "./TokenInfoPopup";
import { useCanvasLifecycle } from "./useCanvasLifecycle";
import { panForDrag, panForFocalZoom, clampScale } from "../../foundry/canvas/view";
import { tokenIdsAtScreenPoint, liveTokenOrigin } from "../../foundry/canvas/hitTest";
import { moveToken } from "../../foundry/scene/actions";
import { clearTargets } from "../../foundry/scene/targeting";
import { releaseControlledTokens, toggleDoorAt } from "../../foundry/canvas/control";
import { snapToCenter, snapTopLeft, measureDistance, type GridSpec, type Point } from "../../foundry/scene/ruler";
import { useFoundryHook } from "../useFoundryHook";
import { liveCanvas, readPan, applyPan, screenCenter, worldAt, screenAt } from "./canvasAccess";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const TAP_SLOP = 6;

interface PressState {
  pointerId: number;
  tokenId: string | null;
  x: number; y: number; // press origin (client px)
  moved: boolean;
}

interface DragState {
  pointerId: number;
  id: string;
  offX: number; offY: number;       // world offset from token origin to the grab point
  startLeft: number; startTop: number; // origin at drag start (drag-ruler anchor)
  left: number; top: number;        // current grid-snapped origin (world px)
  footprintW: number; footprintH: number; // grid footprint (world px), for centre + ghost
}

/** Live drag feedback projected into the overlay: the grid-snapped target cell
 *  and a centre-to-centre drag ruler (square grids only). */
interface DragPreview {
  left: number; top: number; w: number; h: number; // snapped footprint, world px
  a: Point | null; b: Point | null;                // ruler endpoints (centres), world px
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
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
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
  // World → overlay-local (px). `screenAt` returns WINDOW client px (the canvas
  // fills the window), but the SVG/label overlays live inside this container,
  // which sits below the app header — so subtract the container's offset or every
  // overlay (ruler + drag) draws shifted down by the header height.
  const overlayAt = (worldX: number, worldY: number): { x: number; y: number } | null => {
    const g = screenAt(worldX, worldY);
    if (!g) return null;
    const r = viewportRef.current?.getBoundingClientRect();
    return r ? { x: g.x - r.left, y: g.y - r.top } : g;
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
    // Full z-stack under the press: a tap targets the TOPMOST token (an enemy on
    // top is still tappable for its info/target popup), but a drag grabs the
    // topmost token that's MINE — so I can move my token out from under an enemy.
    const ids = tokenIdsAtScreenPoint(e.clientX, e.clientY);
    const topmost = ids.length ? ids[ids.length - 1] : null;
    pressRef.current = { pointerId: e.pointerId, tokenId: topmost, x: e.clientX, y: e.clientY, moved: false };
    const mineId = view
      ? [...ids].reverse().find((id) => view.tokens.find((t) => t.id === id)?.isMine) ?? null
      : null;
    const tok = mineId ? view!.tokens.find((t) => t.id === mineId)! : null;
    // Start a token drag if the press landed on one of MY tokens (single pointer).
    if (tok && pointers.current.size === 0) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        // Anchor the drag to the token's LIVE origin, not view's render snapshot:
        // the snapshot only refreshes on the updateToken re-prep and can lag a
        // move behind, which would offset the grab + drag-ruler to the PREVIOUS
        // cell. Footprint/identity still come from the prepared view.
        const origin = liveTokenOrigin(tok.id) ?? { left: tok.left, top: tok.top };
        dragRef.current = {
          pointerId: e.pointerId, id: tok.id,
          offX: w.x - origin.left, offY: w.y - origin.top,
          startLeft: origin.left, startTop: origin.top,
          left: origin.left, top: origin.top,
          footprintW: tok.footprintW, footprintH: tok.footprintH,
        };
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
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        const grid = gridSpec();
        // snapTopLeft is a no-op off a square grid → the cell follows the finger.
        const snapped = snapTopLeft(grid, w.x - d.offX, w.y - d.offY);
        d.left = snapped.x; d.top = snapped.y;
        // Drag ruler is centre-to-centre, square grids only (snapToCenter is a
        // no-op otherwise, so a == b and the line would be hidden).
        const a = grid.square ? { x: d.startLeft + d.footprintW / 2, y: d.startTop + d.footprintH / 2 } : null;
        const b = grid.square ? { x: d.left + d.footprintW / 2, y: d.top + d.footprintH / 2 } : null;
        setDragPreview({ left: d.left, top: d.top, w: d.footprintW, h: d.footprintH, a, b });
      }
      return; // the real token updates when the move round-trips on drop
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
      // Commit at the SNAPPED cell shown by the preview (moveToken re-snaps too).
      if (moved && view) void moveToken(view.id, d.id, d.left, d.top);
      // A tap on my token (no movement) opens the topmost token's info popup.
      else if (pressRef.current?.tokenId) setInfoId(pressRef.current.tokenId);
      dragRef.current = null;
      setDragPreview(null);
      if (pressRef.current?.pointerId === e.pointerId) pressRef.current = null;
      pointers.current.delete(e.pointerId);
      return; // a real drag is not a tap
    }
    const pr = pressRef.current;
    const isTap = !!pr && pr.pointerId === e.pointerId && !pr.moved;
    if (isTap) {
      if (pr!.tokenId) {
        setInfoId(pr!.tokenId); // tap a token → info/target popup
      } else {
        // Tap on empty space: operate a door under the tap; otherwise mirror
        // Foundry's left-click-empty by releasing the token selection.
        const w = worldAt(e.clientX, e.clientY);
        const hitDoor = w ? toggleDoorAt(w.x, w.y) : false;
        if (!hitDoor) {
          releaseControlledTokens();
          setInfoId(null);
        }
      }
    }
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
  const aScreen = rulerLine ? overlayAt(rulerLine.a.x, rulerLine.a.y) : null;
  const bScreen = rulerLine ? overlayAt(rulerLine.b.x, rulerLine.b.y) : null;
  const rulerMeas = rulerLine ? measureDistance(gridSpec(), rulerLine.a, rulerLine.b) : null;

  // Live token-drag overlay: the snapped target cell + a centre-to-centre ruler.
  const dragTL = dragPreview ? overlayAt(dragPreview.left, dragPreview.top) : null;
  const dragBR = dragPreview ? overlayAt(dragPreview.left + dragPreview.w, dragPreview.top + dragPreview.h) : null;
  const dragA = dragPreview?.a ? overlayAt(dragPreview.a.x, dragPreview.a.y) : null;
  const dragB = dragPreview?.b ? overlayAt(dragPreview.b.x, dragPreview.b.y) : null;
  const dragMeas = dragPreview?.a && dragPreview?.b ? measureDistance(gridSpec(), dragPreview.a, dragPreview.b) : null;

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
      {dragTL && dragBR && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <rect
            x={Math.min(dragTL.x, dragBR.x)} y={Math.min(dragTL.y, dragBR.y)}
            width={Math.abs(dragBR.x - dragTL.x)} height={Math.abs(dragBR.y - dragTL.y)}
            fill="rgba(129,140,248,0.25)" stroke="#818cf8" strokeWidth={2}
          />
          {dragA && dragB && (
            <>
              <line x1={dragA.x} y1={dragA.y} x2={dragB.x} y2={dragB.y} stroke="#818cf8" strokeWidth={3} strokeLinecap="round" />
              <circle cx={dragA.x} cy={dragA.y} r={5} fill="#818cf8" />
              <circle cx={dragB.x} cy={dragB.y} r={5} fill="#818cf8" />
            </>
          )}
        </svg>
      )}
      {dragB && dragMeas && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] rounded bg-indigo-500 px-2 py-0.5 text-xs font-bold text-white shadow"
          style={{ left: dragB.x, top: dragB.y }}
        >
          {Math.round(dragMeas.feet)} ft
        </div>
      )}
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
