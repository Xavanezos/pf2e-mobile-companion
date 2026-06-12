import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenSprite } from "./TokenSprite";
import { TokenInfoPopup } from "./TokenInfoPopup";
import { screenToScene, sceneToScreen, type ViewTransform } from "../../foundry/scene/geometry";
import { moveToken } from "../../foundry/scene/actions";
import { clearTargets } from "../../foundry/scene/targeting";
import { snapToCenter, snapTopLeft, measureDistance, type GridSpec, type Point } from "../../foundry/scene/ruler";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const TAP_SLOP = 6; // px of screen movement under which a press counts as a tap, not a drag/pan
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

interface DragState {
  pointerId: number;
  id: string;
  offX: number; // scene-space offset from the token origin to the grab point
  offY: number;
  left: number; // latest optimistic token origin (scene px), grid-snapped
  top: number;
  startLeft: number; // token origin at drag start (ruler anchor)
  startTop: number;
  footprintW: number; // grid footprint (for centre = origin + footprint/2)
  footprintH: number;
}
interface PressState {
  pointerId: number;
  tokenId: string | null; // token the press landed on, if any
  x: number;
  y: number; // press origin (screen px)
  moved: boolean;
}

/** The battle map: a transformed "stage" the size of the padded scene, holding
 *  the background image and one positioned token per visible token, over the live
 *  `game.scenes.active` documents (no PIXI canvas). One-finger pan, two-finger
 *  pinch-zoom (+ wheel for desktop), drag-your-own-token to move it (`moveToken`,
 *  server-validated), and tap-a-token for an info popup. */
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
  const pressRef = useRef<PressState | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    left: number;
    top: number;
    a: Point | null; // drag-ruler start centre (null when no square grid)
    b: Point | null; // drag-ruler current centre
  } | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);

  // Ruler mode: while on, one-finger drag measures A→B and pan/pinch/token-drag/
  // tap are all suspended. `rulerModeRef`/`rulerRef` mirror the state for the live
  // pointer handlers (same pattern as `tRef`/`dragRef`); the line stays on screen
  // after the drag and is cleared by toggling the mode off.
  const [rulerMode, setRulerMode] = useState(false);
  const rulerModeRef = useRef(false);
  const [rulerLine, setRulerLine] = useState<{ a: Point; b: Point } | null>(null);
  const rulerRef = useRef<{ pointerId: number; a: Point; b: Point } | null>(null);
  const toggleRuler = useCallback(() => {
    const next = !rulerModeRef.current;
    rulerModeRef.current = next;
    setRulerMode(next);
    rulerRef.current = null;
    setRulerLine(null);
    if (next) setInfoId(null); // measuring closes any open info popup
  }, []);

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
  // Live grid for the ruler — only called from handlers/render where `view` is set.
  const gridSpec = (): GridSpec => ({
    size: view!.dims.size,
    distance: view!.grid?.distance ?? 5,
    square: (view!.grid?.type ?? 1) === 1,
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cur0r = tRef.current;
    // Ruler mode replaces all other gestures: drop the start point and capture.
    if (rulerModeRef.current && cur0r && view) {
      const lp0 = localPoint(e);
      const sp = screenToScene(lp0.x, lp0.y, cur0r);
      const p = snapToCenter(gridSpec(), sp.x, sp.y);
      rulerRef.current = { pointerId: e.pointerId, a: p, b: p };
      setRulerLine({ a: p, b: p });
      viewportRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (dragRef.current) return; // ignore extra pointers mid-drag
    const lp = localPoint(e);
    const cur0 = tRef.current;
    const tokenEl = (e.target as HTMLElement).closest("[data-token-id]") as HTMLElement | null;
    pressRef.current = { pointerId: e.pointerId, tokenId: tokenEl?.dataset.tokenId ?? null, x: lp.x, y: lp.y, moved: false };

    // Start a token drag if the press landed on one of MY tokens (single pointer).
    if (tokenEl?.dataset.mine && cur0 && view && pointers.current.size === 0) {
      const id = tokenEl.dataset.tokenId!;
      const tok = view.tokens.find((tk) => tk.id === id);
      if (tok) {
        const sp = screenToScene(lp.x, lp.y, cur0);
        dragRef.current = {
          pointerId: e.pointerId,
          id,
          offX: sp.x - tok.left,
          offY: sp.y - tok.top,
          left: tok.left,
          top: tok.top,
          startLeft: tok.left,
          startTop: tok.top,
          footprintW: tok.footprintW,
          footprintH: tok.footprintH,
        };
        setDrag({ id, left: tok.left, top: tok.top, a: null, b: null });
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
    const r = rulerRef.current;
    if (r && r.pointerId === e.pointerId && view) {
      const lp = localPoint(e);
      const sp = screenToScene(lp.x, lp.y, cur0);
      r.b = snapToCenter(gridSpec(), sp.x, sp.y);
      setRulerLine({ a: r.a, b: r.b });
      return;
    }
    const pr = pressRef.current;
    if (pr && pr.pointerId === e.pointerId && !pr.moved) {
      const lp = localPoint(e);
      if (Math.hypot(lp.x - pr.x, lp.y - pr.y) > TAP_SLOP) pr.moved = true;
    }
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId && view) {
      const lp = localPoint(e);
      const sp = screenToScene(lp.x, lp.y, cur0);
      const grid = gridSpec();
      // snapTopLeft is a no-op off a square grid → token follows the finger.
      const snapped = snapTopLeft(grid, sp.x - d.offX, sp.y - d.offY);
      d.left = snapped.x;
      d.top = snapped.y;
      // Drag ruler: centre-to-centre, square grids only (snapToCenter is a
      // no-op otherwise, which would make a == b and hide the line).
      let a: Point | null = null;
      let b: Point | null = null;
      if (grid.square) {
        a = { x: d.startLeft + d.footprintW / 2, y: d.startTop + d.footprintH / 2 };
        b = { x: d.left + d.footprintW / 2, y: d.top + d.footprintH / 2 };
      }
      setDrag({ id: d.id, left: d.left, top: d.top, a, b });
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
    const r = rulerRef.current;
    if (r && r.pointerId === e.pointerId) {
      rulerRef.current = null; // leave the measured line on screen
      return;
    }
    const pr = pressRef.current;
    const isTap = !!pr && pr.pointerId === e.pointerId && !pr.moved && !!pr.tokenId;
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      if (!isTap && view) void moveToken(view.id, d.id, d.left, d.top); // a real drag moves; a tap doesn't
      dragRef.current = null;
      setDrag(null);
    } else {
      pointers.current.delete(e.pointerId);
      anchor.current = pointers.current.size ? gestureState() : null;
    }
    if (isTap && pr?.tokenId) setInfoId(pr.tokenId);
    if (pr?.pointerId === e.pointerId) pressRef.current = null;
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
  const infoToken = infoId ? view.tokens.find((tk) => tk.id === infoId) ?? null : null;
  const targetCount = view.tokens.filter((tk) => tk.targeted).length;
  // Grid line width in scene px that renders ~1px on screen at the current zoom
  // (the grid lives inside the scaled stage, so a fixed 1px would vanish when zoomed out).
  const gridLine = t ? Math.max(1, 1 / t.zoom) : 1;
  // Ruler render: keep the stroke/dots ~constant on screen (they live in the scaled
  // stage); the "ft" label is a viewport sibling positioned in screen px so its font
  // never scales with zoom.
  const z = t?.zoom ?? 1;
  // One ruler render path: measure-mode line, or the live token-drag line (the
  // two never coexist — ruler-mode suspends token dragging).
  const activeRuler =
    rulerLine ?? (drag?.a && drag?.b ? { a: drag.a, b: drag.b } : null);
  const rulerMeas = activeRuler ? measureDistance(gridSpec(), activeRuler.a, activeRuler.b) : null;
  const rulerLabel = activeRuler && t ? sceneToScreen(activeRuler.b.x, activeRuler.b.y, t) : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
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
            {view.grid && view.grid.type === 1 && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: view.dims.sceneX,
                  top: view.dims.sceneY,
                  width: view.dims.sceneWidth,
                  height: view.dims.sceneHeight,
                  // White lines + difference blend stay visible on any map (most scenes
                  // leave the grid color black, which vanishes on a dark battle map).
                  opacity: Math.max(view.grid.alpha, 0.4),
                  mixBlendMode: "difference",
                  backgroundImage: `repeating-linear-gradient(to right, #fff 0 ${gridLine}px, transparent ${gridLine}px ${view.dims.size}px), repeating-linear-gradient(to bottom, #fff 0 ${gridLine}px, transparent ${gridLine}px ${view.dims.size}px)`,
                }}
              />
            )}
            {view.tokens.map((tok) => {
              const dragging = drag?.id === tok.id;
              const shown = dragging && drag ? { ...tok, left: drag.left, top: drag.top } : tok;
              return <TokenSprite key={tok.id} token={shown} showLabel={showLabels} dragging={dragging} />;
            })}
            {activeRuler && (
              <svg
                className="pointer-events-none absolute left-0 top-0 overflow-visible"
                width={view.dims.width}
                height={view.dims.height}
              >
                <line
                  x1={activeRuler.a.x}
                  y1={activeRuler.a.y}
                  x2={activeRuler.b.x}
                  y2={activeRuler.b.y}
                  stroke="#fbbf24"
                  strokeWidth={Math.max(2, 3 / z)}
                  strokeLinecap="round"
                />
                <circle cx={activeRuler.a.x} cy={activeRuler.a.y} r={Math.max(3, 5 / z)} fill="#fbbf24" />
                <circle cx={activeRuler.b.x} cy={activeRuler.b.y} r={Math.max(3, 5 / z)} fill="#fbbf24" />
              </svg>
            )}
          </div>
        )}
      </div>
      {/* Overlays are SIBLINGS of the pointer-capturing viewport so their taps
          aren't stolen by the map's setPointerCapture. */}
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
      {/* Ruler toggle (bottom-right, thumb-reachable) — sibling of the viewport so
          the map's setPointerCapture can't steal its tap. */}
      <button
        onClick={toggleRuler}
        aria-pressed={rulerMode}
        className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow ${
          rulerMode ? "bg-amber-500 text-black" : "bg-zinc-800/90 text-zinc-200"
        }`}
        title={rulerMode ? "Exit ruler" : "Measure distance"}
      >
        <i className="fas fa-ruler" aria-hidden="true" />
      </button>
      {/* Live distance label, positioned in screen px above the moving endpoint. */}
      {rulerLabel && rulerMeas && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow"
          style={{ left: rulerLabel.px, top: rulerLabel.py }}
        >
          {Math.round(rulerMeas.feet)} ft
        </div>
      )}
      {infoToken && <TokenInfoPopup token={infoToken} onClose={() => setInfoId(null)} />}
    </div>
  );
}
