import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { screenToScene, type ViewTransform } from "../../foundry/scene/geometry";

const MIN = 0.1;
const MAX = 8;
const clamp = (z: number) => Math.max(MIN, Math.min(MAX, z));

/** Full-screen pinch/pan image viewer for journal handouts/maps — the same gesture
 *  model as the battle map, on a single image. The ✕ closes; double-tap refits. */
export function ZoomableImage({ src, onClose }: { src: string; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [t, setT] = useState<ViewTransform>({ panX: 0, panY: 0, zoom: 1 });
  const tRef = useRef(t);
  const applyT = useCallback((n: ViewTransform) => {
    tRef.current = n;
    setT(n);
  }, []);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const anchor = useRef<{ x: number; y: number; dist: number } | null>(null);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    const nat = natural.current;
    if (!el || !nat || !nat.w || !nat.h) return;
    const zoom = Math.min(el.clientWidth / nat.w, el.clientHeight / nat.h);
    applyT({ zoom, panX: (el.clientWidth - nat.w * zoom) / 2, panY: (el.clientHeight - nat.h * zoom) / 2 });
  }, [applyT]);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (img) {
      natural.current = { w: img.naturalWidth, h: img.naturalHeight };
      fit();
    }
  };

  const local = (e: ReactPointerEvent) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const gesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dist: 0 };
    const [a, b] = pts;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, local(e));
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gesture();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !anchor.current) return;
    pointers.current.set(e.pointerId, local(e));
    const prev = anchor.current;
    const cur = gesture();
    const cur0 = tRef.current;
    if (pointers.current.size >= 2 && prev.dist > 0) {
      const nz = clamp(cur0.zoom * (cur.dist / prev.dist));
      const s = screenToScene(prev.x, prev.y, cur0);
      applyT({ zoom: nz, panX: cur.x - s.x * nz, panY: cur.y - s.y * nz });
    } else {
      applyT({ zoom: cur0.zoom, panX: cur0.panX + (cur.x - prev.x), panY: cur0.panY + (cur.y - prev.y) });
    }
    anchor.current = cur;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    anchor.current = pointers.current.size ? gesture() : null;
  };
  const wheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const r = viewportRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cur0 = tRef.current;
    const nz = clamp(cur0.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    const s = screenToScene(mx, my, cur0);
    applyT({ zoom: nz, panX: mx - s.x * nz, panY: my - s.y * nz });
  };

  return (
    <div className="fixed inset-0 z-[120000] bg-black/95">
      <button
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/80 text-white"
      >
        <i className="fas fa-xmark" aria-hidden="true" />
      </button>
      <div
        ref={viewportRef}
        className="h-full w-full touch-none overflow-hidden"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        onDoubleClick={fit}
      >
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={onImgLoad}
          className="max-w-none origin-top-left select-none"
          style={{ transform: `translate3d(${t.panX}px, ${t.panY}px, 0) scale(${t.zoom})` }}
        />
      </div>
    </div>
  );
}
