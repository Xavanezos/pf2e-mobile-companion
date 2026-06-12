import { ActionGlyph } from "../parts/ActionGlyph";
import type { SpellRowView } from "../../../foundry/spells/types";

/** One spell row: tap the name to inspect, tap Cast to cast. Dimmed when expended. */
export function SpellRow({
  spell,
  onCast,
  onDetail,
  castDisabled,
}: {
  spell: SpellRowView;
  onCast?: () => void;
  onDetail: () => void;
  castDisabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${spell.expended ? "opacity-50" : ""}`}>
      <button onClick={onDetail} className="flex min-w-0 flex-1 items-center justify-start gap-2 text-left">
        {spell.img && <img src={spell.img} alt="" className="h-7 w-7 rounded object-cover" />}
        <span className="min-w-0 truncate text-sm">{spell.name}</span>
        {spell.signature && (
          <i className="fas fa-star shrink-0 text-[10px] text-amber-400" title="Signature" aria-hidden="true" />
        )}
        <ActionGlyph code={spell.glyph} />
      </button>
      {onCast && (
        <button
          onClick={onCast}
          disabled={castDisabled}
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          Cast
        </button>
      )}
    </div>
  );
}
