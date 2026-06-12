import { useEffect, useMemo, useState } from "react";
import { Modal } from "../parts/Modal";
import { ActionGlyph } from "../parts/ActionGlyph";
import { Chip } from "../parts/Chip";
import { buildSpellDetail } from "../../../foundry/spells/view";
import { enrichHtml } from "../../../foundry/enrich";
import type { SpellDetailLike, SpellDetailView } from "../../../foundry/spells/types";
import { findSpellEffectUuid } from "../../../foundry/spells/chatActions";
import { SpellEffectModal } from "../../chat/SpellEffectModal";

function readSpell(actorId: string, spellId: string): SpellDetailView | null {
  const item = (game as any)?.actors?.get(actorId)?.items?.get(spellId);
  return item ? buildSpellDetail(item as SpellDetailLike) : null;
}

/** Tap-for-info popup for a spell: rank, traits, cast/range/area/defense, and the
 *  enriched description. Read-only — mirrors DetailModal for items. */
export function SpellDetailModal({
  actorId,
  spellId,
  onClose,
}: {
  actorId: string;
  spellId: string;
  onClose: () => void;
}) {
  const detail = useMemo(() => readSpell(actorId, spellId), [actorId, spellId]);
  const [html, setHtml] = useState(detail?.descriptionHtml ?? "");
  const effectUuid = useMemo(() => findSpellEffectUuid(detail?.descriptionHtml), [detail?.descriptionHtml]);
  const [showEffect, setShowEffect] = useState(false);

  useEffect(() => {
    let alive = true;
    if (detail?.descriptionHtml) enrichHtml(detail.descriptionHtml).then((h) => { if (alive) setHtml(h); });
    return () => {
      alive = false;
    };
  }, [detail?.descriptionHtml]);

  if (!detail) {
    return (
      <Modal title="Spell" onClose={onClose}>
        <div className="text-sm text-zinc-500">Spell unavailable.</div>
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {detail.img && <img src={detail.img} alt="" className="h-6 w-6 rounded object-cover" />}
          <span className="truncate">{detail.name}</span>
          {detail.glyph && <ActionGlyph code={detail.glyph} />}
        </span>
      }
      onClose={onClose}
    >
      <div className="mb-2 text-xs text-zinc-400">Rank {detail.rank}</div>
      {detail.traits.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {detail.traits.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      )}
      {detail.meta.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
          {detail.meta.map((m) => (
            <span key={m.label}>
              <span className="text-zinc-500">{m.label}:</span> {m.value}
            </span>
          ))}
        </div>
      )}
      {effectUuid && (
        <button
          onClick={() => setShowEffect(true)}
          className="mb-3 w-full rounded-md bg-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100"
        >
          <i className="fas fa-wand-magic-sparkles mr-1.5" aria-hidden="true" />
          Apply Effect
        </button>
      )}
      {html ? (
        <div
          className="text-sm leading-relaxed text-zinc-200 [&_a]:text-indigo-300 [&_h1]:font-bold [&_h2]:font-bold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="text-sm text-zinc-500">No description.</div>
      )}
      {showEffect && effectUuid && (
        <SpellEffectModal actorId={actorId} uuid={effectUuid} onClose={() => setShowEffect(false)} />
      )}
    </Modal>
  );
}
