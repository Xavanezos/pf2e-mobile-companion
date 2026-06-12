import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "../parts/Modal";
import { ActionGlyph } from "../parts/ActionGlyph";
import { useFoundryHook } from "../../useFoundryHook";
import { buildSpellbookView } from "../../../foundry/spells/view";
import { prepareSpell, unprepareSpell, removeKnownSpell, toggleSignature } from "../../../foundry/spells/spellbook";
import type { SpellbookView, SpellcastingSheetDataLike } from "../../../foundry/spells/types";
import { loc } from "../../../foundry/i18n";

function entryName(actorId: string, entryId: string): string {
  return (game as any)?.actors?.get(actorId)?.spellcasting?.get(entryId)?.name ?? "Spells";
}

/** Spellbook editor for one entry. Prepared casters fill slots from their book;
 *  spontaneous casters manage their repertoire (remove / signature). Reloads its
 *  own data from the entry's `getSheetData()` and on item changes. */
export function SpellbookModal({ actorId, entryId, onClose }: { actorId: string; entryId: string; onClose: () => void }) {
  const [view, setView] = useState<SpellbookView | null>(null);
  const [picking, setPicking] = useState<{ groupId: string; slotIndex: number } | null>(null);
  const reqId = useRef(0);

  const load = useCallback(() => {
    const entry = (game as any)?.actors?.get(actorId)?.spellcasting?.get(entryId);
    if (!entry?.getSheetData) {
      setView(null);
      return;
    }
    const id = ++reqId.current;
    entry
      .getSheetData()
      .then((d: unknown) => {
        if (id === reqId.current) setView(buildSpellbookView(d as SpellcastingSheetDataLike, entry.spells?.contents ?? []));
      })
      .catch(() => {});
  }, [actorId, entryId]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = useCallback(
    (doc: any) => {
      const aId = doc?.actor?.id ?? doc?.parent?.id ?? doc?.id;
      if (aId === actorId) load();
    },
    [actorId, load],
  );
  useFoundryHook("updateItem", onChange);
  useFoundryHook("createItem", onChange);
  useFoundryHook("deleteItem", onChange);

  const title = `Spellbook · ${entryName(actorId, entryId)}`;

  if (!view) {
    return (
      <Modal title={title} onClose={onClose}>
        <div className="text-sm text-zinc-500">Loading…</div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      {view.kind === "prepared" ? (
        <div className="flex flex-col gap-3">
          {view.ranks.map((r) => (
            <section key={r.id}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{loc(r.label)}</div>
              <div className="flex flex-col gap-1">
                {r.slots.map((slot) => (
                  <div key={slot.slotIndex} className="flex items-center gap-2">
                    {slot.spell ? (
                      <>
                        <span className="flex min-w-0 flex-1 items-center gap-1 text-sm">
                          <ActionGlyph code={slot.spell.glyph} />
                          <span className="truncate">{slot.spell.name}</span>
                        </span>
                        <button
                          onClick={() => void unprepareSpell(actorId, entryId, r.id, slot.slotIndex)}
                          className="shrink-0 rounded-md bg-zinc-700 px-2 py-1 text-xs text-zinc-200"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setPicking({ groupId: r.id, slotIndex: slot.slotIndex })}
                        className="flex-1 rounded-md border border-dashed border-zinc-600 px-2 py-1.5 text-left text-xs text-zinc-400"
                      >
                        + Prepare a spell…
                      </button>
                    )}
                  </div>
                ))}
                {picking && picking.groupId === r.id && (
                  <div className="mt-1 rounded-md bg-zinc-800 p-2">
                    <div className="mb-1 text-[11px] text-zinc-400">Choose a spell for slot {picking.slotIndex + 1}</div>
                    <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                      {r.known.length === 0 ? (
                        <div className="text-xs text-zinc-500">No spells in your book at this rank.</div>
                      ) : (
                        r.known.map((k) => (
                          <button
                            key={k.id}
                            onClick={() => {
                              void prepareSpell(actorId, entryId, k.id, picking.groupId, picking.slotIndex);
                              setPicking(null);
                            }}
                            className="flex items-center justify-start gap-2 rounded px-2 py-1 text-left text-sm"
                          >
                            <ActionGlyph code={k.glyph} />
                            <span className="truncate">{k.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <button onClick={() => setPicking(null)} className="mt-1 text-xs text-zinc-400">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {view.ranks.map((r) => (
            <section key={r.id}>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{loc(r.label)}</div>
              <div className="divide-y divide-zinc-800">
                {r.known.length === 0 ? (
                  <div className="py-1 text-xs text-zinc-600">—</div>
                ) : (
                  r.known.map((k) => (
                    <div key={k.id} className="flex items-center gap-2 py-1.5">
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-sm">
                        <ActionGlyph code={k.glyph} />
                        <span className="truncate">{k.name}</span>
                      </span>
                      {r.rank > 0 && (
                        <button
                          onClick={() => void toggleSignature(actorId, k.id)}
                          title="Signature spell"
                          className={`shrink-0 px-1 ${k.signature ? "text-amber-400" : "text-zinc-600"}`}
                        >
                          <i className="fas fa-star" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        onClick={() => void removeKnownSpell(actorId, k.id)}
                        title="Remove from repertoire"
                        className="shrink-0 px-1 text-zinc-500"
                      >
                        <i className="fas fa-trash" aria-hidden="true" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ))}
          <div className="text-[11px] leading-relaxed text-zinc-500">
            Learning new spells from the compendium isn’t available on mobile yet — add them on desktop and they’ll appear
            here to manage.
          </div>
        </div>
      )}
    </Modal>
  );
}
