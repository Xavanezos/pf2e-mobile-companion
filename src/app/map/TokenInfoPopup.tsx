import { Modal } from "../sheet/parts/Modal";
import { Chip } from "../sheet/parts/Chip";
import { toggleTarget } from "../../foundry/scene/targeting";
import type { TokenView } from "../../foundry/scene/types";

const DISPO_LABEL: Record<number, string> = {
  1: "Friendly",
  0: "Neutral",
  [-1]: "Hostile",
  [-2]: "Secret",
};

/** Minimal tap-for-info card for a token on the map: portrait, name (or "Hidden"
 *  when the player may not see it), disposition, and an HP bar where the viewer is
 *  allowed to see it (same gating as the combat tracker). Reuses the bottom-sheet
 *  Modal. */
export function TokenInfoPopup({ token, onClose }: { token: TokenView; onClose: () => void }) {
  const hpPct = token.hp && token.hp.max > 0
    ? Math.max(0, Math.min(100, (token.hp.value / token.hp.max) * 100))
    : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-500";

  return (
    <Modal title={token.name || "Hidden"} onClose={onClose}>
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded bg-zinc-800">
          {token.img ? (
            <img src={token.img} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-zinc-500">
              <i className="fas fa-user" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-400">{DISPO_LABEL[token.disposition] ?? ""}</div>
          {token.hp ? (
            <div className="mt-2">
              <div className="mb-1 text-sm text-zinc-200">
                HP {token.hp.value} / {token.hp.max}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-500">HP hidden</div>
          )}
        </div>
      </div>
      {(token.conditions.length > 0 || token.effects.length > 0) && (
        <div className="mt-4 space-y-2">
          {token.conditions.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Conditions</div>
              <div className="flex flex-wrap gap-1">
                {token.conditions.map((c) => (
                  <Chip key={c.slug} tone="warn">{c.name}{c.value != null ? ` ${c.value}` : ""}</Chip>
                ))}
              </div>
            </div>
          )}
          {token.effects.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Effects</div>
              <div className="flex flex-wrap gap-1">
                {token.effects.map((e, i) => (
                  <Chip key={e.id ?? `e${i}`}>{e.name}{e.badge ? ` ${e.badge}` : ""}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <button
        onClick={() => toggleTarget(token.id)}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-white ${token.targeted ? "bg-red-600" : "bg-indigo-600"}`}
      >
        <i className="fas fa-crosshairs" aria-hidden="true" />
        {token.targeted ? "Untarget" : "Target"}
      </button>
    </Modal>
  );
}
