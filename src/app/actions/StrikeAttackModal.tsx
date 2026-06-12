import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import type { StrikeAttackPreview, StrikeView } from "../../foundry/actor/types";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Attack roll prompt: a checkbox per modifier (uncheck to disable, PF2e-style), the
 *  MAP penalty row, the live grand total, and a Roll button. Each toggle re-previews
 *  via `loadPreview` (PF2e's own stacking); the disabled slugs ride along to `onRoll`.
 *  Source-agnostic — the tab closes over actorId/strikeIndex/variantIndex. */
export function StrikeAttackModal({
  strike,
  variantIndex,
  loadPreview,
  onRoll,
  onClose,
}: {
  strike: StrikeView;
  variantIndex: number;
  loadPreview: (disabledSlugs: string[]) => Promise<StrikeAttackPreview | null>;
  onRoll: (disabledSlugs: string[]) => void;
  onClose: () => void;
}) {
  const variant = strike.variants[variantIndex];
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<StrikeAttackPreview | null>(null);

  // Before any toggle, render the static view + precomposed label; after, the live preview.
  const rows = preview?.parts ?? strike.modifiers;
  const totalLabel = preview ? sign(preview.total) : variant.label;

  const toggle = (slug: string) => {
    const next = new Set(disabled);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setDisabled(next);
    loadPreview([...next]).then(setPreview).catch(() => {});
  };

  const roll = () => { onRoll([...disabled]); onClose(); };

  return (
    <Modal title={strike.label} onClose={onClose}>
      <div className="divide-y divide-zinc-800">
        {rows.map((m, i) => (
          <label
            key={`${m.slug}-${i}`}
            className={`flex cursor-pointer items-center gap-2 px-1 py-2 text-sm ${m.enabled ? "" : "opacity-40"}`}
          >
            <input
              type="checkbox"
              checked={!disabled.has(m.slug)}
              onChange={() => toggle(m.slug)}
              className="h-4 w-4 shrink-0 accent-indigo-500"
            />
            <span className="min-w-0 flex-1 truncate text-zinc-300">{m.label}</span>
            <span className="font-semibold tabular-nums">{sign(m.value)}</span>
          </label>
        ))}
        {variant.penalty !== 0 && (
          <div className="flex items-center justify-between px-1 py-2 text-sm">
            <span className="pl-6 text-zinc-300">Multiple Attack Penalty</span>
            <span className="font-semibold tabular-nums">{variant.penalty}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-700 px-1 pt-2">
        <span className="font-semibold">Attack</span>
        <span className="text-lg font-bold tabular-nums">{totalLabel}</span>
      </div>
      <button onClick={roll} className="mt-3 min-h-12 w-full rounded-md bg-indigo-600 font-semibold text-white">
        Roll {totalLabel}
      </button>
    </Modal>
  );
}
