/** Live spell-card actions driven from the mobile chat feed. Guarded like cast.ts:
 *  a rejected call surfaces via Foundry's toast and never throws into React. PF2e
 *  owns the rules math — these only trigger and supply the bound actor. */

interface SpellDamagePartial { formula?: string; type?: string; category?: string | null }

/** Pure: a readable base-damage string for the damage popup, e.g. "2d4 fire". */
export function buildSpellBaseDamage(damage: Record<string, SpellDamagePartial> | undefined): string {
  if (!damage) return "";
  return Object.values(damage)
    .map((d) => [d.formula, d.category ?? "", d.type ?? ""].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" + ");
}

/** Pure: pull a spell's linked effect UUID from its description, if any.
 *  PF2e links spell effects as @UUID[Compendium.pf2e.spell-effects.Item.<name-or-id>]. */
const SPELL_EFFECT_UUID = /@UUID\[(Compendium\.pf2e\.spell-effects\.Item\.[^\]]+)\]/;
export function findSpellEffectUuid(description: string | undefined): string | null {
  if (!description) return null;
  const m = SPELL_EFFECT_UUID.exec(description);
  return m ? m[1] : null;
}

type Dict = Record<string, unknown>;

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] spell card action failed", err);
    (ui as any)?.notifications?.error?.("Spell action failed — see console.");
  }
}

/** Roll a cast spell's damage. The cast spell (heightened, at cast rank) is read
 *  off the message via `message.item`; PF2e posts the damage card itself. Spells
 *  have a single damage roll (no critical) in v8.2. */
export function rollSpellDamage(messageId: string): Promise<void> {
  return guard(() => {
    const msg = (game as any)?.messages?.get(messageId);
    const spell = msg?.item;
    if (!spell?.rollDamage) throw new Error(`no spell on message ${messageId}`);
    return spell.rollDamage(new PointerEvent("click"));
  });
}

export type SaveMode = "normal" | "fortune" | "misfortune";
const ROLL_TWICE: Record<SaveMode, "keep-higher" | "keep-lower" | false> = {
  normal: false,
  fortune: "keep-higher",
  misfortune: "keep-lower",
};

/** Roll the bound character's save against a spell's DC. There is no canvas token
 *  selection on mobile, so the app's actor is the roller by construction (the
 *  native card uses getActiveTokens() → errors NoTokenSelected). `messageId`, when
 *  given, supplies the spell (item) + caster (origin) for correct roll options. */
export function rollSpellSave(
  actorId: string,
  saveType: string,
  dc: number,
  opts: { mode?: SaveMode; messageId?: string } = {},
): Promise<void> {
  return guard(() => {
    const actor = (game as any)?.actors?.get(actorId);
    const save = actor?.saves?.[saveType];
    if (!save?.roll) throw new Error(`no save statistic ${saveType}`);
    const msg = opts.messageId ? (game as any)?.messages?.get(opts.messageId) : null;
    const args: Dict = {
      dc: { value: dc },
      rollTwice: ROLL_TWICE[opts.mode ?? "normal"],
      skipDialog: true,
    };
    if (msg?.item) args.item = msg.item;
    if (msg?.actor) args.origin = msg.actor;
    return save.roll(args);
  });
}

/** Resolve an effect document from a UUID, tolerating PF2e's name-based
 *  spell-effects links (Compendium.pf2e.spell-effects.Item.<name>) by falling back
 *  to a pack-index lookup by name. */
async function loadEffect(uuid: string): Promise<{ toObject: () => Dict } | null> {
  const g = globalThis as any;
  const direct = await g.fromUuid?.(uuid).catch(() => null);
  if (direct?.toObject) return direct;
  const m = /^Compendium\.(.+)\.Item\.(.+)$/.exec(uuid);
  if (m) {
    const pack = g.game?.packs?.get(m[1]);
    if (pack?.getIndex) {
      const index = await pack.getIndex();
      const entry = index.find?.((e: { _id: string; name: string }) => e.name === m[2] || e._id === m[2]);
      if (entry) {
        const byId = await g.fromUuid?.(`Compendium.${m[1]}.Item.${entry._id}`).catch(() => null);
        if (byId?.toObject) return byId;
      }
    }
  }
  return null;
}

/** Apply a spell effect to the bound character (the mobile "current character").
 *  Faithful to PF2e's simple-action path: clone the effect source, drop its id,
 *  and create it on the actor. */
export function applySpellEffect(actorId: string, uuid: string): Promise<void> {
  return guard(async () => {
    const actor = (game as any)?.actors?.get(actorId);
    if (!actor?.createEmbeddedDocuments) throw new Error(`no actor ${actorId}`);
    const effect = await loadEffect(uuid);
    if (!effect) throw new Error(`effect not found: ${uuid}`);
    const source = effect.toObject();
    source._id = null;
    return actor.createEmbeddedDocuments("Item", [source]);
  });
}
