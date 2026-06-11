/** Spellbook mutations — prepare/clear prepared slots, manage known spells, set
 *  focus points. Guarded like cast.ts: a failure surfaces via Foundry's toast and
 *  never throws into React. Grounded in PF2e's SpellCollection API
 *  (`prepareSpell(spell|null, groupId, slotIndex)`) + spell item update/delete. */

type Dict = Record<string, unknown>;

interface SpellCollectionLike {
  get(id: string): unknown;
  prepareSpell(spell: unknown, groupId: string | number, slotIndex: number): Promise<unknown>;
}
interface SpellEntryLike {
  spells?: SpellCollectionLike | null;
}
interface SpellbookActor {
  spellcasting: { get(id: string): SpellEntryLike | undefined };
  items: { get(id: string): unknown };
  update(data: Dict): Promise<unknown>;
}

function getActor(actorId: string): SpellbookActor {
  return (game as any).actors.get(actorId) as SpellbookActor;
}
function collection(actorId: string, entryId: string): SpellCollectionLike {
  const coll = getActor(actorId).spellcasting.get(entryId)?.spells;
  if (!coll) throw new Error(`no spell collection for ${entryId}`);
  return coll;
}
async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] spellbook action failed", err);
    (ui as any)?.notifications?.error?.("Spellbook action failed — see console.");
  }
}

/** Prepare a known spell into a prepared-caster's slot. */
export function prepareSpell(
  actorId: string,
  entryId: string,
  spellId: string,
  groupId: string | number,
  slotIndex: number,
): Promise<void> {
  return guard(() => {
    const coll = collection(actorId, entryId);
    const spell = coll.get(spellId) ?? getActor(actorId).items.get(spellId);
    return coll.prepareSpell(spell, groupId, slotIndex);
  });
}

/** Clear a prepared slot (PF2e models this as preparing `null`). */
export function unprepareSpell(actorId: string, entryId: string, groupId: string | number, slotIndex: number): Promise<void> {
  return guard(() => collection(actorId, entryId).prepareSpell(null, groupId, slotIndex));
}

/** Toggle a spontaneous caster's signature spell. */
export function toggleSignature(actorId: string, spellId: string): Promise<void> {
  return guard(() => {
    const spell = getActor(actorId).items.get(spellId) as
      | { system?: { location?: { signature?: boolean } }; update(d: Dict): Promise<unknown> }
      | null;
    if (!spell) throw new Error(`no spell ${spellId}`);
    const current = spell.system?.location?.signature ?? false;
    return spell.update({ "system.location.signature": !current });
  });
}

/** Remove a known spell from a repertoire/spellbook (deletes the spell item). */
export function removeKnownSpell(actorId: string, spellId: string): Promise<void> {
  return guard(() => {
    const spell = getActor(actorId).items.get(spellId) as { delete(): Promise<unknown> } | null;
    if (!spell?.delete) throw new Error(`no spell ${spellId}`);
    return spell.delete();
  });
}

/** Set the focus pool (clamped at 0; max is enforced by the system). */
export function setFocusPoints(actorId: string, value: number): Promise<void> {
  return guard(() => getActor(actorId).update({ "system.resources.focus.value": Math.max(0, value) }));
}
