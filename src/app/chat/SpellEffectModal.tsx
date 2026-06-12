import { useEffect, useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { enrichHtml } from "../../foundry/enrich";
import { applySpellEffect, loadEffect } from "../../foundry/spells/chatActions";

/** Popup for a spell's linked effect: enriched description + Apply to the bound
 *  character. Reachable from the cast card and the Spells-tab detail view. */
export function SpellEffectModal({
  actorId,
  uuid,
  onClose,
}: {
  actorId: string;
  uuid: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("Spell Effect");
  const [html, setHtml] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadEffect(uuid).then(async (eff) => {
      if (!alive) return;
      if (eff) {
        setName(eff.name ?? "Spell Effect");
        const desc = eff.system?.description?.value ?? "";
        const enriched = desc ? await enrichHtml(desc) : "";
        if (alive) setHtml(enriched);
      }
      if (alive) setLoaded(true);
    });
    return () => { alive = false; };
  }, [uuid]);
  const onApply = () => { void applySpellEffect(actorId, uuid); onClose(); };
  return (
    <Modal title={name} onClose={onClose}>
      {html ? (
        <div
          className="mb-3 text-sm leading-relaxed text-zinc-200 [&_a]:text-indigo-300 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="mb-3 text-sm text-zinc-500">{loaded ? "No description." : "Loading…"}</div>
      )}
      <button
        onClick={onApply}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Apply to Character
      </button>
    </Modal>
  );
}
