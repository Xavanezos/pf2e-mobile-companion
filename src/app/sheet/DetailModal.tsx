import { useEffect, useMemo, useState } from "react";
import { Modal } from "./parts/Modal";
import { ActionGlyph } from "./parts/ActionGlyph";
import { Chip } from "./parts/Chip";
import { buildItemDetail } from "../../foundry/actor/view";
import { enrichHtml } from "../../foundry/enrich";
import type { ItemDetailLike, ItemDetailView } from "../../foundry/actor/types";

function readItem(actorId: string, itemId: string): ItemDetailView | null {
  const item = (game as any)?.actors?.get(actorId)?.items?.get(itemId);
  return item ? buildItemDetail(item as ItemDetailLike) : null;
}

/** Tap-for-info popup (#3): feats / items / effects. Reads the live item lazily
 *  and enriches its description best-effort (raw fallback). Read-only. */
export function DetailModal({ actorId, itemId, onClose }: {
  actorId: string;
  itemId: string;
  onClose: () => void;
}) {
  const detail = useMemo(() => readItem(actorId, itemId), [actorId, itemId]);
  const [html, setHtml] = useState(detail?.descriptionHtml ?? "");

  useEffect(() => {
    let alive = true;
    if (detail?.descriptionHtml) enrichHtml(detail.descriptionHtml).then((h) => { if (alive) setHtml(h); });
    return () => { alive = false; };
  }, [detail?.descriptionHtml]);

  if (!detail) {
    return <Modal title="Item" onClose={onClose}><div className="text-sm text-zinc-500">Item unavailable.</div></Modal>;
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {detail.img && <img src={detail.img} alt="" className="h-6 w-6 rounded object-cover" />}
          <span className="truncate">{detail.name}</span>
          {detail.actionGlyph && <ActionGlyph code={detail.actionGlyph} />}
        </span>
      }
      onClose={onClose}
    >
      <div className="mb-2 text-xs text-zinc-400">
        {detail.typeLabel}{detail.level != null ? ` · Level ${detail.level}` : ""}
      </div>
      {detail.traits.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {detail.traits.map((t) => <Chip key={t}>{t}</Chip>)}
        </div>
      )}
      {detail.meta.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {detail.meta.map((m) => <span key={m.label}><span className="text-zinc-500">{m.label}:</span> {m.value}</span>)}
        </div>
      )}
      {html
        ? <div className="text-sm leading-relaxed text-zinc-200 [&_a]:text-indigo-300 [&_h1]:font-bold [&_h2]:font-bold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: html }} />
        : <div className="text-sm text-zinc-500">No description.</div>}
    </Modal>
  );
}
