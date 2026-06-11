/** Live PF2e spell casting + item activations. Thin glue over the system API,
 *  guarded so a rejected call surfaces via Foundry's toast and never throws into
 *  React — same contract as `rolls.ts` / `mutations.ts`. Casting posts the real
 *  spell card, which flows through the existing chat feed (Chat tab + toast). */

type Dict = Record<string, unknown>;

interface SpellCollectionLike {
  get(id: string): unknown;
}
interface SpellEntryLike {
  spells?: SpellCollectionLike | null;
  cast(spell: unknown, opts?: Dict): Promise<unknown>;
}
interface SpellcastingLike {
  get(id: string): SpellEntryLike | undefined;
  ritual?: SpellEntryLike | null;
}
interface CastActor {
  spellcasting: SpellcastingLike;
  items: { get(id: string): unknown };
}

function getActor(actorId: string): CastActor {
  return (game as any).actors.get(actorId) as CastActor;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] spell action failed", err);
    (ui as any)?.notifications?.error?.("Spell action failed — see console.");
  }
}

export interface CastOpts {
  /** Heightened rank to cast at; defaults to the spell's base/slot rank. */
  rank?: number;
  /** Prepared-slot index — expends that slot. Omit for spontaneous/at-will. */
  slotId?: number | null;
}

/** Cast a spell from a regular entry (prepared/spontaneous/focus/innate). */
export function castSpell(actorId: string, entryId: string, spellId: string, opts: CastOpts = {}): Promise<void> {
  return guard(() => {
    const actor = getActor(actorId);
    const entry = actor.spellcasting.get(entryId);
    if (!entry) throw new Error(`no spellcasting entry ${entryId}`);
    const spell = entry.spells?.get(spellId) ?? actor.items.get(spellId);
    const castOpts: Dict = {};
    if (opts.rank != null) castOpts.rank = opts.rank;
    if (opts.slotId != null) castOpts.slotId = opts.slotId;
    return entry.cast(spell, castOpts);
  });
}

/** Cast a ritual via the in-memory ritual entry. */
export function castRitual(actorId: string, spellId: string): Promise<void> {
  return guard(() => {
    const actor = getActor(actorId);
    const entry = actor.spellcasting.ritual ?? actor.spellcasting.get("rituals");
    if (!entry) throw new Error("no ritual entry");
    const spell = entry.spells?.get(spellId);
    return entry.cast(spell, {});
  });
}

/** Activate an item (wand/staff/scroll) — casts the embedded spell + spends a use. */
export function consumeActivation(actorId: string, itemId: string): Promise<void> {
  return guard(() => {
    const item = getActor(actorId).items.get(itemId) as { consume?: () => Promise<unknown> } | null;
    if (!item?.consume) throw new Error(`item ${itemId} not consumable`);
    return item.consume();
  });
}
