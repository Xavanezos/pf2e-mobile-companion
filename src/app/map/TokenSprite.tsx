import type { TokenView } from "../../foundry/scene/types";

/** Disposition → ring color (PF2e already remaps disposition from alliance, so
 *  this is correct friend/foe coloring). */
const DISPO_RING: Record<number, string> = {
  1: "ring-sky-400", // friendly
  0: "ring-amber-400", // neutral
  [-1]: "ring-rose-500", // hostile
  [-2]: "ring-fuchsia-500", // secret (GM only)
};

/** One token positioned over the background, sized in scene px (the parent stage
 *  applies the pan/zoom transform). Current-turn token gets a pulsing indigo ring;
 *  others get a disposition-tinted ring. `data-token-id` / `data-mine` let the map
 *  hit-test pointer events for drag/tap. HP bar + nameplate show below the
 *  portrait; the nameplate is gated by zoom (`showLabel`). Uses bg/ring, never
 *  `border` (Tailwind-v4 reset gotcha). */
export function TokenSprite({
  token,
  showLabel,
  dragging,
}: {
  token: TokenView;
  showLabel: boolean;
  dragging?: boolean;
}) {
  const ring = token.isCurrent
    ? "ring-4 ring-indigo-300"
    : `ring-2 ${DISPO_RING[token.disposition] ?? "ring-zinc-400"}`;
  const hpPct = token.hp && token.hp.max > 0
    ? Math.max(0, Math.min(100, (token.hp.value / token.hp.max) * 100))
    : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-500";

  // Conditions first, then effects; combine, cap at 4 slots, show "+N" when more.
  const statuses: { key: string; img: string | null; value: number | null }[] = [
    ...token.conditions.map((c) => ({ key: `c-${c.slug}`, img: c.img ?? null, value: c.value })),
    ...token.effects.map((e, i) => ({ key: `e-${e.id ?? i}`, img: e.img ?? null, value: null })),
  ];
  const MAX_ICONS = 4;
  const overflow = statuses.length > MAX_ICONS ? statuses.length - (MAX_ICONS - 1) : 0;
  const shownStatuses = overflow > 0 ? statuses.slice(0, MAX_ICONS - 1) : statuses;

  // Centre the visible art within the grid footprint: medium/large+ fill it exactly,
  // tiny/small are smaller than their 1-cell footprint and sit centred in the cell.
  const left = token.left + (token.footprintW - token.width) / 2;
  const top = token.top + (token.footprintH - token.height) / 2;

  return (
    <div
      data-token-id={token.id}
      data-mine={token.isMine ? "1" : undefined}
      className={`absolute ${token.isMine ? "cursor-grab" : ""} ${token.hidden ? "opacity-50" : ""} ${dragging ? "z-10 cursor-grabbing" : ""}`}
      style={{ left, top, width: token.width, height: token.height }}
    >
      <div className={`h-full w-full overflow-hidden rounded bg-zinc-800 ${ring} ${token.isCurrent ? "animate-pulse" : ""} ${dragging ? "brightness-110 ring-indigo-200" : ""}`}>
        {token.img ? (
          <img
            src={token.img}
            alt=""
            draggable={false}
            className="pointer-events-none h-full w-full select-none object-cover"
            style={token.scaleX !== 1 || token.scaleY !== 1 ? { transform: `scale(${token.scaleX}, ${token.scaleY})` } : undefined}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-500">
            <i className="fas fa-user" aria-hidden="true" />
          </span>
        )}
      </div>
      {statuses.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex">
          {shownStatuses.map((s) => (
            <div key={s.key} className="relative aspect-square w-1/4 overflow-hidden rounded-[2px] bg-zinc-900/70 ring-1 ring-black/50">
              {s.img ? (
                <img src={s.img} alt="" draggable={false} className="h-full w-full object-cover" />
              ) : (
                <span className="block h-full w-full bg-zinc-600" />
              )}
              {s.value != null && (
                <span className="absolute bottom-0 right-0 rounded-tl-[2px] bg-black/85 px-[1px] text-[7px] font-bold leading-none text-white">
                  {s.value}
                </span>
              )}
            </div>
          ))}
          {overflow > 0 && (
            <div className="flex aspect-square w-1/4 items-center justify-center rounded-[2px] bg-black/80 text-[7px] font-bold leading-none text-white ring-1 ring-black/50">
              +{overflow}
            </div>
          )}
        </div>
      )}
      {token.targeted && (
        <div className="pointer-events-none absolute -inset-1">
          <div className="h-full w-full rounded-sm ring-2 ring-red-500" />
          <i className="fas fa-crosshairs absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500" aria-hidden="true" />
        </div>
      )}
      {token.hp && (
        <div className="pointer-events-none absolute inset-x-[5%] -bottom-1 h-1.5 overflow-hidden rounded-full bg-zinc-900/80">
          <div className={`h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
        </div>
      )}
      {showLabel && token.name && (
        <div className="pointer-events-none absolute -bottom-6 left-1/2 max-w-[160px] -translate-x-1/2 truncate rounded bg-black/70 px-1 text-center text-xs text-white">
          {token.name}
        </div>
      )}
    </div>
  );
}
