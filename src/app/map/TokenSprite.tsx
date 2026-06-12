import type { PointerEvent } from "react";
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
 *  others get a disposition-tinted ring. `isMine` tokens are draggable (handler
 *  wired by BattleMap). HP bar + nameplate show below the portrait; the nameplate
 *  is gated by zoom (`showLabel`) so it isn't unreadable at fit scale. Uses
 *  bg/ring, never `border` (Tailwind-v4 reset gotcha). */
export function TokenSprite({
  token,
  showLabel,
  onPointerDown,
}: {
  token: TokenView;
  showLabel: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  const ring = token.isCurrent
    ? "ring-4 ring-indigo-300"
    : `ring-2 ${DISPO_RING[token.disposition] ?? "ring-zinc-400"}`;
  const hpPct = token.hp && token.hp.max > 0
    ? Math.max(0, Math.min(100, (token.hp.value / token.hp.max) * 100))
    : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div
      onPointerDown={onPointerDown}
      className={`absolute ${token.isMine ? "cursor-grab touch-none" : ""} ${token.hidden ? "opacity-50" : ""}`}
      style={{ left: token.left, top: token.top, width: token.width, height: token.height }}
    >
      <div className={`h-full w-full overflow-hidden rounded bg-zinc-800 ${ring} ${token.isCurrent ? "animate-pulse" : ""}`}>
        {token.img ? (
          <img src={token.img} alt="" draggable={false} className="h-full w-full select-none object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-zinc-500">
            <i className="fas fa-user" aria-hidden="true" />
          </span>
        )}
      </div>
      {token.hp && (
        <div className="absolute inset-x-[5%] -bottom-1 h-1.5 overflow-hidden rounded-full bg-zinc-900/80">
          <div className={`h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
        </div>
      )}
      {showLabel && token.name && (
        <div className="absolute -bottom-6 left-1/2 max-w-[160px] -translate-x-1/2 truncate rounded bg-black/70 px-1 text-center text-xs text-white">
          {token.name}
        </div>
      )}
    </div>
  );
}
